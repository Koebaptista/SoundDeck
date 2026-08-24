"""
O servidor do SoundDeck como ele roda dentro do aplicativo de mesa.

Fora daqui existem duas formas de subir o Django: o `runserver` do
desenvolvimento e o `docker compose`. Nenhuma das duas serve para o computador
do teatro — a primeira é servidor de desenvolvimento, a segunda pede Docker
instalado. Este arquivo é a terceira: um processo só, sem dependência externa,
que o Electron acende antes de abrir a janela e apaga quando ela fecha.

Ele é também o arquivo que o PyInstaller congela. Tudo que precisa acontecer
antes do Django existir acontece aqui, na ordem: as saídas viram arquivo de
log, a pasta de dados é decidida, a chave é criada uma vez e guardada, e só
então `django.setup()` roda. Inverter essa ordem quebra de um jeito difícil de
ver — o `LOGGING` do `settings.py` prende `sys.stderr` no momento em que é
lido, e depois disso não há mais como redirecionar o log do Django.
"""

from __future__ import annotations

import os
import secrets
import socket
import sys
import threading
from pathlib import Path

PADRAO_PORTA = 8000

#: Códigos de saída que o Electron distingue. Porta ocupada ele resolve
#: sozinho, tentando outra; o resto é erro para mostrar ao operador.
SAIDA_PORTA_OCUPADA = 3
SAIDA_FALHA = 1


def pasta_de_dados() -> Path:
    """
    Onde ficam o banco e os áudios — o material do operador, não o programa.

    O Electron manda o caminho em `SOUNDDECK_DATA`. O padrão daqui existe para
    quando alguém roda este arquivo na mão, testando o executável fora da
    janela, e é o mesmo lugar que o Electron escolhe: `%LOCALAPPDATA%`, que ao
    contrário de `Documentos` não está sincronizado com nuvem nenhuma. Um
    OneDrive tentando subir o SQLite enquanto o deck escreve nele é exatamente
    o tipo de "database is locked" que aparece no meio da peça.
    """
    escolhido = os.getenv("SOUNDDECK_DATA")
    if escolhido:
        return Path(escolhido)
    local = os.getenv("LOCALAPPDATA") or os.path.expanduser("~")
    return Path(local) / "SoundDeck"


def redirecionar_saidas(destino: Path) -> None:
    """
    Manda as saídas do servidor empacotado para um arquivo.

    Um `.exe` com `console=False` não tem tela para escrever, e o Electron
    ainda descarta o que ele produzir. As duas coisas juntas fazem deste
    arquivo a única testemunha de uma abertura que falhou — é o que se pede a
    um amigo quando o deck não abre na máquina dele.

    A condição é ser empacotado, e não "`sys.stdout` é `None`", que era o teste
    óbvio e está errado: o Electron abre o processo com a saída apontada para o
    dispositivo nulo do Windows, e isso é um `sys.stdout` perfeitamente válido
    que engole tudo em silêncio. Rodando pelo `python server.py`, nada disso
    vale e o console continua sendo o console.

    O arquivo é reaberto a cada subida em vez de crescer para sempre: o que
    interessa é a sessão que falhou, não o histórico.
    """
    if not getattr(sys, "frozen", False):
        return
    handle = open(destino, "w", encoding="utf-8", buffering=1, errors="replace")
    sys.stdout = handle
    sys.stderr = handle


def chave_secreta(pasta: Path) -> str:
    """
    Uma chave por instalação, criada na primeira subida e guardada em disco.

    O deck não tem login nem sessão, então ela quase não faz trabalho. Mas
    embutir a mesma chave em todas as cópias distribuídas é o tipo de padrão
    que envelhece mal — no dia em que alguém puser o deck numa rede, a chave
    já é individual.
    """
    arquivo = pasta / "chave-secreta"
    if not arquivo.is_file():
        arquivo.write_text(secrets.token_urlsafe(50), encoding="utf-8")
    return arquivo.read_text(encoding="utf-8").strip()


def vigiar_o_pai() -> None:
    """
    Derruba o servidor quando o Electron morre.

    O Electron mata este processo ao fechar a janela, e no caminho normal isso
    basta. O caminho anormal é o que preocupa: se o Electron for encerrado à
    força, o servidor fica órfão — segurando a porta e o banco, invisível na
    tela, e a próxima abertura do deck falha sem explicar por quê.

    A trava é o `stdin`, que é um cano vindo do Electron. Enquanto ele estiver
    vivo a leitura fica parada; no instante em que ele morre o Windows fecha a
    outra ponta e a leitura devolve vazio. Ler o descritor 0 direto, e não
    `sys.stdin`, porque num executável sem console o segundo pode não existir.
    """

    def esperar() -> None:
        try:
            while os.read(0, 1):
                pass
        except OSError:
            return  # Sem cano: rodando na mão, e aí não há pai para vigiar.
        os._exit(0)

    threading.Thread(target=esperar, daemon=True).start()


