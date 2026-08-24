"""
A API do SoundDeck, escrita contra `frontend/src/data/apiRepo.ts`.

Três regras organizam o arquivo:

**O deck sai inteiro de uma vez.** `GET /api/deck/` entrega peças, dias,
cenas, cues e biblioteca numa resposta só. Depois disso o servidor some: nada
aqui é chamado no caminho do disparo, e a rede pode cair no meio da peça sem
que um único cue deixe de tocar.

**Remover devolve o que levou junto.** O produto não pergunta "tem certeza?",
ele desfaz — então todo `DELETE` responde com a árvore que foi removida, e as
rotas `restore/` a reinserem com os ids originais.

**Ordem é posição, e é responsabilidade do servidor.** Toda escrita que mexe
em posição termina reindexando o grupo afetado (`deck/ordering.py`).
"""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.request import Request
from rest_framework.response import Response

from . import serializers as api
from . import services
from .errors import Invalid, Missing
from .models import Audio, Cue, Day, Scene, Show, new_id
from .ordering import apply_order, densify, next_order, open_slot


def ok(data: object, code: int = status.HTTP_200_OK) -> Response:
    return Response(data, status=code)


def done() -> Response:
    """204 para as escritas que a interface não lê de volta."""
    return Response(status=status.HTTP_204_NO_CONTENT)


def valid(serializer_class, data) -> dict:
    serializer = serializer_class(data=data)
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data


def get_show(show_id: str) -> Show:
    try:
        return Show.objects.get(pk=show_id)
    except Show.DoesNotExist:
        raise Missing("essa peça não existe mais no servidor")


def get_day(day_id: str) -> Day:
    try:
        return Day.objects.get(pk=day_id)
    except Day.DoesNotExist:
        raise Missing("esse dia não existe mais no servidor")


def get_scene(scene_id: str) -> Scene:
    try:
        return Scene.objects.get(pk=scene_id)
    except Scene.DoesNotExist:
        raise Missing("essa cena não existe mais no servidor")


def get_cue(cue_id: str) -> Cue:
    try:
        return Cue.objects.get(pk=cue_id)
    except Cue.DoesNotExist:
        raise Missing("esse cue não existe mais no servidor")


def get_audio(audio_id: str, *, deleted: bool = False) -> Audio:
    try:
        audio = Audio.objects.get(pk=audio_id)
    except Audio.DoesNotExist:
        raise Missing("esse áudio não existe mais no servidor")
    if audio.deleted_at is not None and not deleted:
        raise Missing("esse áudio não existe mais no servidor")
    return audio


# ------------------------------------------------------------------ deck


@api_view(["GET"])
def deck(request: Request) -> Response:
    """Tudo que o deck precisa para operar, entregue no carregamento."""
    services.purge_audios()
    return ok(
        {
            "shows": api.ShowOut(Show.objects.all(), many=True).data,
            "days": api.DayOut(Day.objects.all(), many=True).data,
            "scenes": api.SceneOut(Scene.objects.all(), many=True).data,
            "audios": api.AudioOut(Audio.objects.alive(), many=True).data,
            "cues": api.CueOut(Cue.objects.all(), many=True).data,
        }
    )


# ----------------------------------------------------------------- peças


