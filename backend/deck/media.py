"""
Entrega dos arquivos de áudio, com suporte a `Range`.

O Django serve mídia sem entender `Range`: responde 200 com o arquivo inteiro,
sem `Accept-Ranges`. Para um WAV de dois segundos isso não muda nada, mas o
engine toca por streaming tudo que passa de 45s (`HTMLAudioElement`) — e um
elemento de áudio que não recebe `Accept-Ranges: bytes` fica sem poder buscar
posição: reiniciar uma faixa de quatro minutos vira baixar quatro minutos de
novo, no meio da peça.

Requisição sem `Range` continua indo pelo caminho normal do Django. A única
coisa que muda é que ela passa a anunciar que aceita trechos.
"""

from __future__ import annotations

import re

from django.conf import settings
from django.http import FileResponse, HttpResponse, StreamingHttpResponse
from django.views.static import serve as django_serve

#: Só um trecho por requisição. É o que o navegador pede ao tocar áudio; pedido
#: de vários trechos recebe o arquivo inteiro, que é resposta válida para ele.
ONE_RANGE = re.compile(r"^bytes=(\d*)-(\d*)$")

CHUNK = 64 * 1024


def serve_media(request, path: str):
    """Serve `MEDIA_ROOT`, respondendo 206 quando o cliente pede um trecho."""
    response = django_serve(request, path, document_root=settings.MEDIA_ROOT)
    response.headers["Accept-Ranges"] = "bytes"

    header = request.headers.get("Range", "").strip()
    if not header or response.status_code != 200 or not isinstance(response, FileResponse):
        return response

    match = ONE_RANGE.match(header)
    if not match:
        return response

    total = int(response.headers["Content-Length"])
    span = resolve(match.groups(), total)
    if span is None:
        response.close()
        return unsatisfiable(total)

    start, end = span
    source = response.file_to_stream.name
    response.close()

    partial = StreamingHttpResponse(
        read_span(source, start, end),
        status=206,
        content_type=response.headers["Content-Type"],
    )
    partial.headers["Content-Length"] = str(end - start + 1)
    partial.headers["Content-Range"] = f"bytes {start}-{end}/{total}"
    partial.headers["Accept-Ranges"] = "bytes"
    if "Last-Modified" in response.headers:
        partial.headers["Last-Modified"] = response.headers["Last-Modified"]
    return partial


def resolve(bounds: tuple[str, str], total: int) -> tuple[int, int] | None:
    """
    Traduz `bytes=início-fim` para um par de posições, ou `None` se não couber.

    As duas formas abertas do cabeçalho estão aqui: `bytes=500-` (daqui até o
    fim) e `bytes=-500` (os últimos 500 bytes, que é como o navegador procura
    o fim de um MP3 sem baixar o meio).
    """
    first, last = bounds
    if not first and not last:
        return None
    if not first:
        length = min(int(last), total)
        return (total - length, total - 1) if length else None
    start = int(first)
    end = min(int(last), total - 1) if last else total - 1
    if start > end or start >= total:
        return None
    return start, end


def read_span(path: str, start: int, end: int):
    """Lê o trecho pedido em blocos, sem carregar a faixa inteira na memória."""
    remaining = end - start + 1
    with open(path, "rb") as handle:
        handle.seek(start)
        while remaining > 0:
            block = handle.read(min(CHUNK, remaining))
            if not block:
                return
            remaining -= len(block)
            yield block


def unsatisfiable(total: int) -> HttpResponse:
    """416: o cliente pediu um trecho que não existe no arquivo."""
    response = HttpResponse(status=416)
    response.headers["Content-Range"] = f"bytes */{total}"
    response.headers["Accept-Ranges"] = "bytes"
    return response
