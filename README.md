# SoundDeck

Deck de disparo de áudio para espetáculos ao vivo. Uma máquina, um operador,
sem contas e sem nuvem. O contrato de produto está em `PRODUCT.md`, o sistema
visual em `DESIGN.md` e as decisões de escopo em `BRIEF.md`.

O projeto tem duas metades: `frontend/` (React + Vite) e `backend/`
(Django + DRF).

## Rodar com Docker

```bash
docker compose up          # --build na primeira vez, ou quando mudar dependência
```

Sobe as duas metades de uma vez:

- deck em **http://127.0.0.1:5173**
- API em **http://127.0.0.1:8000**

`Ctrl+C` derruba. `docker compose up -d` deixa rodando em segundo plano, e
`docker compose down` encerra.

**O código continua sendo o do disco, não uma cópia dentro da imagem.** As duas
pastas entram como bind mount, então salvar um componente recarrega a tela e
salvar uma view reinicia o Django — o mesmo laço de sempre, sem `--build` no
meio. Pelo mesmo motivo `backend/sounddeck.sqlite3` e `backend/media/` são os
arquivos que já estão aqui: subir o Docker não começa um deck vazio, e o áudio
que você enviar pela interface aparece na sua pasta.

O `migrate` roda a cada subida, de propósito: é idempotente, e poupa o deck em
branco de quem clonou o repositório e foi direto ao `up`.

O que roda dentro do contêiner é o servidor de **desenvolvimento** dos dois
lados — o mesmo que rodava nos dois terminais. Para o computador que vai subir
ao palco, veja `DJANGO_DEBUG=False` em `backend/README.md`.

### Comandos avulsos

O `manage.py` mora dentro do contêiner do backend:

```bash
docker compose exec backend python manage.py test deck        # os 21 testes
docker compose exec backend python manage.py seed_deck        # o roteiro de exemplo
docker compose exec backend python manage.py purge_audios --now
docker compose exec frontend npm run typecheck
```

### Quando mudar dependência

`requirements.txt` e `package.json` são instalados na imagem, não no mount:

```bash
docker compose up --build -V
```

O `-V` é o que importa do lado do frontend. `node_modules` vive num volume —
os binários do esbuild e do rollup instalados lá dentro são de Linux, e os do
seu `frontend/node_modules` são de Windows; um sombreia o outro se deixar. Sem
`-V`, o volume antigo sobrevive ao `--build` e o pacote novo não aparece.

### Sem Docker

Continua valendo, e nada foi removido: `backend/README.md` tem o venv e o
`runserver`, `frontend/README.md` tem o `npm run dev`. As duas formas usam o
mesmo banco e a mesma pasta de mídia — só não rode as duas ao mesmo tempo na
mesma porta.