@api_view(["POST"])
@transaction.atomic
def shows(request: Request) -> Response:
    data = valid(api.ShowIn, request.data)
    show = Show.objects.create(
        id=new_id("p"),
        name=data["name"],
        venue=data["venue"],
        order=next_order(Show.objects.all()),
    )
    # Uma peça sem dia nenhum não tem onde guardar cena. O primeiro dia vem
    # junto para o operador nunca cair num lugar sem saída.
    Day.objects.create(id=new_id("d"), show=show, name="Dia 1", date=None, order=0)
    return ok(api.ShowOut(show).data, status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@transaction.atomic
def show_detail(request: Request, show_id: str) -> Response:
    show = get_show(show_id)

    if request.method == "PATCH":
        for field, value in valid(api.ShowPatch, request.data).items():
            setattr(show, field, value)
        show.save()
        return ok(api.ShowOut(show).data)

    days = list(show.days.all())
    scenes = list(Scene.objects.filter(day__in=days))
    cues = list(Cue.objects.filter(scene__in=scenes))
    bundle = {
        "show": api.ShowOut(show).data,
        "days": api.DayOut(days, many=True).data,
        "scenes": api.SceneOut(scenes, many=True).data,
        "cues": api.CueOut(cues, many=True).data,
    }
    show.delete()
    densify(Show.objects.all())
    return ok(bundle)


@api_view(["POST"])
@transaction.atomic
def shows_restore(request: Request) -> Response:
    """Recompõe a peça inteira no lugar de onde ela saiu."""
    data = valid(api.RestoreShowIn, request.data)
    show_data = data["show"]

    open_slot(Show.objects.all(), show_data["order"])
    show = Show.objects.create(**show_data)
    _restore_days(data["days"], data["scenes"], data["cues"], show=show)
    densify(Show.objects.all())
    return done()


@api_view(["POST"])
@transaction.atomic
def shows_reorder(request: Request) -> Response:
    apply_order(Show.objects.all(), valid(api.Reorder, request.data)["ids"])
    return done()


@api_view(["POST"])
@transaction.atomic
def show_duplicate(request: Request, show_id: str) -> Response:
    source = get_show(show_id)
    data = valid(api.ShowIn, request.data)
    show = services.duplicate_show(source, data["name"], data["venue"])
    return ok(api.ShowOut(show).data, status.HTTP_201_CREATED)


# ------------------------------------------------------------------- dias


@api_view(["POST"])
@transaction.atomic
def days(request: Request) -> Response:
    data = valid(api.DayIn, request.data)
    show = get_show(data["show"])
    day = Day.objects.create(
        id=new_id("d"),
        show=show,
        name=data["name"],
        date=data["date"],
        order=next_order(show.days),
    )
    return ok(api.DayOut(day).data, status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@transaction.atomic
def day_detail(request: Request, day_id: str) -> Response:
    day = get_day(day_id)

    if request.method == "PATCH":
        for field, value in valid(api.DayPatch, request.data).items():
            setattr(day, field, value)
        day.save()
        return ok(api.DayOut(day).data)

    scenes = list(day.scenes.all())
    cues = list(Cue.objects.filter(scene__in=scenes))
    bundle = {
        "day": api.DayOut(day).data,
        "scenes": api.SceneOut(scenes, many=True).data,
        "cues": api.CueOut(cues, many=True).data,
    }
    show_id = day.show_id
    day.delete()
    densify(Day.objects.filter(show_id=show_id))
    return ok(bundle)


@api_view(["POST"])
@transaction.atomic
def days_restore(request: Request) -> Response:
    data = valid(api.RestoreDayIn, request.data)
    day_data = data["day"]
    show = get_show(day_data["showId"])

    open_slot(show.days, day_data["order"])
    day = Day.objects.create(
        id=day_data["id"],
        show=show,
        name=day_data["name"],
        date=day_data["date"],
        order=day_data["order"],
    )
    _restore_scenes(data["scenes"], data["cues"], days={day.pk: day})
    densify(show.days)
    return done()


@api_view(["POST"])
@transaction.atomic
def days_reorder(request: Request) -> Response:
    data = valid(api.Reorder, request.data)
    show = get_show(_required(request.data, "show", "peça"))
    apply_order(show.days, data["ids"])
    return done()


@api_view(["POST"])
@transaction.atomic
def day_duplicate(request: Request, day_id: str) -> Response:
    source = get_day(day_id)
    data = valid(api.DuplicateDayIn, request.data)
    day = Day.objects.create(
        id=new_id("d"),
        show=source.show,
        name=data["name"],
        date=data["date"],
        order=next_order(source.show.days),
    )
    services.copy_day(source, day)
    return ok(api.DayOut(day).data, status.HTTP_201_CREATED)


# ------------------------------------------------------------------ cenas


@api_view(["POST"])
@transaction.atomic
def scenes(request: Request) -> Response:
    data = valid(api.SceneIn, request.data)
    day = get_day(data["day"])
    scene = Scene.objects.create(
        id=new_id("s"),
        day=day,
        name=data["name"],
        order=next_order(day.scenes),
    )
    return ok(api.SceneOut(scene).data, status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@transaction.atomic
def scene_detail(request: Request, scene_id: str) -> Response:
    scene = get_scene(scene_id)

    if request.method == "PATCH":
        scene.name = valid(api.ScenePatch, request.data)["name"]
        scene.save()
        return ok(api.SceneOut(scene).data)

    cues = list(scene.cues.all())
    bundle = {
        "scene": api.SceneOut(scene).data,
        "cues": api.CueOut(cues, many=True).data,
    }
    day_id = scene.day_id
    scene.delete()
    densify(Scene.objects.filter(day_id=day_id))
    return ok(bundle)


@api_view(["POST"])
@transaction.atomic
def scenes_restore(request: Request) -> Response:
    data = valid(api.RestoreSceneIn, request.data)
    scene_data = data["scene"]
    day = get_day(scene_data["dayId"])

    open_slot(day.scenes, scene_data["order"])
    scene = Scene.objects.create(
        id=scene_data["id"],
        day=day,
        name=scene_data["name"],
        order=scene_data["order"],
    )
    _restore_cues(data["cues"], scenes={scene.pk: scene})
    densify(day.scenes)
    return done()


@api_view(["POST"])
@transaction.atomic
def scenes_reorder(request: Request) -> Response:
    data = valid(api.Reorder, request.data)
    day = get_day(_required(request.data, "day", "dia"))
    apply_order(day.scenes, data["ids"])
    return done()


@api_view(["POST"])
@transaction.atomic
def scene_move(request: Request, scene_id: str) -> Response:
    """Realoca a cena em outro dia, no fim do roteiro dele."""
    scene = get_scene(scene_id)
    day = get_day(valid(api.DayRef, request.data)["day"])
    if scene.day_id == day.pk:
        return done()

    origin = scene.day_id
    scene.day = day
    # Entra no fim do destino: adivinhar posição no meio de um dia que o
    # operador não está olhando seria pior do que deixá-lo arrastar depois.
    scene.order = next_order(day.scenes)
    scene.save()
    densify(Scene.objects.filter(day_id=origin))
    densify(day.scenes)
    return done()


@api_view(["POST"])
@transaction.atomic
def scene_copy(request: Request, scene_id: str) -> Response:
    """Copia a cena e seus cues para um dia — o mesmo bloco em duas sessões."""
    scene = get_scene(scene_id)
    day = get_day(valid(api.DayRef, request.data)["day"])
    created = services.copy_into([scene], list(scene.cues.all()), day)
    if not created:
        raise Invalid("não foi possível copiar a cena")
    return ok(api.SceneOut(created[0]).data, status.HTTP_201_CREATED)


# ------------------------------------------------------------------- cues


@api_view(["POST"])
@transaction.atomic
def cues(request: Request) -> Response:
    data = valid(api.CueIn, request.data)
    scene = get_scene(data["sceneId"])
    audio = get_audio(data["audioId"])
    cue = Cue.objects.create(
        id=new_id("c"),
        scene=scene,
        audio=audio,
        cue=data["cue"],
        order=next_order(scene.cues),
        key=data["key"] or None,
        volume=data["volume"],
        loop=data["loop"],
    )
    return ok(api.CueOut(cue).data, status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@transaction.atomic
def cue_detail(request: Request, cue_id: str) -> Response:
    cue = get_cue(cue_id)

    if request.method == "PATCH":
        data = valid(api.CuePatch, request.data)
        origin = cue.scene_id
        if "sceneId" in data:
            cue.scene = get_scene(data["sceneId"])
        if "audioId" in data:
            cue.audio = get_audio(data["audioId"])
        for field in ("cue", "volume", "loop", "order"):
            if field in data:
                setattr(cue, field, data[field])
        if "key" in data:
            cue.key = data["key"] or None
        cue.save()
        if cue.scene_id != origin:
            densify(Cue.objects.filter(scene_id=origin))
            densify(Cue.objects.filter(scene_id=cue.scene_id))
        return ok(api.CueOut(cue).data)

    body = api.CueOut(cue).data
    scene_id = cue.scene_id
    cue.delete()
    densify(Cue.objects.filter(scene_id=scene_id))
    return ok(body)


@api_view(["POST"])
@transaction.atomic
def cues_restore(request: Request) -> Response:
    """Reinsere cues removidos na posição original — o desfazer do aviso."""
    _restore_cues(valid(api.RestoreCuesIn, request.data)["cues"])
    return done()


@api_view(["POST"])
@transaction.atomic
def cues_reorder(request: Request) -> Response:
    data = valid(api.Reorder, request.data)
    scene = get_scene(_required(request.data, "scene", "cena"))
    apply_order(scene.cues, data["ids"])
    return done()


# ------------------------------------------------------------- biblioteca


@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser])
@transaction.atomic
def audios(request: Request) -> Response:
    upload = request.FILES.get("file")
    if upload is None:
        raise Invalid("nenhum arquivo de áudio foi enviado")

    stem, _, suffix = upload.name.rpartition(".")
    audio = Audio(
        id=new_id("a"),
        name=str(request.data.get("name") or stem or upload.name).strip(),
        description="",
        format=suffix.upper() or "ÁUDIO",
        size=upload.size,
    )
    audio.file.save(upload.name, upload, save=False)
    audio.duration = services.measure(audio.file.path)
    audio.save()
    return ok(api.AudioOut(audio).data, status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@transaction.atomic
def audio_detail(request: Request, audio_id: str) -> Response:
    audio = get_audio(audio_id)

    if request.method == "PATCH":
        for field, value in valid(api.AudioPatch, request.data).items():
            setattr(audio, field, value)
        audio.save()
        return ok(api.AudioOut(audio).data)

    # O arquivo não é apagado agora: enquanto a janela de desfazer estiver
    # aberta ele continua no disco, senão o "Desfazer" do aviso seria mentira.
    cues = list(audio.cues.all())
    bundle = {
        "audio": api.AudioOut(audio).data,
        "cues": api.CueOut(cues, many=True).data,
    }
    scene_ids = {cue.scene_id for cue in cues}
    audio.cues.all().delete()
    audio.deleted_at = timezone.now()
    audio.save(update_fields=["deleted_at"])
    services.reindex_cues_of(scene_ids)
    return ok(bundle)


@api_view(["POST"])
@transaction.atomic
def audios_restore(request: Request) -> Response:
    """Traz o áudio e seus cues de volta, dentro da janela de desfazer."""
    data = valid(api.RestoreAudioIn, request.data)
    audio = get_audio(data["audio"], deleted=True)

    audio.deleted_at = None
    audio.save(update_fields=["deleted_at"])
    _restore_cues(data["cues"])
    return done()


# ------------------------------------------------------------------ apoio


def _required(data, field: str, label: str) -> str:
    value = data.get(field)
    if not value:
        raise Invalid(f"o corpo da requisição não trouxe a {label}")
    return str(value)


def _restore_days(days_data, scenes_data, cues_data, *, show: Show) -> None:
    """Recria dias, cenas e cues de uma peça restaurada, com os ids originais."""
    days = {
        item["id"]: Day(
            id=item["id"],
            show=show,
            name=item["name"],
            date=item["date"],
            order=item["order"],
        )
        for item in days_data
        if item["showId"] == show.pk
    }
    Day.objects.bulk_create(days.values())
    _restore_scenes(scenes_data, cues_data, days=days)


def _restore_scenes(scenes_data, cues_data, *, days: dict[str, Day]) -> None:
    scenes = {
        item["id"]: Scene(
            id=item["id"],
            day=days[item["dayId"]],
            name=item["name"],
            order=item["order"],
        )
        for item in scenes_data
        if item["dayId"] in days
    }
    Scene.objects.bulk_create(scenes.values())
    _restore_cues(cues_data, scenes=scenes)


def _restore_cues(cues_data, *, scenes: dict[str, Scene] | None = None) -> None:
    """
    Reinsere cues abrindo espaço na posição original de cada um.

    Cue órfão é descartado em silêncio: a cena ou o áudio pode ter sumido
    enquanto o aviso estava na tela, e falhar o desfazer inteiro por causa de
    uma linha seria pior do que devolver o resto. As cenas recém-restauradas
    chegam vazias, e por isso não precisam abrir espaço para nada.
    """
    fresh = scenes or {}
    audios = set(Audio.objects.values_list("pk", flat=True))
    pending: list[Cue] = []

    for item in cues_data:
        scene = fresh.get(item["sceneId"]) or Scene.objects.filter(pk=item["sceneId"]).first()
        if scene is None or item["audioId"] not in audios:
            continue
        if scene.pk not in fresh:
            open_slot(Cue.objects.filter(scene_id=scene.pk), item["order"])
        pending.append(
            Cue(
                id=item["id"],
                scene=scene,
                audio_id=item["audioId"],
                cue=item["cue"],
                order=item["order"],
                key=item["key"] or None,
                volume=item["volume"],
                loop=item["loop"],
            )
        )

    Cue.objects.bulk_create(pending)
    services.reindex_cues_of({cue.scene_id for cue in pending})
