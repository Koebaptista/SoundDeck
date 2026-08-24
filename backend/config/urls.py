"""
Rotas do projeto: a API e os arquivos de áudio.

A mídia é servida pelo próprio Django, com `DEBUG` ligado ou não. O deck roda
numa máquina só, na coxia, e não existe servidor de arquivos na frente dele —
deixar `/media/` fora do ar com `DEBUG=False` deixaria o operador com uma
biblioteca inteira de cues mudos.
"""

from django.urls import include, path

from deck.media import serve_media

urlpatterns = [
    path("api/", include("deck.urls")),
    path("media/<path:path>", serve_media, name="media"),
]
