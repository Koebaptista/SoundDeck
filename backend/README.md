# SoundDeck — backend

Django + DRF servindo o deck para o frontend em `../frontend`. Um servidor,
uma máquina, um operador: sem contas, sem login, sem nuvem. O contrato de
produto está em `../PRODUCT.md` e as decisões de escopo em `../BRIEF.md`.

## Rodar

```bash
python -m venv .venv
.venv/Scripts/activate            # Windows; no Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt

python manage.py migrate
python manage.py seed_deck        # opcional: o roteiro de exemplo
python manage.py runserver 127.0.0.1:8000
```

No frontend, `cp .env.example .env.local` (`VITE_DATA=api`) e `npm run dev`.
Sem isso o deck continua no mock de `localStorage`.

```bash
python manage.py test deck        # o contrato inteiro, em 18 testes
```

## O que o servidor promete

Três regras, e o resto é consequência delas.

**O deck sai inteiro numa resposta só.** `GET /api/deck/` entrega peças, dias,
cenas, cues e biblioteca de uma vez. Depois disso o servidor some: nenhuma
rota é chamada no caminho do disparo, e a rede pode cair no meio da peça sem
que um único cue deixe de tocar.

**Remover devolve o que levou junto.** O produto não pergunta "tem certeza?",
ele desfaz. Todo `DELETE` responde com a árvore removida, e as rotas
`restore/` a reinserem com os **ids originais**, na posição original — por isso
o id é texto gerado na aplicação (`p-`, `d-`, `s-`, `c-`, `a-`) e não um
inteiro do banco: restaurar precisa recriar aquilo, não algo parecido.

**Ordem é posição, e é responsabilidade do servidor.** Toda escrita termina
reindexando o grupo afetado, denso, dentro do pai — dias na peça, cenas no dia,
cues na cena (`deck/ordering.py`). Remover a terceira cena não deixa buraco no
roteiro, e mover uma cena de dia não deixa dois blocos com o mesmo número.

## Rotas

| Método | Rota | Devolve |
|---|---|---|
| `GET` | `/api/deck/` | `{ shows, days, scenes, audios, cues }` |
| `POST` `PATCH` `DELETE` | `/api/shows/` · `/api/shows/:id/` | peça · peça · `{ show, days, scenes, cues }` |
| `POST` | `/api/shows/restore/` · `/api/shows/reorder/` · `/api/shows/:id/duplicate/` | `204` · `204` · peça |
| `POST` `PATCH` `DELETE` | `/api/days/` · `/api/days/:id/` | dia · dia · `{ day, scenes, cues }` |
| `POST` | `/api/days/restore/` · `/api/days/reorder/` · `/api/days/:id/duplicate/` | `204` · `204` · dia |
| `POST` `PATCH` `DELETE` | `/api/scenes/` · `/api/scenes/:id/` | cena · cena · `{ scene, cues }` |
| `POST` | `/api/scenes/restore/` · `/api/scenes/reorder/` · `/api/scenes/:id/move/` · `/api/scenes/:id/copy/` | `204` · `204` · `204` · cena |
| `POST` `PATCH` `DELETE` | `/api/cues/` · `/api/cues/:id/` | cue · cue · cue |
| `POST` | `/api/cues/restore/` · `/api/cues/reorder/` | `204` · `204` |
| `POST` (multipart) `PATCH` `DELETE` | `/api/audios/` · `/api/audios/:id/` | áudio · áudio · `{ audio, cues }` |
| `POST` | `/api/audios/restore/` | `204` |

O JSON é o de `frontend/src/types.ts`, em camelCase (`showId`, `dayId`,
`sceneId`, `audioId`). Toda falha sai como `{"detail": "frase em português"}`,
que é o texto que a interface mostra no aviso — `deck/errors.py`.

## Biblioteca de áudio

Upload é `multipart/form-data` com `file` e `name`. O servidor grava em
`media/audio/`, lê duração e formato do arquivo e devolve `src` **relativo**
(`/media/audio/trovao.wav`); quem monta a URL absoluta é o cliente.

A duração vem do `mutagen` e, quando ele responde zero, da contagem crua dos
bytes do WAV (`deck/services.wav_duration`). O segundo caminho não é luxo:
exportador que grava em streaming — e o `gen-audio.mjs` do próprio frontend —
deixa o tamanho do bloco `data` zerado no cabeçalho. O navegador toca assim
mesmo, mas toda biblioteca que confia no cabeçalho devolve 0:00.

**Remover áudio é adiado.** O arquivo continua no disco enquanto a janela de
desfazer estiver aberta, senão o "Desfazer" do aviso seria mentira. Passada a
janela (`SOUNDDECK_UNDO_WINDOW`, uma hora por padrão), o próximo carregamento
do deck apaga arquivo e registro. Para não esperar:

```bash
python manage.py purge_audios --now
```

## Mapa

```
config/settings.py   .env, CORS, SQLite (ou DATABASE_URL de Postgres)
config/urls.py       /api/ e /media/
deck/models.py       peça · dia · cena · cue · áudio — e a geração de id
deck/serializers.py  a fronteira camelCase ↔ snake_case
deck/views.py        as rotas, uma por operação do repositório do frontend
deck/ordering.py     ordem densa dentro do pai
deck/services.py     duplicar, copiar, medir duração, limpar áudio removido
deck/tests.py        o contrato, testado como a interface o usa
deck/management/     seed_deck · purge_audios
```

## Configuração

Tudo em `.env` (ver `.env.example`). O padrão serve para desenvolvimento:
SQLite em `sounddeck.sqlite3`, CORS liberado para o Vite, `DEBUG=True`.

No computador que vai subir ao palco, `DJANGO_DEBUG=False`: erro vira 500
limpo em vez de uma página de traceback. `/media/` continua sendo servido pelo
Django mesmo assim — não existe nginx na coxia do teatro, e uma biblioteca de
cues mudos no meio da peça é pior que um servidor de arquivos improvisado.
