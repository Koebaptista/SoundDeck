"""
Apaga do disco os áudios removidos cuja janela de desfazer já fechou.

O deck já faz isso sozinho a cada carregamento — este comando existe para as
duas situações em que ninguém vai abrir o deck tão cedo: liberar espaço depois
de uma temporada, e não esperar uma hora para conferir que a limpeza funciona.
"""

from __future__ import annotations

from django.core.management.base import BaseCommand

from deck.models import Audio
from deck.services import purge_audios


class Command(BaseCommand):
    help = "Remove definitivamente os áudios que já saíram da janela de desfazer."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--now",
            action="store_true",
            help="Não espera a janela fechar: apaga tudo que está removido.",
        )

    def handle(self, *args, **options) -> None:
        if options["now"]:
            removed = 0
            for audio in Audio.objects.filter(deleted_at__isnull=False):
                audio.file.delete(save=False)
                audio.delete()
                removed += 1
        else:
            removed = purge_audios()

        self.stdout.write(
            self.style.SUCCESS(f"{removed} áudio(s) apagado(s) de vez.")
            if removed
            else "Nada a apagar."
        )
