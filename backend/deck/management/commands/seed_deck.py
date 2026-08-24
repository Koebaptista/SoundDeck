"""
Roteiro de exemplo do backend — o mesmo de `frontend/src/data/seed.ts`.

Existe para que trocar o mock pelo Django não signifique abrir o deck vazio: o
operador que já conhecia o exemplo encontra as mesmas quatro peças, com as
mesmas noites e as mesmas deixas, agora vindas do servidor. É também o que
torna a API testável de verdade — reordenar, duplicar e mover pedem um roteiro
com hierarquia, não duas linhas.

Os sete áudios são copiados de `frontend/public/audio`, gerados por
`scripts/gen-audio.mjs`. Nenhuma peça traz arquivo próprio: o trovão do
"Jardim" é o mesmo trovão d'"A Última Chuva", com outro volume e outra deixa.
"""

from __future__ import annotations

import datetime as dt
import shutil
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from deck.models import Audio, Cue, Day, Scene, Show
from deck.services import measure

AUDIOS = [
    ("a-campainha", "Campainha", "Ding-dong de porta de entrada, dois toques", "campainha.wav"),
    ("a-porta", "Porta batendo", "Batida seca com estalo de madeira", "porta.wav"),
    ("a-trovao", "Trovão", "Estalo próximo seguido de rolo grave", "trovao.wav"),
    ("a-passos", "Passos no assoalho", "Sete passos, andar sem pressa", "passos.wav"),
    ("a-vento", "Vento", "Rajada contínua, feita para rodar em loop", "vento.wav"),
    ("a-aplausos", "Aplausos", "Plateia cheia, entra e sai em rampa", "aplausos.wav"),
    (
        "a-musica",
        "Música de entrada",
        "Pad de quatro acordes — faixa longa, tocada por streaming",
        "musica-entrada.wav",
    ),
]

SHOWS = [
    ("p-jardim", "O Jardim de Inverno", "Teatro Municipal"),
    ("p-sarau", "Sarau de Poesia", "Centro Cultural"),
    ("p-natal", "Auto de Natal", "Escola Municipal Vila Nova"),
    ("p-chuva", "A Última Chuva", "Teatro do Sesc"),
]

#: (id, peça, nome, offset a partir da próxima sexta)
DAYS = [
    ("d-estreia", "p-jardim", "Estreia", 0),
    ("d-sabado", "p-jardim", "Sábado, 20h", 1),
    ("d-domingo", "p-jardim", "Domingo, sessão reduzida", 2),
    ("d-sexta-2", "p-jardim", "Sexta, segunda semana", 7),
    ("d-encerramento", "p-jardim", "Sábado, encerramento", 8),
    ("d-sarau", "p-sarau", "Noite única", 28),
    ("d-natal-tarde", "p-natal", "Sexta, sessão da tarde", 14),
    ("d-natal-noite", "p-natal", "Sábado, sessão da noite", 15),
    ("d-chuva-estreia", "p-chuva", "Estreia", 21),
    ("d-chuva-matine", "p-chuva", "Domingo, matinê", 23),
]

SCENES_JARDIM = [
    ("s-abertura", "Abertura"),
    ("s-entrada", "Entrada de Ana"),
    ("s-confronto", "Confronto"),
    ("s-final", "Final"),
]

#: (id, cena, áudio, deixa, tecla, volume, loop)
CUES_JARDIM = [
    ("c-1", "s-abertura", "a-musica", "Casa aberta, antes da terceira campainha", "1", 0.7, True),
    ("c-2", "s-abertura", "a-vento", "Luz baixa, cortina ainda fechada", "2", 0.45, True),
    ("c-3", "s-entrada", "a-campainha", "Ana atravessa a sala e toca a campainha", "1", 0.9, False),
    ("c-4", "s-entrada", "a-porta", "Ele sai e bate a porta", "2", 1.0, False),
    ("c-5", "s-entrada", "a-passos", "Passos no corredor, fora de cena", "3", 0.75, False),
    ("c-6", "s-confronto", "a-trovao", "Na deixa “nunca mais”", "1", 1.0, False),
    ("c-7", "s-confronto", "a-vento", "A janela se abre sozinha", "2", 0.6, True),
    ("c-8", "s-confronto", "a-porta", "Ela sai sem olhar para trás", "3", 1.0, False),
    ("c-9", "s-final", "a-aplausos", "Escurece total", "1", 0.8, False),
    ("c-10", "s-final", "a-musica", "Agradecimentos, luz de serviço", "2", 0.8, False),
]

