# SoundDeck

Deck de disparo de áudio para espetáculos ao vivo. Uma máquina, um operador,
sem contas e sem nuvem. O contrato de produto está em `PRODUCT.md`, o sistema
visual em `DESIGN.md` e as decisões de escopo em `BRIEF.md`.

O projeto tem duas metades: `frontend/` (React + Vite) e `backend/`
(Django + DRF). Uma terceira pasta, `desktop/`, não é uma metade nova — é a
coxia que junta as duas num aplicativo instalável.

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

## Aplicativo de mesa

Tudo acima é para quem desenvolve o deck. Quem só quer operá-lo recebe um
instalador do Windows e não precisa de Python, Node, Docker nem terminal:

```powershell
node desktop\scripts\build.mjs
```

Sai um `desktop\release\SoundDeck-<versão>-instalador.exe` de uns 130 MB, que
carrega dentro de si o Django congelado e a interface compilada. `desktop/`
não reimplementa nada: o Django passou a servir também o React já buildado, e
o Electron só acende esse servidor numa porta livre e abre uma janela nele —
uma origem só, sem CORS, com o `Range` da mídia valendo igual.

Os dados de quem opera ficam em `%LOCALAPPDATA%\SoundDeck`, fora da pasta de
instalação: banco, áudios e o log da última subida. Fazer backup do deck é
copiar essa pasta. Dentro dela, `entrada/` é onde se largam os áudios de uma
trilha inteira de uma vez — eles entram na abertura seguinte, sem clicar em
enviar trinta vezes.

O espetáculo montado cabe num arquivo. **Exportar espetáculo**, no modo montar,
escreve um `.sounddeck` com o roteiro e os áudios juntos; do outro lado ele
entra pelo botão **Trazer espetáculo**, pela pasta de entrada, ou embutido no
próprio instalador — quem recebe abre o programa com tudo no lugar.

`desktop/README.md` tem o resto — como construir, o que o instalador faz na
máquina do outro, e por que o Windows mostra um aviso na primeira execução.
