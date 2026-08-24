"""
O espetáculo inteiro como um arquivo só: o formato `.sounddeck`.

Um deck é duas coisas em disco — o banco, com peças, dias, cenas e cues, e a
pasta de áudio. Separadas elas não viajam: mandar o banco sem os arquivos é
mandar um roteiro de cues mudos. O `.sounddeck` é um zip com as duas dentro, e
existe para atravessar a distância entre quem monta o espetáculo e quem vai
operá-lo.

O mesmo arquivo serve a três caminhos, e é isso que justifica ele existir:

- **exportado** pelo botão da biblioteca, para mandar por Drive ou WhatsApp
- **importado** pela pasta de entrada, ao abrir o deck
- **embutido** no instalador, para o aplicativo já nascer com o espetáculo

Quem recebe não precisa saber de nada disso. Instala e o roteiro está lá.
"""

from __future__ import annotations

import datetime as dt
import json
import shutil
import sqlite3
import zipfile
from pathlib import Path

EXTENSAO = ".sounddeck"

#: Os dois nomes que definem o formato. O banco é obrigatório; sem ele o
#: arquivo pode ser qualquer zip, e aplicá-lo apagaria o deck de quem abriu.
BANCO = "sounddeck.sqlite3"
MIDIA = "media"
MANIFESTO = "pacote.json"

FORMATO = 1

#: Onde o deck substituído por uma importação vai parar. Um nível de desfazer,
#: e é de propósito que não sejam vários: o operador que precisa de histórico
#: guarda os `.sounddeck` que exportou, que é o lugar certo para isso.
ANTERIOR = "anterior"


class PacoteInvalido(Exception):
    """O arquivo não é um `.sounddeck` — ou é um zip sem o banco dentro."""


def montar(dados: Path, destino: Path, resumo: dict | None = None) -> Path:
    """
    Escreve em `destino` o deck que está em `dados`.

    O banco não é copiado como arquivo. Um SQLite aberto por um servidor que
    está rodando pode ser fotografado no meio de uma escrita, e o retrato sai
    com meia transação dentro — o `.backup` do próprio SQLite espera o momento
    coerente e entrega um banco que abre limpo do outro lado.

    A mídia entra sem compressão. MP3, OGG e M4A já são formatos comprimidos:
    passá-los pelo deflate gasta minutos de CPU para economizar quase nada, e o
    que muda de verdade no tamanho do pacote é o áudio, não o banco.
    """
    destino.parent.mkdir(parents=True, exist_ok=True)
    banco = dados / BANCO
    midia = dados / MIDIA

    with zipfile.ZipFile(destino, "w") as pacote:
        pacote.writestr(
            MANIFESTO,
            json.dumps(
                {
                    "formato": FORMATO,
                    "criado": dt.datetime.now().astimezone().isoformat(timespec="seconds"),
                    **(resumo or {}),
                },
                ensure_ascii=False,
                indent=2,
            ),
            compress_type=zipfile.ZIP_DEFLATED,
        )

        if banco.is_file():
            retrato = destino.with_suffix(".retrato.tmp")
            try:
                _fotografar(banco, retrato)
                pacote.write(retrato, BANCO, compress_type=zipfile.ZIP_DEFLATED)
            finally:
                retrato.unlink(missing_ok=True)

        if midia.is_dir():
            for arquivo in sorted(midia.rglob("*")):
                if arquivo.is_file():
                    interno = Path(MIDIA) / arquivo.relative_to(midia)
                    pacote.write(arquivo, interno.as_posix(), compress_type=zipfile.ZIP_STORED)

    return destino


def _fotografar(banco: Path, destino: Path) -> None:
    """Cópia coerente do SQLite, mesmo com o servidor escrevendo nele."""
    origem = sqlite3.connect(f"file:{banco}?mode=ro", uri=True)
    try:
        copia = sqlite3.connect(str(destino))
        try:
            origem.backup(copia)
        finally:
            copia.close()
    finally:
        origem.close()


def conferir(caminho: Path) -> None:
    """Levanta `PacoteInvalido` se o arquivo não for um deck de verdade."""
    if not zipfile.is_zipfile(caminho):
        raise PacoteInvalido("o arquivo não é um pacote do SoundDeck")
    with zipfile.ZipFile(caminho) as pacote:
        nomes = pacote.namelist()
        if BANCO not in nomes:
            raise PacoteInvalido("o pacote não tem o roteiro dentro")
        # Zip com caminho absoluto ou com `..` escreveria fora da pasta de
        # dados. Nenhum pacote nosso tem isso; um arquivo trocado no caminho,
        # sim.
        for nome in nomes:
            if nome.startswith("/") or ".." in Path(nome).parts:
                raise PacoteInvalido(f"o pacote tem um caminho suspeito: {nome}")


def aplicar(caminho: Path, dados: Path) -> None:
    """
    Substitui o deck de `dados` pelo que está no pacote.

    Só pode ser chamado **antes de o Django abrir o banco** — trocar o arquivo
    do SQLite debaixo de uma conexão aberta é o tipo de coisa que o Windows
    recusa e que, quando não recusa, corrompe. Por isso o caminho da
    importação passa pela pasta de entrada e pela reabertura do aplicativo, em
    vez de acontecer no meio de uma requisição.

    O deck que estava aqui não é apagado: vai para `anterior/`, que é um nível
    de desfazer para quem importou o pacote errado.
    """
    conferir(caminho)

    anterior = dados / ANTERIOR
    shutil.rmtree(anterior, ignore_errors=True)
    anterior.mkdir(parents=True, exist_ok=True)

    banco = dados / BANCO
    midia = dados / MIDIA
    if banco.is_file():
        _mover_com_paciencia(banco, anterior / BANCO)
    if midia.is_dir():
        _mover_com_paciencia(midia, anterior / MIDIA)

    # Os arquivos auxiliares do SQLite não podem sobreviver ao banco que
    # descreviam: um `-wal` órfão ao lado de um banco novo é corrupção na
    # próxima abertura.
    for sufixo in ("-wal", "-shm", "-journal"):
        (dados / f"{BANCO}{sufixo}").unlink(missing_ok=True)

    with zipfile.ZipFile(caminho) as pacote:
        for nome in pacote.namelist():
            if nome == MANIFESTO or nome.endswith("/"):
                continue
            pacote.extract(nome, dados)


def _mover_com_paciencia(origem: Path, destino: Path, tentativas: int = 25) -> None:
    """
    Move insistindo, porque o arquivo pode estar ocupado por um instante.

    O caso é o "Reabrir agora" da importação: o aplicativo se relança, e por
    uma fração de segundo convivem o servidor que está morrendo e o que está
    nascendo. No Linux renomear um arquivo aberto por outro processo é normal;
    no Windows é um erro de permissão — e ele acontece justamente quando o
    operador acabou de mandar trazer o espetáculo.

    Dois segundos e meio de teimosia resolvem uma corrida que dura milésimos.
    Passado esse prazo o erro sobe, porque aí não é corrida: é outra coisa
    segurando o arquivo, e insistir calado só esconderia o motivo.
    """
    import time

    for restantes in range(tentativas, 0, -1):
        try:
            origem.replace(destino)
            return
        except PermissionError:
            if restantes == 1:
                raise
            time.sleep(0.1)


def ler_manifesto(caminho: Path) -> dict:
    """O que o pacote diz sobre si mesmo. Nunca levanta — é só informação."""
    try:
        with zipfile.ZipFile(caminho) as pacote:
            return json.loads(pacote.read(MANIFESTO).decode("utf-8"))
    except Exception:
        return {}
