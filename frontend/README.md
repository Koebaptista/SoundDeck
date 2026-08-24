# SoundDeck — frontend

Deck de disparo de áudio para espetáculos ao vivo. React + Vite + TypeScript,
rodando local. O contrato de produto está em `../PRODUCT.md`, o sistema visual
em `../DESIGN.md` e as decisões de escopo em `../BRIEF.md`.

## Rodar

```bash
npm install
npm run dev      # gera os WAVs de exemplo e sobe em http://127.0.0.1:5173
```

`predev` e `prebuild` chamam `scripts/gen-audio.mjs`, que sintetiza sete áudios
em `public/audio/` se eles ainda não existirem (`npm run audio:seed -- --force`
regera). São dados falsos que produzem som de verdade — sem eles não dá para
medir latência, polifonia nem a rampa anti-estalo antes do backend existir.

```bash
npm run build      # tsc + vite build → dist/
npm run typecheck
```

## Trocar o mock pelo Django

Uma linha, em `src/data/index.ts`, controlada por variável de ambiente:

```bash
cp .env.example .env.local   # VITE_DATA=api
```

`src/data/repo.ts` é a única porta de acesso a dados. `mockRepo` (localStorage +
IndexedDB) e `apiRepo` (cliente HTTP do DRF) implementam a mesma interface, e
nenhum componente importa qualquer um dos dois diretamente.

O contrato que o backend precisa expor está escrito em `src/data/apiRepo.ts`:

| Método | Rota |
|---|---|
| `load` | `GET /api/deck/` → `{ scenes, audios, cues }` |
| `createScene` · `renameScene` · `deleteScene` | `/api/scenes/` · `/api/scenes/:id/` |
| `reorderScenes` · `restoreScene` | `/api/scenes/reorder/` · `/api/scenes/restore/` |
| `createCue` · `updateCue` · `deleteCue` | `/api/cues/` · `/api/cues/:id/` |
| `reorderCues` · `restoreCues` | `/api/cues/reorder/` · `/api/cues/restore/` |
| `addAudio` (multipart) · `updateAudio` · `deleteAudio` | `/api/audios/` · `/api/audios/:id/` |
| `restoreAudio` | `/api/audios/restore/` |

`DELETE` de cena e de áudio devolvem o que foi removido, porque o desfazer da
interface reinsere exatamente aquilo. As rotas `restore/` existem pelo mesmo
motivo — o produto não pergunta “tem certeza?”, ele desfaz.

**Nenhuma chamada ao backend acontece no caminho do disparo.** O servidor
entrega o deck no carregamento e some; durante a peça a rede pode cair sem que
um único cue deixe de tocar.

## Mapa

```
src/
  audio/engine.ts     grafo WebAudio: armar, disparar, pausar, parar
  audio/useEngine.ts  ponte com React — só mudanças de conjunto de vozes
  data/               repo.ts (interface) · mockRepo · apiRepo · seed
  state/              deck (carga e escrita) · toasts (desfazer) · shortcuts
  modes/operar/       a tela do espetáculo
  modes/montar/       cenas · cues · biblioteca
  styles/             tokens.css (DESIGN.md literal) · base · app · montar
```

### Áudio

Curtos (≤45s) são decodificados para `AudioBuffer` na abertura; disparar é
montar um `AudioBufferSourceNode` e chamar `start(0)`. Longos usam
`HTMLAudioElement` por streaming — decodificar dez minutos em memória custaria
centenas de MB sem ganho audível. Toda interrupção aplica rampa de ganho de
15 ms, porque cortar uma onda no meio estala nas caixas.

Progresso e contagem regressiva são escritos direto no DOM dentro de
`requestAnimationFrame`, nunca via estado do React: um deck de 60 cues não pode
re-renderizar 60 vezes por segundo.

### Atalhos

`1..9` disparam dentro da **cena ativa** (a mesma tecla pode existir em toda
cena) · `Esc` para tudo · `Espaço` congela e solta · `↑` `↓` mudam de cena ·
`Enter` dispara o cue focado. Nada dispara enquanto o foco está num campo de
texto.