def pacote_embutido() -> Path | None:
    """
    O espetáculo que veio dentro do instalador, se veio algum.

    É como um deck chega pronto na máquina de quem nunca montou nada: quem
    montou exporta um `.sounddeck`, deixa em `desktop/espetaculo.sounddeck` e
    constrói o instalador. O arquivo viaja dentro do executável e é aplicado
    uma única vez, na primeira abertura — depois disso o deck é de quem opera,
    e reaplicá-lo apagaria os ajustes dela toda vez que abrisse o programa.
    """
    if getattr(sys, "frozen", False):
        candidato = Path(getattr(sys, "_MEIPASS", ".")) / "espetaculo.sounddeck"
    else:
        candidato = Path(__file__).resolve().parent.parent / "desktop" / "espetaculo.sounddeck"
    return candidato if candidato.is_file() else None


def preparar_dados(pasta: Path) -> list[str]:
    """
    Tudo que mexe em arquivo do deck, antes de o Django abrir o banco.

    A ordem aqui é a regra inteira: aplicar um pacote é trocar o arquivo do
    SQLite, e isso só é seguro enquanto ninguém o abriu. Depois que
    `django.setup()` roda, a conexão existe e a troca vira corrupção — no
    Windows, quando não vira simplesmente um erro de arquivo em uso.
    """
    from deck import entrada, pacote

    relato: list[str] = []

    # Primeira abertura numa máquina nova: o espetáculo que veio no instalador
    # entra antes de qualquer coisa, para que a pasta de entrada ainda possa
    # ter a última palavra por cima dele.
    if not (pasta / pacote.BANCO).is_file():
        semente = pacote_embutido()
        if semente is not None:
            try:
                pacote.aplicar(semente, pasta)
                relato.append("primeira abertura: espetáculo que veio no instalador carregado")
            except pacote.PacoteInvalido as erro:
                relato.append(f"o espetáculo embutido foi recusado — {erro}")

    relato.extend(entrada.aplicar_pacotes(pasta))
    return relato


def porta_livre(porta: int) -> bool:
    """Confere se dá para abrir a porta antes de o Django ser construído."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as teste:
        teste.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            teste.bind(("127.0.0.1", porta))
        except OSError:
            return False
    return True


def main() -> int:
    pasta = pasta_de_dados()
    pasta.mkdir(parents=True, exist_ok=True)
    redirecionar_saidas(pasta / "servidor.log")
    vigiar_o_pai()

    porta = int(os.getenv("SOUNDDECK_PORT") or PADRAO_PORTA)
    if not porta_livre(porta):
        print(f"porta {porta} ocupada", file=sys.stderr)
        return SAIDA_PORTA_OCUPADA

    for linha in preparar_dados(pasta):
        print(linha, flush=True)

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    os.environ["SOUNDDECK_DATA"] = str(pasta)
    os.environ["DJANGO_SECRET_KEY"] = chave_secreta(pasta)
    # Não é o `runserver`: um traceback na tela do teatro não ajuda ninguém, e
    # a página de erro do Django expõe o disco inteiro de quem está operando.
    os.environ["DJANGO_DEBUG"] = "False"

    import django
    from django.core.management import call_command

    django.setup()

    # Idempotente, e a cada subida — a mesma escolha do `compose.yaml`. É o que
    # faz a primeira abertura na máquina de um amigo encontrar um banco pronto
    # em vez de uma tela de erro sobre tabelas que não existem.
    call_command("migrate", interactive=False, verbosity=1)

    # Depois do `migrate`, porque agora é o ORM que trabalha: cada arquivo de
    # áudio largado na entrada vira uma linha da biblioteca.
    from deck import entrada

    for linha in entrada.importar_audios(pasta):
        print(linha, flush=True)

    from waitress import serve

    from config.wsgi import application

    print(f"SoundDeck servindo em http://127.0.0.1:{porta}", flush=True)
    # Mais folga de threads do que parece necessário: cada faixa tocando segura
    # uma enquanto o navegador lê o trecho pedido, e uma cena cheia dispara
    # várias de uma vez. Thread parada em socket não custa nada; thread que
    # falta atrasa um cue.
    serve(application, host="127.0.0.1", port=porta, threads=24, ident="SoundDeck")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SystemExit:
        raise
    except Exception:
        import traceback

        traceback.print_exc()
        sys.exit(SAIDA_FALHA)
