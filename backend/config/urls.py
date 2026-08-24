"""
Rotas do projeto: a API, os arquivos de áudio e — no aplicativo — a interface.

A mídia é servida pelo próprio Django, com `DEBUG` ligado ou não. O deck roda
numa máquina só, na coxia, e não existe servidor de arquivos na frente dele —
deixar `/media/` fora do ar com `DEBUG=False` deixaria o operador com uma
biblioteca inteira de cues mudos.
"""

from django.urls import include, path, re_path

from deck.media import serve_media
from deck.spa import serve_spa

urlpatterns = [
    path("api/", include("deck.urls")),
    path("media/<path:path>", serve_media, name="media"),
    # A interface fica por último, e de propósito: ela é o curinga que atende
    # tudo que não for API nem mídia. Só responde algo quando `spa/` existe,
    # o que acontece dentro do aplicativo empacotado e não em desenvolvimento.
    re_path(r"^(?P<path>.*)$", serve_spa, name="spa"),
]
