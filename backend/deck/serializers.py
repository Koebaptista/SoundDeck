"""
Tradução entre o banco e o contrato de `frontend/src/types.ts`.

O cliente fala camelCase (`showId`, `dayId`, `sceneId`, `audioId`) e o Django
fala snake_case; a fronteira é aqui e em nenhum outro lugar. As classes `Out`
escrevem o JSON que o deck espera; as `In` recebem exatamente os corpos que
`apiRepo.ts` envia — inclusive as pequenas inconsistências dele, que são
contrato e não descuido (`{"show": id}` ao criar um dia, `{"sceneId": id}` ao
criar um cue).
"""

from __future__ import annotations

from rest_framework import serializers

from .models import Audio, Cue, Day, Scene, Show

# ---------------------------------------------------------------- saída


class ShowOut(serializers.ModelSerializer):
    class Meta:
        model = Show
        fields = ["id", "name", "venue", "order"]


class DayOut(serializers.ModelSerializer):
    showId = serializers.CharField(source="show_id")

    class Meta:
        model = Day
        fields = ["id", "showId", "name", "date", "order"]


class SceneOut(serializers.ModelSerializer):
    dayId = serializers.CharField(source="day_id")

    class Meta:
        model = Scene
        fields = ["id", "dayId", "name", "order"]


class CueOut(serializers.ModelSerializer):
    sceneId = serializers.CharField(source="scene_id")
    audioId = serializers.CharField(source="audio_id")

    class Meta:
        model = Cue
        fields = ["id", "sceneId", "audioId", "cue", "order", "key", "volume", "loop"]


class AudioOut(serializers.ModelSerializer):
    #: Caminho relativo (`/media/audio/...`); o cliente resolve o absoluto.
    src = serializers.CharField(read_only=True)

    class Meta:
        model = Audio
        fields = ["id", "name", "description", "src", "duration", "format", "size"]


# ---------------------------------------------------------------- entrada


class ShowIn(serializers.Serializer):
    name = serializers.CharField(max_length=200, allow_blank=True)
    venue = serializers.CharField(max_length=200, allow_blank=True, default="")


class ShowPatch(serializers.Serializer):
    name = serializers.CharField(max_length=200, allow_blank=True, required=False)
    venue = serializers.CharField(max_length=200, allow_blank=True, required=False)


class DayIn(serializers.Serializer):
    #: O cliente manda `show`, não `showId`, ao criar um dia.
    show = serializers.CharField()
    name = serializers.CharField(max_length=200, allow_blank=True)
    date = serializers.DateField(required=False, allow_null=True, default=None)


class DayPatch(serializers.Serializer):
    name = serializers.CharField(max_length=200, allow_blank=True, required=False)
    date = serializers.DateField(required=False, allow_null=True)


class DuplicateDayIn(serializers.Serializer):
    name = serializers.CharField(max_length=200, allow_blank=True)
    date = serializers.DateField(required=False, allow_null=True, default=None)


class SceneIn(serializers.Serializer):
    day = serializers.CharField()
    name = serializers.CharField(max_length=200, allow_blank=True)


class ScenePatch(serializers.Serializer):
    name = serializers.CharField(max_length=200, allow_blank=True)


class DayRef(serializers.Serializer):
    """Corpo de `mover cena` e `copiar cena`: só o dia de destino."""

    day = serializers.CharField()


class CueIn(serializers.Serializer):
    #: Aqui o cliente manda camelCase — é o corpo do próprio tipo `Cue`.
    sceneId = serializers.CharField()
    audioId = serializers.CharField()
    cue = serializers.CharField(allow_blank=True, default="")
    key = serializers.CharField(max_length=8, allow_null=True, allow_blank=True, default=None)
    volume = serializers.FloatField(min_value=0, max_value=1, default=1)
    loop = serializers.BooleanField(default=False)


class CuePatch(serializers.Serializer):
    sceneId = serializers.CharField(required=False)
    audioId = serializers.CharField(required=False)
    cue = serializers.CharField(allow_blank=True, required=False)
    key = serializers.CharField(
        max_length=8, allow_null=True, allow_blank=True, required=False
    )
    volume = serializers.FloatField(min_value=0, max_value=1, required=False)
    loop = serializers.BooleanField(required=False)
    order = serializers.IntegerField(min_value=0, required=False)


class AudioPatch(serializers.Serializer):
    name = serializers.CharField(max_length=200, allow_blank=True, required=False)
    description = serializers.CharField(allow_blank=True, required=False)


class Reorder(serializers.Serializer):
    ids = serializers.ListField(child=serializers.CharField(), allow_empty=True)


# --------------------------------------------------- entrada do desfazer
#
# As rotas `restore/` recebem de volta o que o `DELETE` devolveu: os objetos
# inteiros, com os ids originais. Reinserir com o mesmo id é o que faz o
# desfazer recompor a árvore, em vez de criar uma cópia parecida.


class ShowBody(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField(max_length=200, allow_blank=True)
    venue = serializers.CharField(max_length=200, allow_blank=True, default="")
    order = serializers.IntegerField(min_value=0, default=0)


class DayBody(serializers.Serializer):
    id = serializers.CharField()
    showId = serializers.CharField()
    name = serializers.CharField(max_length=200, allow_blank=True)
    date = serializers.DateField(allow_null=True, default=None)
    order = serializers.IntegerField(min_value=0, default=0)


class SceneBody(serializers.Serializer):
    id = serializers.CharField()
    dayId = serializers.CharField()
    name = serializers.CharField(max_length=200, allow_blank=True)
    order = serializers.IntegerField(min_value=0, default=0)


class CueBody(serializers.Serializer):
    id = serializers.CharField()
    sceneId = serializers.CharField()
    audioId = serializers.CharField()
    cue = serializers.CharField(allow_blank=True, default="")
    order = serializers.IntegerField(min_value=0, default=0)
    key = serializers.CharField(max_length=8, allow_null=True, allow_blank=True, default=None)
    volume = serializers.FloatField(min_value=0, max_value=1, default=1)
    loop = serializers.BooleanField(default=False)


class RestoreShowIn(serializers.Serializer):
    show = ShowBody()
    days = DayBody(many=True, default=list)
    scenes = SceneBody(many=True, default=list)
    cues = CueBody(many=True, default=list)


class RestoreDayIn(serializers.Serializer):
    day = DayBody()
    scenes = SceneBody(many=True, default=list)
    cues = CueBody(many=True, default=list)


class RestoreSceneIn(serializers.Serializer):
    scene = SceneBody()
    cues = CueBody(many=True, default=list)


class RestoreCuesIn(serializers.Serializer):
    cues = CueBody(many=True, default=list)


class RestoreAudioIn(serializers.Serializer):
    #: Só o id: o arquivo e os metadados continuam no servidor até a janela
    #: de desfazer fechar (ver `Audio.deleted_at`).
    audio = serializers.CharField()
    cues = CueBody(many=True, default=list)
