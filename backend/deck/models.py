"""
Modelo de domínio do SoundDeck — o mesmo de `frontend/src/types.ts`.

Vocabulário do teatro: peça, dia, cena, cue, deixa. A hierarquia é
peça → dia → cena → cue; a biblioteca de áudio fica fora dela, global ao
projeto, porque o mesmo trovão serve a duas peças em dois teatros.

Duas decisões estruturais atravessam o arquivo:

**Id é texto gerado aqui, não inteiro do banco.** O desfazer da interface
reinsere exatamente o que foi removido — a mesma cena, com o mesmo id, para
onde os cues restaurados apontam. Com id sequencial, restaurar seria criar
outra coisa parecida.

**Ordem é posição na lista, sempre densa.** `deck/ordering.py` reindexa o
grupo depois de cada escrita, para que remover a terceira cena não deixe um
buraco no roteiro.
"""

from __future__ import annotations

import random
import time

from django.db import models


def new_id(prefix: str) -> str:
    """
    Id legível e ordenável no tempo: `s-lx7k2p-a91f`.

    Mesmo formato do mock do frontend — o operador que migrar do localStorage
    para o Django não vê a troca, e um dump do banco continua legível.
    """
    stamp = _base36(int(time.time() * 1000))
    salt = "".join(random.choices("0123456789abcdefghijklmnopqrstuvwxyz", k=5))
    return f"{prefix}-{stamp}-{salt}"


def _base36(value: int) -> str:
    digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    out = ""
    while value:
        value, rest = divmod(value, 36)
        out = digits[rest] + out
    return out or "0"


class Show(models.Model):
    """Um espetáculo. O projeto guarda vários — a montagem deste mês e a que
    volta no ano que vem, em outro teatro, com outro roteiro."""

    id = models.CharField(primary_key=True, max_length=64)
    name = models.CharField(max_length=200)
    #: Onde acontece: "Teatro Municipal". É o que distingue duas montagens.
    venue = models.CharField(max_length=200, blank=True)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self) -> str:
        return self.name


class Day(models.Model):
    """Uma apresentação da peça. Três noites são três dias, e cada um carrega
    o próprio roteiro — na temporada corrida costumam ser iguais, no festival
    quase nunca são."""

    id = models.CharField(primary_key=True, max_length=64)
    show = models.ForeignKey(Show, related_name="days", on_delete=models.CASCADE)
    #: Rótulo livre: "Estreia", "Sábado 20h", "Sessão infantil".
    name = models.CharField(max_length=200)
    #: Nulo enquanto a data não está fechada — o que é comum na montagem.
    date = models.DateField(null=True, blank=True)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self) -> str:
        return f"{self.show.name} — {self.name}"


class Scene(models.Model):
    """Um bloco do roteiro de um dia. A ordem é a ordem do espetáculo."""

    id = models.CharField(primary_key=True, max_length=64)
    day = models.ForeignKey(Day, related_name="scenes", on_delete=models.CASCADE)
    name = models.CharField(max_length=200)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self) -> str:
        return self.name


class AudioQuerySet(models.QuerySet):
    def alive(self) -> "AudioQuerySet":
        return self.filter(deleted_at__isnull=True)


class Audio(models.Model):
    """
    Um arquivo da biblioteca. Reutilizável em várias cenas, dias e peças — quem
    carrega a configuração de disparo é o cue, não o áudio.

    A remoção é adiada, não imediata: o produto não pergunta "tem certeza?",
    ele desfaz. Enquanto `deleted_at` está preenchido o áudio some do deck mas
    o arquivo continua no disco, esperando o "Desfazer" do aviso; passada a
    janela, `purge_audios` apaga os dois de vez.
    """

    id = models.CharField(primary_key=True, max_length=64)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    file = models.FileField(upload_to="audio/")
    #: Segundos, lidos do arquivo no upload. O engine reconcilia depois.
    duration = models.FloatField(default=0)
    #: Extensão em maiúsculas: WAV, MP3, OGG.
    format = models.CharField(max_length=16, blank=True, default="")
    size = models.BigIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = AudioQuerySet.as_manager()

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self) -> str:
        return self.name

    @property
    def src(self) -> str:
        """Caminho relativo servível. O cliente resolve para URL absoluta."""
        return self.file.url if self.file else ""


class Cue(models.Model):
    """Liga uma cena a um áudio, com a configuração de disparo daquele momento."""

    id = models.CharField(primary_key=True, max_length=64)
    scene = models.ForeignKey(Scene, related_name="cues", on_delete=models.CASCADE)
    audio = models.ForeignKey(Audio, related_name="cues", on_delete=models.CASCADE)
    #: A deixa em cena: "quando o João bate a porta". É o que o operador procura.
    cue = models.TextField(blank=True, default="")
    order = models.IntegerField(default=0)
    #: Tecla resolvida dentro da cena ativa — `1` pode existir em toda cena.
    key = models.CharField(max_length=8, null=True, blank=True)
    #: 0..1, multiplicado pelo master no engine.
    volume = models.FloatField(default=1)
    loop = models.BooleanField(default=False)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self) -> str:
        return f"{self.audio.name} — {self.cue}"
