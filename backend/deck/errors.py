"""
Toda falha da API sai como `{"detail": "..."}`.

O cliente (`frontend/src/data/apiRepo.ts`) lê exatamente esse campo para
montar a mensagem do aviso; sem isso o operador recebe "os dados enviados
foram recusados" no lugar de "essa cena não existe mais". A voz é a do
produto: direta, em português, sem jargão de software.
"""

from __future__ import annotations

from rest_framework import exceptions
from rest_framework.response import Response
from rest_framework.views import exception_handler


class Invalid(exceptions.ValidationError):
    """400 com uma frase em português, não um mapa de erros por campo."""

    def __init__(self, message: str) -> None:
        super().__init__({"detail": message})


class Missing(exceptions.NotFound):
    """404 com a frase que a interface mostra no aviso."""

    def __init__(self, message: str) -> None:
        super().__init__(detail=message)


def handler(exc, context) -> Response | None:
    response = exception_handler(exc, context)
    if response is None:
        return None
    response.data = {"detail": _flatten(response.data)}
    return response


def _flatten(data: object) -> str:
    """Reduz o formato de erro do DRF — dicionário ou lista — a uma frase."""
    if isinstance(data, dict):
        detail = data.get("detail")
        if detail is not None:
            return _flatten(detail)
        return "; ".join(_flatten(value) for value in data.values())
    if isinstance(data, list):
        return "; ".join(_flatten(item) for item in data)
    return str(data)
