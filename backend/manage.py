#!/usr/bin/env python
"""Ponto de entrada administrativo do Django."""

import os
import sys


def main() -> None:
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:  # pragma: no cover - só acontece fora do venv
        raise ImportError(
            "Django não foi encontrado. Ative o ambiente virtual "
            "(.venv) e instale requirements.txt."
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