SCENES_NATAL = [
    ("s-natal-pastores", "Chegada dos pastores"),
    ("s-natal-estrela", "A estrela"),
    ("s-natal-presepio", "Presépio"),
]

CUES_NATAL = [
    ("c-natal-1", "s-natal-pastores", "a-passos", "Os pastores entram pela plateia", "1", 0.7, False),
    ("c-natal-2", "s-natal-pastores", "a-campainha", "Sino da igreja, ao longe", "2", 0.5, False),
    ("c-natal-3", "s-natal-estrela", "a-musica", "A estrela desce e a luz azula", "1", 0.65, True),
    ("c-natal-4", "s-natal-estrela", "a-vento", "Noite fria no descampado", "2", 0.35, True),
    ("c-natal-5", "s-natal-presepio", "a-musica", "Coro das crianças, começo bem baixo", "1", 0.5, True),
    ("c-natal-6", "s-natal-presepio", "a-aplausos", "Todos de frente para a plateia", "2", 0.9, False),
]

SCENES_CHUVA = [
    ("s-chuva-antes", "Antes da tempestade"),
    ("s-chuva-carta", "A carta"),
    ("s-chuva-depois", "Depois da chuva"),
]

CUES_CHUVA = [
    ("c-chuva-1", "s-chuva-antes", "a-vento", "O céu fecha atrás da casa", "1", 0.55, True),
    ("c-chuva-2", "s-chuva-antes", "a-trovao", "Primeiro raio, ainda longe", "2", 0.8, False),
    ("c-chuva-3", "s-chuva-carta", "a-porta", "Ela entra encharcada e fecha a porta", "1", 1.0, False),
    ("c-chuva-4", "s-chuva-carta", "a-passos", "Ele sobe a escada devagar", "2", 0.6, False),
    ("c-chuva-5", "s-chuva-depois", "a-musica", "Luz da manhã na janela", "1", 0.7, True),
    ("c-chuva-6", "s-chuva-depois", "a-aplausos", "Escurece total", "2", 0.85, False),
]

SCENES_SARAU = [("s-sarau-abertura", "Chamada do público")]

CUES_SARAU = [
    ("c-sarau-1", "s-sarau-abertura", "a-musica", "Antes de abrir a sala", "1", 0.6, True),
    ("c-sarau-2", "s-sarau-abertura", "a-aplausos", "Fim de cada poema", "2", 0.8, False),
]

SCENES_HOMENAGEM = [("s-homenagem", "Homenagem ao elenco")]

CUES_HOMENAGEM = [
    ("c-homenagem-1", "s-homenagem", "a-aplausos", "Chamada nominal, um a um", "1", 1.0, False),
    ("c-homenagem-2", "s-homenagem", "a-musica", "Elenco de mãos dadas, luz baixando", "2", 0.65, True),
]


def from_friday(offset: int) -> dt.date:
    """
    Datas ancoradas na próxima sexta-feira, como no seed do frontend.

    Os dias se chamam "Sábado, 20h" e "Domingo, matinê"; se as datas flutuassem
    a partir de hoje, o nome e o dia da semana se contradiriam em cinco dias de
    sete — um exemplo que se desmente sozinho não prova nada.
    """
    today = dt.date.today()
    # `Date.getDay()` do JS conta domingo como 0; `weekday()` conta segunda.
    js_day = (today.weekday() + 1) % 7
    until_friday = (5 - js_day + 7) % 7 or 7
    return today + dt.timedelta(days=until_friday + offset)


