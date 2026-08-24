"""
As operações que mexem em mais de uma tabela.

Duplicar peça, duplicar dia e copiar cena são a mesma operação vista de três
alturas: levar um punhado de cenas, com os cues delas, para dentro de um dia.
O detalhe que não pode falhar é o id — a cópia precisa de ids novos e de cues
apontando para as cenas novas, senão as duas noites passam a editar o mesmo
cue e o operador descobre isso no palco.
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path

from django.conf import settings
from django.utils import timezone

from .models import Audio, Cue, Day, Scene, Show, new_id
from .ordering import densify, next_order


def copy_into(scenes: list[Scene], cues: list[Cue], day: Day) -> list[Scene]:
    """
    Copia cenas e seus cues para o fim do roteiro de `day`.

    Devolve as cenas criadas, na mesma ordem relativa da origem.
    """
    start = next_order(day.scenes)
    by_scene: dict[str, list[Cue]] = {}
    for cue in cues:
        by_scene.setdefault(cue.scene_id, []).append(cue)

    created: list[Scene] = []
    new_cues: list[Cue] = []
    for offset, scene in enumerate(sorted(scenes, key=lambda s: (s.order, s.pk))):
        copy = Scene(id=new_id("s"), day=day, name=scene.name, order=start + offset)
        created.append(copy)
        for index, cue in enumerate(sorted(by_scene.get(scene.pk, []), key=lambda c: c.order)):
            new_cues.append(
                Cue(
                    id=new_id("c"),
                    scene=copy,
                    audio_id=cue.audio_id,
                    cue=cue.cue,
                    order=index,
                    key=cue.key,
                    volume=cue.volume,
                    loop=cue.loop,
                )
            )
    Scene.objects.bulk_create(created)
    Cue.objects.bulk_create(new_cues)
    return created


def copy_day(source: Day, target: Day) -> None:
    """Leva o roteiro inteiro de um dia para outro — cenas e cues."""
    scenes = list(source.scenes.all())
    cues = list(Cue.objects.filter(scene__in=scenes))
    copy_into(scenes, cues, target)


def duplicate_show(source: Show, name: str, venue: str) -> Show:
    """A mesma peça em outro teatro: todos os dias, com todo o roteiro."""
    show = Show.objects.create(
        id=new_id("p"),
        name=name,
        venue=venue,
        order=next_order(Show.objects.all()),
    )
    for index, day in enumerate(source.days.all()):
        copy = Day.objects.create(
            id=new_id("d"),
            show=show,
            name=day.name,
            date=day.date,
            order=index,
        )
        copy_day(day, copy)
    return show


def reindex_scenes_of(day_ids: set[str]) -> None:
    for day_id in day_ids:
        densify(Scene.objects.filter(day_id=day_id))


def reindex_cues_of(scene_ids: set[str]) -> None:
    for scene_id in scene_ids:
        densify(Cue.objects.filter(scene_id=scene_id))


def measure(source: Path | str) -> float:
    """
    Duração em segundos, lida do arquivo enviado.

    É metadado de exibição — o operador precisa distinguir um efeito de 2s de
    uma música de 8min antes de armar. Se nem o `mutagen` nem a leitura crua do
    WAV souberem responder, zero: o engine mede de novo ao decodificar e
    corrige a tela. Nunca é motivo para recusar o upload.
    """
    path = Path(source)
    try:
        from mutagen import File as MutagenFile

        media = MutagenFile(str(path))
        if media is not None and media.info is not None:
            seconds = float(media.info.length)
            if seconds > 0:
                return round(seconds, 3)
    except Exception:
        pass
    return wav_duration(path)


def wav_duration(source: Path | str) -> float:
    """
    Duração de um WAV medida pelos bytes, ignorando o tamanho declarado.

    Existe porque cabeçalho mentiroso é comum: exportadores que gravam em
    streaming — e o `gen-audio.mjs` do frontend — deixam o campo de tamanho do
    bloco `data` zerado. O navegador toca assim mesmo, lendo até o fim do
    arquivo, mas toda biblioteca que confia no cabeçalho devolve 0:00 e a
    biblioteca do operador fica sem duração nenhuma. Aqui os bytes mandam.
    """
    import struct

    path = Path(source)
    try:
        with path.open("rb") as handle:
            head = handle.read(12)
            if len(head) < 12 or head[:4] != b"RIFF" or head[8:12] != b"WAVE":
                return 0.0

            total = path.stat().st_size
            byte_rate = 0
            while True:
                header = handle.read(8)
                if len(header) < 8:
                    return 0.0
                chunk, size = struct.unpack("<4sI", header)
                start = handle.tell()
                if chunk == b"fmt ":
                    fmt = handle.read(min(size, 16))
                    if len(fmt) < 16:
                        return 0.0
                    byte_rate = struct.unpack("<I", fmt[8:12])[0]
                elif chunk == b"data":
                    # O tamanho declarado só vale se couber no arquivo; senão o
                    # áudio é tudo que vem daqui até o fim.
                    length = size if 0 < size <= total - start else total - start
                    return round(length / byte_rate, 3) if byte_rate else 0.0
                handle.seek(start + size + (size % 2))
    except Exception:
        return 0.0


def purge_audios() -> int:
    """
    Apaga de vez os áudios cuja janela de desfazer já fechou.

    Roda no carregamento do deck, que é o único momento sem pressa: durante a
    peça o servidor não é chamado, e limpar disco no caminho de um disparo
    seria trocar segurança por latência.
    """
    limit = timezone.now() - dt.timedelta(seconds=settings.UNDO_WINDOW_SECONDS)
    expired = Audio.objects.filter(deleted_at__isnull=False, deleted_at__lt=limit)
    count = 0
    for audio in expired:
        audio.file.delete(save=False)
        audio.delete()
        count += 1
    return count
