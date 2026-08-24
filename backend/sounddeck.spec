# -*- mode: python ; coding: utf-8 -*-
"""
Receita do PyInstaller para o servidor do SoundDeck.

Duas coisas exigem cuidado aqui, e as duas têm a mesma causa: o PyInstaller
descobre dependências lendo `import` no código, e o Django quase não usa
`import` para carregar o que carrega. Backend de banco, comando de `manage.py`,
migração, app instalado — tudo isso é string em `settings.py`, resolvida em
tempo de execução. O que o analisador não vê, ele não empacota, e o erro só
aparece no `.exe` do amigo, na forma de um `ModuleNotFoundError` sobre um
módulo que está bem ali no repositório.

Daí `collect_submodules`: varre o pacote inteiro e inclui tudo, sem depender de
alguém ter escrito o `import`. É generoso de propósito — alguns megabytes a
mais num instalador contra um deck que não abre.

Saída em diretório, não em arquivo único. Um `--onefile` se descompacta inteiro
num temporário a cada abertura, e são dezenas de megabytes antes de a janela
aparecer; o operador chega no teatro e espera. O diretório abre na hora, e o
instalador esconde isso de qualquer jeito.
"""

from pathlib import Path

from PyInstaller.utils.hooks import collect_data_files, collect_submodules

RAIZ = Path(SPECPATH)
SPA = RAIZ / "spa"

if not SPA.is_dir():
    raise SystemExit(
        "backend/spa/ não existe: rode `node desktop/scripts/build.mjs`, que "
        "compila o frontend e copia o resultado para cá antes de chamar o "
        "PyInstaller."
    )

ocultos = [
    *collect_submodules("django"),
    *collect_submodules("rest_framework"),
    *collect_submodules("corsheaders"),
    *collect_submodules("deck"),
    *collect_submodules("config"),
    *collect_submodules("waitress"),
    *collect_submodules("mutagen"),
]

dados = [
    # A interface compilada. `settings.SPA_DIR` a procura em `BASE_DIR / "spa"`,
    # e dentro do pacote `BASE_DIR` é justamente esta pasta de destino.
    (str(SPA), "spa"),
    *collect_data_files("django"),
    *collect_data_files("rest_framework"),
]

# O espetáculo que viaja dentro do instalador, quando existe um.
#
# Opcional de propósito: sem ele o aplicativo instala vazio, com a tela de
# primeiro uso. Com ele, quem instala já abre o programa com o roteiro e os
# áudios no lugar — que é como se manda um espetáculo pronto para alguém que
# nunca montou nada. `server.py` o aplica uma única vez, na primeira abertura.
ESPETACULO = RAIZ.parent / "desktop" / "espetaculo.sounddeck"
if ESPETACULO.is_file():
    dados.append((str(ESPETACULO), "."))

a = Analysis(
    [str(RAIZ / "server.py")],
    pathex=[str(RAIZ)],
    binaries=[],
    datas=dados,
    hiddenimports=ocultos,
    hookspath=[],
    runtime_hooks=[],
    # O deck roda em SQLite. O driver de Postgres existe no `requirements.txt`
    # para quem já tem um servidor de pé, e carrega binário próprio — não tem
    # o que fazer dentro de um aplicativo de mesa.
    excludes=["psycopg", "psycopg2", "tkinter", "PIL", "numpy"],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="sounddeck-server",
    debug=False,
    strip=False,
    upx=False,
    # Sem console: quem abre o deck é o Electron, e uma janela preta de terminal
    # piscando atrás da interface não faz parte do produto. É o que obriga o
    # `server.py` a redirecionar as saídas para arquivo antes de tudo.
    console=False,
)

COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name="sounddeck-server",
)
