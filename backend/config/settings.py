"""
Configuração do SoundDeck.

Um servidor local, um operador, sem contas — as escolhas daqui seguem esse
recorte do `BRIEF.md`: sem autenticação, sem sessão, SQLite ao lado do
`manage.py`, e mídia servida pelo próprio Django porque não existe um nginx
na coxia do teatro.

O que varia de máquina para máquina vem de `.env` (ver `.env.example`).
"""

from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import unquote, urlparse

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")

# A separação entre o que é do programa e o que é do operador.
#
# `BASE_DIR` é onde mora o código; no repositório o banco e os áudios ficam ao
# lado dele, e nada disso incomoda. Dentro do aplicativo instalado o código vai
# parar numa pasta de programa que o Windows não deixa escrever — e um deck que
# não consegue gravar o SQLite não abre. `SOUNDDECK_DATA` é a saída: o Electron
# aponta para a pasta do usuário antes de subir o servidor.
DATA_DIR = Path(os.getenv("SOUNDDECK_DATA") or BASE_DIR)
DATA_DIR.mkdir(parents=True, exist_ok=True)

# A interface já compilada, quando ela existe. No desenvolvimento quem serve o
# deck é o Vite e esta pasta não está aqui; no aplicativo ela vem dentro do
# pacote, e o Django entrega interface e API pela mesma porta — uma origem só,
# nenhum CORS no caminho.
SPA_DIR = BASE_DIR / "spa"


def env_list(name: str, default: str) -> list[str]:
    """Lista separada por vírgula, ignorando espaços e itens vazios."""
    return [item.strip() for item in os.getenv(name, default).split(",") if item.strip()]


def env_bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


# Sem login e sem dado de terceiro, a chave só assina mensagens do admin. Ainda
# assim ela sai do .env quando existir, para não virar segredo versionado.
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-inseguro-troque-no-.env")

DEBUG = env_bool("DJANGO_DEBUG", True)

ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "127.0.0.1,localhost,0.0.0.0")

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "deck",
]

# Sem sessão, sem autenticação e sem CSRF: a API é aberta de propósito, para uma
# máquina só. Publicar isso numa rede aberta é decisão de quem publica.
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {"context_processors": []},
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"


def database_from_url(url: str) -> dict[str, object]:
    """
    Traduz uma `DATABASE_URL` de Postgres para o dicionário do Django.

    Existe para quem já tem um Postgres rodando; o padrão continua sendo o
    SQLite do lado do `manage.py`, que é o que um deck de teatro precisa.
    """
    parsed = urlparse(url)
    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": parsed.path.lstrip("/"),
        "USER": unquote(parsed.username or ""),
        "PASSWORD": unquote(parsed.password or ""),
        "HOST": parsed.hostname or "",
        "PORT": str(parsed.port or ""),
    }


DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

# Duas escritas ao mesmo tempo — reordenar uma cena e renomear outra — chegam
# ao SQLite como uma transação de leitura querendo virar de escrita, e essa
# promoção não espera na fila: ela falha na hora com "database is locked".
# `IMMEDIATE` faz cada transação já nascer de escrita, então a segunda aguarda
# em vez de estourar. O `timeout` é essa espera. Nada disso é perceptível numa
# máquina só, e é o que separa o deck de um 500 no meio da peça quando o disco
# é mais lento que o local — um volume montado do Windows dentro do Docker, por
# exemplo, onde o lock do arquivo custa caro.
SQLITE_OPTIONS = {
    "timeout": 15,
    "transaction_mode": "IMMEDIATE",
}

DATABASES = {
    "default": (
        database_from_url(DATABASE_URL)
        if DATABASE_URL
        else {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": DATA_DIR / "sounddeck.sqlite3",
            "OPTIONS": SQLITE_OPTIONS,
        }
    )
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

LANGUAGE_CODE = "pt-br"
TIME_ZONE = os.getenv("DJANGO_TIME_ZONE", "America/Sao_Paulo")
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"

MEDIA_URL = "/media/"
MEDIA_ROOT = DATA_DIR / "media"

# Arquivo de áudio de peça inteira cabe em disco, não em memória: acima deste
# tamanho o upload é transmitido direto para um arquivo temporário.
FILE_UPLOAD_MAX_MEMORY_SIZE = 4 * 1024 * 1024
DATA_UPLOAD_MAX_MEMORY_SIZE = 4 * 1024 * 1024

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "EXCEPTION_HANDLER": "deck.errors.handler",
    "UNAUTHENTICATED_USER": None,
}

# O Vite serve em 5173; o `crossOrigin="anonymous"` do engine de áudio faz o
# navegador exigir estes cabeçalhos até nos arquivos de /media.
CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ORIGINS",
    "http://127.0.0.1:5173,http://localhost:5173",
)

# Em desenvolvimento, qualquer porta local serve: o Vite pula para 5174 sozinho
# quando a 5173 está ocupada, e um deck que não carrega por causa disso manda o
# operador procurar o erro no lugar errado. Com DEBUG=False vale só a lista.
if DEBUG:
    CORS_ALLOWED_ORIGIN_REGEXES = [r"^http://(127\.0\.0\.1|localhost):\d+$"]

# Quanto tempo um áudio removido continua no disco esperando o "Desfazer" do
# aviso. Precisa ser bem maior que a janela da interface (12s).
UNDO_WINDOW_SECONDS = int(os.getenv("SOUNDDECK_UNDO_WINDOW", "3600"))

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}