class Command(BaseCommand):
    help = "Popula o banco com o roteiro de exemplo e os sete áudios da casa."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--force",
            action="store_true",
            help="Apaga o projeto existente antes de semear. Não pergunta duas vezes.",
        )
        parser.add_argument(
            "--audio-dir",
            default="",
            help="De onde copiar os WAVs (padrão: ../frontend/public/audio).",
        )

    @transaction.atomic
    def handle(self, *args, **options) -> None:
        occupied = Show.objects.exists() or Audio.objects.exists()
        if occupied and not options["force"]:
            raise CommandError(
                "o banco já tem conteúdo. Use --force para descartar e semear de novo."
            )
        if occupied:
            Cue.objects.all().delete()
            Scene.objects.all().delete()
            Day.objects.all().delete()
            Show.objects.all().delete()
            for audio in Audio.objects.all():
                audio.file.delete(save=False)
            Audio.objects.all().delete()

        source = Path(options["audio_dir"] or settings.BASE_DIR.parent / "frontend/public/audio")
        self.seed_audios(source)
        self.seed_shows()

        self.stdout.write(
            self.style.SUCCESS(
                f"Semeado: {Show.objects.count()} peças, {Day.objects.count()} dias, "
                f"{Scene.objects.count()} cenas, {Cue.objects.count()} cues, "
                f"{Audio.objects.count()} áudios."
            )
        )

    def seed_audios(self, source: Path) -> None:
        target = Path(settings.MEDIA_ROOT) / "audio"
        target.mkdir(parents=True, exist_ok=True)

        missing = [name for _, _, _, name in AUDIOS if not (source / name).exists()]
        if missing:
            raise CommandError(
                f"faltam os áudios de exemplo em {source}: {', '.join(missing)}.\n"
                "Rode `npm run audio:seed` no frontend — eles são gerados, não versionados."
            )

        for audio_id, name, description, filename in AUDIOS:
            destination = target / filename
            shutil.copyfile(source / filename, destination)
            Audio.objects.create(
                id=audio_id,
                name=name,
                description=description,
                file=f"audio/{filename}",
                duration=measure(destination),
                format=filename.rsplit(".", 1)[-1].upper(),
                size=destination.stat().st_size,
            )

    def seed_shows(self) -> None:
        Show.objects.bulk_create(
            Show(id=show_id, name=name, venue=venue, order=order)
            for order, (show_id, name, venue) in enumerate(SHOWS)
        )

        counters: dict[str, int] = {}
        for day_id, show_id, name, offset in DAYS:
            order = counters.get(show_id, 0)
            counters[show_id] = order + 1
            Day.objects.create(
                id=day_id,
                show_id=show_id,
                name=name,
                date=from_friday(offset),
                order=order,
            )

        # Cinco noites da mesma peça, e nenhuma idêntica por acaso: três repetem
        # o roteiro inteiro, domingo tem só os dois primeiros blocos porque é a
        # sessão curta, e o encerramento ganha um bloco a mais. É assim que uma
        # temporada de verdade se parece — e é o que o seletor de dia mostra.
        self.write_script("d-estreia", SCENES_JARDIM, CUES_JARDIM, "")
        self.write_script("d-sabado", SCENES_JARDIM, CUES_JARDIM, "-d2")
        self.write_script("d-domingo", SCENES_JARDIM[:2], CUES_JARDIM, "-d3")
        self.write_script("d-sexta-2", SCENES_JARDIM, CUES_JARDIM, "-d4")
        self.write_script("d-encerramento", SCENES_JARDIM + SCENES_HOMENAGEM, CUES_JARDIM + CUES_HOMENAGEM, "-d5")

        self.write_script("d-sarau", SCENES_SARAU, CUES_SARAU, "")

        self.write_script("d-natal-tarde", SCENES_NATAL, CUES_NATAL, "")
        self.write_script("d-natal-noite", SCENES_NATAL, CUES_NATAL, "-n2")

        self.write_script("d-chuva-estreia", SCENES_CHUVA, CUES_CHUVA, "")
        self.write_script("d-chuva-matine", SCENES_CHUVA, CUES_CHUVA, "-c2")

    def write_script(self, day_id: str, scenes, cues, suffix: str) -> None:
        """
        Escreve um roteiro dentro de um dia, opcionalmente como cópia.

        O sufixo é o que a segunda noite tem de diferente: id novo para cena e
        cue, apontando para a cena nova. Sem isso as duas noites editariam o
        mesmo cue — o mesmo cuidado que `duplicar dia` toma no modo montar.
        """
        keep = {scene_id for scene_id, _ in scenes}
        Scene.objects.bulk_create(
            Scene(id=f"{scene_id}{suffix}", day_id=day_id, name=name, order=order)
            for order, (scene_id, name) in enumerate(scenes)
        )

        counters: dict[str, int] = {}
        pending = []
        for cue_id, scene_id, audio_id, deixa, key, volume, loop in cues:
            if scene_id not in keep:
                continue
            order = counters.get(scene_id, 0)
            counters[scene_id] = order + 1
            pending.append(
                Cue(
                    id=f"{cue_id}{suffix}",
                    scene_id=f"{scene_id}{suffix}",
                    audio_id=audio_id,
                    cue=deixa,
                    order=order,
                    key=key,
                    volume=volume,
                    loop=loop,
                )
            )
        Cue.objects.bulk_create(pending)
