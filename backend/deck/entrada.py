"""
A pasta de entrada: o jeito de pôr coisas no deck sem abrir o deck.

A interface já sabe receber áudio, um a um, pelo botão da biblioteca. Isso
serve para acrescentar uma faixa no meio da montagem e não serve para começar:
quem chega com a trilha inteira de um espetáculo tem trinta arquivos numa pasta
e nenhuma vontade de clicar trinta vezes.

`entrada/` é essa porta. O que for largado ali entra no deck na próxima
abertura do aplicativo — arquivos de áudio viram itens da biblioteca, e um
`.sounddeck` substitui o espetáculo inteiro.

Na abertura, e não no instante em que o arquivo aparece: um vigia de pasta
precisaria decidir quando um arquivo terminou de ser copiado, e um MP3 lido
pela metade entra na biblioteca com duração errada e som cortado. A abertura
do aplicativo é um momento em que a cópia certamente terminou.
"""

from __future__ import annotations

import shutil
from pathlib import Path

from . import pacote

PASTA = "entrada"

#: Para onde vai o que já entrou. Apagar o arquivo do operador seria mais
#: limpo e é exatamente o que não se deve fazer: ele pode ter largado ali a
#: única cópia que tinha.
GUARDADOS = "ja-importados"

#: As mesmas extensões que a biblioteca aceita pelo botão de enviar.
AUDIOS = {".wav", ".mp3", ".ogg", ".m4a", ".flac", ".aac"}

LEIA_ME = """Pasta de entrada do SoundDeck
=============================

Largue arquivos aqui e abra o SoundDeck. O que estiver nesta pasta entra no
deck na abertura, e não enquanto o programa está aberto.

O que pode ser largado aqui:

  Arquivos de áudio (.wav .mp3 .ogg .m4a .flac .aac)
      Entram na Biblioteca, prontos para virar cues. O nome do arquivo vira
      o nome do áudio; dá para renomear depois, dentro do programa.

  Um arquivo .sounddeck
      É um espetáculo inteiro — roteiro e áudios — que alguem montou e
      exportou. Ele SUBSTITUI o que estiver no deck agora.
      O deck anterior nao e apagado: fica na pasta "anterior", ao lado desta.

Depois de entrar, os arquivos sao movidos para a pasta "{guardados}". Eles nao
sao apagados: se voce largou aqui a unica copia que tinha, ela continua ali.

Esta pasta e recriada sozinha. Pode apaga-la a vontade.
""".format(guardados=GUARDADOS)


def preparar(dados: Path) -> Path:
    """Garante a pasta e o bilhete que explica para que ela serve."""
    entrada = dados / PASTA
    entrada.mkdir(parents=True, exist_ok=True)
    leia_me = entrada / "LEIA-ME.txt"
    if not leia_me.is_file():
        leia_me.write_text(LEIA_ME, encoding="utf-8")
    return entrada


def guardar(entrada: Path, arquivo: Path) -> None:
    """Move para `ja-importados/`, sem passar por cima do que já está lá."""
    destino = entrada / GUARDADOS
    destino.mkdir(parents=True, exist_ok=True)
    alvo = destino / arquivo.name
    contador = 2
    while alvo.exists():
        alvo = destino / f"{arquivo.stem} ({contador}){arquivo.suffix}"
        contador += 1
    shutil.move(str(arquivo), str(alvo))


def pacotes(entrada: Path) -> list[Path]:
    """Os `.sounddeck` largados na entrada, do mais antigo para o mais novo."""
    achados = [p for p in entrada.iterdir() if p.is_file() and p.suffix == pacote.EXTENSAO]
    return sorted(achados, key=lambda p: p.stat().st_mtime)


def aplicar_pacotes(dados: Path) -> list[str]:
    """
    Substitui o deck pelos pacotes largados na entrada. **Antes do Django.**

    Roda cedo de propósito: aplicar um pacote é trocar o arquivo do SQLite, e
    isso não pode acontecer com o Django já segurando uma conexão aberta nele.

    Vários pacotes na pasta são aplicados na ordem em que chegaram, então o
    último a ser largado é o que fica — que é o que alguém esperaria de uma
    pasta onde se joga a versão nova por cima da antiga.
    """
    entrada = preparar(dados)
    relato: list[str] = []
    for arquivo in pacotes(entrada):
        try:
            pacote.aplicar(arquivo, dados)
        except pacote.PacoteInvalido as erro:
            relato.append(f"entrada: {arquivo.name} recusado — {erro}")
            continue
        # Sai da entrada para não ser reaplicado em toda abertura. `aplicar`
        # troca banco e mídia e não encosta nesta pasta, então o arquivo ainda
        # está aqui.
        guardar(entrada, arquivo)
        relato.append(f"entrada: espetáculo carregado de {arquivo.name}")
    return relato


def importar_audios(dados: Path) -> list[str]:
    """
    Põe na biblioteca os áudios largados na entrada. **Depois do `migrate`.**

    Precisa do ORM, e por isso importa os modelos aqui dentro em vez de no
    topo do arquivo: `aplicar_pacotes` roda antes de o Django existir, e um
    import de modelo no topo derrubaria o servidor antes de ele chegar lá.
    """
    from django.core.files import File

    from .models import Audio, new_id
    from .services import measure

    entrada = preparar(dados)
    relato: list[str] = []

    achados = sorted(
        p for p in entrada.iterdir() if p.is_file() and p.suffix.lower() in AUDIOS
    )
    for arquivo in achados:
        try:
            audio = Audio(
                id=new_id("a"),
                name=arquivo.stem.strip() or arquivo.name,
                description="",
                format=arquivo.suffix.lstrip(".").upper() or "ÁUDIO",
                size=arquivo.stat().st_size,
            )
            with arquivo.open("rb") as corpo:
                audio.file.save(arquivo.name, File(corpo), save=False)
            audio.duration = measure(audio.file.path)
            audio.save()
        except Exception as erro:  # noqa: BLE001 — um arquivo ruim não derruba a abertura
            relato.append(f"entrada: {arquivo.name} não entrou — {erro}")
            continue
        guardar(entrada, arquivo)
        relato.append(f"entrada: {arquivo.name} entrou na biblioteca")

    return relato
