"""
Entrega da interface já compilada, quando ela viaja junto com o servidor.

No desenvolvimento são dois servidores: o Vite serve o deck em 5173 e o Django
responde a API em 8000, com o CORS costurando os dois. Dentro do aplicativo de
mesa não existe Vite — existe a pasta `spa/`, que é o `frontend/dist` copiado
para dentro do pacote, e o Django serve interface e API pela mesma porta.

Isso não é só economia de processo. Mesma origem significa nenhum CORS, e
significa que o `<audio crossOrigin="anonymous">` do engine busca `/media/...`
como se fosse arquivo da própria página — o `Range` de `media.py` continua
valendo, sem cabeçalho nenhum para negociar.
"""

from __future__ import annotations

from django.conf import settings
from django.http import HttpResponse
from django.views.static import serve as django_serve

FALTA_BUILD = (
    "A interface compilada não está aqui.\n\n"
    "Em desenvolvimento o deck é servido pelo Vite, em http://127.0.0.1:5173 — "
    "é lá que ele abre. Esta pasta só existe dentro do aplicativo empacotado, "
    "onde ela é o `frontend/dist` copiado por `desktop/scripts/build.mjs`.\n"
)


def serve_spa(request, path: str = ""):
    """
    Serve `SPA_DIR`, com `index.html` na raiz.

    Um caminho sem extensão cai no `index.html` — é o que faz uma rota do lado
    do cliente sobreviver a um recarregamento. Um caminho *com* extensão que
    não existe continua sendo 404 de verdade: se um `.js` sumiu do pacote, o
    erro precisa aparecer como erro, não como a página inicial devolvida com
    200 para um `<script>` que esperava JavaScript.
    """
    if not settings.SPA_DIR.is_dir():
        return HttpResponse(FALTA_BUILD, status=501, content_type="text/plain; charset=utf-8")

    alvo = settings.SPA_DIR / path
    if not path or (not alvo.is_file() and "." not in path.rsplit("/", 1)[-1]):
        path = "index.html"

    return django_serve(request, path, document_root=settings.SPA_DIR)
