# Design

Sistema visual do SoundDeck. Escrito antes do código (seed). Re-gerável com
`/impeccable document` quando a implementação existir.

## Theme

**Frase de cena:** *um operador sozinho na coxia, o palco iluminado a três
metros à frente, a tela a meia altura como única fonte de luz no seu campo de
visão — ele desvia o olhar por um segundo entre duas falas e volta.*

A frase decide: **escuro, tema único.** Não há alternância claro/escuro. Uma
tela clara na coxia cega o olho adaptado ao escuro e vaza luz para o palco; o
inverso não é verdade — escuro com contraste alto continua perfeitamente
legível em sala iluminada. O caso crítico ganha.

**Estratégia de cor: Restrained.** Neutros puros em ~95% da superfície, um
único acento com significado exclusivo. O acento não decora, não marca
identidade e não distingue categorias: ele significa *áudio tocando agora*.

## Color

OKLCH em toda a paleta. Os neutros são **croma exatamente 0** — sem tinta
quente nem fria. A cor da marca vive no acento, nunca na superfície.

### Neutros

Croma exatamente 0. Degraus de superfície verificados como perceptíveis
(≥1.15:1 entre vizinhos) — um dark UI cujos painéis não se distinguem do fundo
é uma tela chapada.

| Token | OKLCH | sRGB | Papel |
|---|---|---|---|
| `--bg` | `oklch(0.165 0 0)` | `#0e0e0e` | fundo da aplicação |
| `--surface` | `oklch(0.235 0 0)` | `#1e1e1e` | painéis, cue em repouso |
| `--surface-hi` | `oklch(0.290 0 0)` | `#2b2b2b` | hover, estado elevado |
| `--line` | `oklch(0.330 0 0)` | `#353535` | divisores (decorativo) |
| `--line-hi` | `oklch(0.530 0 0)` | `#6c6c6c` | borda de controle — 3.16:1 |
| `--ink` | `oklch(0.975 0 0)` | `#f7f7f7` | texto principal — 15.5:1 |
| `--ink-2` | `oklch(0.760 0 0)` | `#b1b1b1` | secundário — 7.76:1 |
| `--ink-3` | `oklch(0.635 0 0)` | `#8a8a8a` | terciário — 4.86:1 |

### Semânticos

| Token | OKLCH | sRGB | Significado — exclusivo |
|---|---|---|---|
| `--live` | `oklch(0.760 0.150 160)` | `#41ce90` | **tocando agora.** Único uso. |
| `--live-bg` | `oklch(0.330 0.070 160)` | `#074029` | preenchimento do cue tocando |
| `--live-track` | `oklch(0.470 0.100 160)` | `#126b47` | trilha de progresso |
| `--stop` | `oklch(0.680 0.190 25)` | `#f75d59` | texto e borda de interrupção |
| `--stop-solid` | `oklch(0.520 0.185 25)` | `#bc272c` | preenchimento do PARAR TUDO |
| `--stop-hi` | `oklch(0.590 0.200 25)` | `#db373a` | hover do preenchimento |
| `--warn` | `oklch(0.800 0.150 75)` | `#f5ae39` | não carregou / não armado |
| `--focus` | `oklch(0.995 0 0)` | `#fdfdfd` | anel de foco — nunca `--live` |

Contraste verificado programaticamente em todos os pares em uso. Piso: corpo
≥4.5:1, bordas de controle e texto ≥24px ≥3:1. `--ink` sobre `--stop-solid`
dá 5.64:1; `--ink` sobre `--live-bg`, 11:1.

O verde do acento é esmeralda frio (hue 160), não o verde-fósforo de terminal.
O foco é branco por decisão deliberada: se o anel de foco fosse o verde do
sistema, um cue focado seria confundido com um cue tocando na visão periférica
— exatamente o erro que o produto existe para evitar.

## Typography

**Uma família: Inter**, com `system-ui` de fallback. Sem par display/corpo — é
UI de produto, e uma sans bem ajustada carrega rótulo, botão, dado e texto.

Escala **fixa em rem** (razão ~1.2). Nada de `clamp()`: o operador usa uma tela
só, com DPI constante, e tipografia fluida em painel estreito piora a leitura.

| Passo | Tamanho | Uso |
|---|---|---|
| `--fs-micro` | 0.6875rem / 11px | metadados, rótulos discretos |
| `--fs-sm` | 0.8125rem / 13px | secundário, deixa em cue compacto |
| `--fs-base` | 0.9375rem / 15px | corpo, formulários |
| `--fs-md` | 1.125rem / 18px | nome do cue em grade densa |
| `--fs-lg` | 1.375rem / 22px | nome do cue, títulos de painel |
| `--fs-xl` | 1.75rem / 28px | nome do cue em grade folgada |
| `--fs-2xl` | 2.25rem / 36px | PARAR TUDO |

`font-variant-numeric: tabular-nums` obrigatório em **todo** número de tempo,
duração e contagem. Um contador regressivo cujos dígitos dançam é ruído em
movimento no canto do olho.

Entrelinha: 1.2 em títulos e rótulos de cue, 1.5 em texto corrido. Prosa
limitada a 65–75ch. `text-wrap: balance` em títulos.

## Space & Shape

Escala base 4px: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`. O ritmo varia por
densidade: painéis de operação respiram, formulários de montagem são compactos.

Raios: `--r-sm 6px` (controles), `--r-md 8px` (padrão), `--r-lg 12px`
(painéis). Sem pílulas, sem raios acima de 12px.

Alvos: mínimo 44×44px em qualquer lugar; cues de disparo com altura mínima de
96px e `PARAR TUDO` ocupando uma faixa fixa de borda a borda.

## Elevation & Z-index

Escala semântica, sem valores arbitrários:

```
--z-base 0 · --z-sticky 200 · --z-backdrop 300 · --z-modal 400
--z-toast 500 · --z-tooltip 600
```

Elevação por superfície e borda, não por sombra difusa — sombra em fundo quase
preto não é percebida, apenas suja.

## Motion

`--dur-fast 120ms · --dur 180ms · --dur-slow 260ms`, com
`--ease: cubic-bezier(0.25, 1, 0.5, 1)` (ease-out-quart). Sem bounce, sem
elástico, sem sequência coreografada de carregamento.

O movimento comunica estado e nada mais: a transição de um cue para "tocando",
o progresso avançando, um painel abrindo. Não há animação de entrada de página
— o operador abre o software para trabalhar, não para assistir.

`@media (prefers-reduced-motion: reduce)`: transições viram corte seco
(`0.01ms`). A barra de progresso continua se movendo — ela é o dado, não a
decoração.

## Components

Todo componente interativo entrega os sete estados: default, hover, focus,
active, disabled, loading, error. Vocabulário idêntico em todas as telas.

- **Cue** — o botão de disparo. Nome (grande), deixa (secundária), duração
  (tabular). Sem rótulo de tecla: o teclado não dispara nada, e um rótulo que
  promete o contrário mente no pior momento. Estados: armando / pronto /
  tocando / falhou. "Tocando" traz preenchimento `--live-bg`, borda
  `--live`, barra de progresso e rótulo textual — quatro sinais, nunca só cor.
- **Painel Tocando agora** — uma linha por áudio ativo: nome, progresso, tempo
  restante, volume, loop, pausar, reiniciar, parar.
- **Barra de contexto** — a faixa abaixo da barra superior, que diz qual peça e
  qual dia estão carregados. **Uma só natureza nos dois modos**: rótulo (`Peça`,
  `Dia 2 de 5`) em `--fs-micro`, nome em `--fs-md` sobre `--ink`, local e data
  em `--ink-3`, contagens à direita e um botão `Trocar` com moldura que abre o
  seletor. No montar ela sobe para `--surface` e alinha à coluna de 900px — a
  diferença de material continua anunciando em qual tela se está, mas o
  conteúdo e os controles são os mesmos.

  Ela nasceu com duas naturezas — mostrador travado no operar, par de
  `<select>` no montar — e as duas falhavam pelo mesmo motivo: em `--fs-sm`,
  numa faixa de 34px, o que estava carregado se lia com esforço, e a porta para
  trocar era um `btn--ghost` no canto, isto é, um controle terciário pintado
  sobre a ação principal daquela faixa.

  **Nenhum campo de escolha vive aqui**, e agora isso vale nos dois modos: um
  `<select>` com foco muda de valor no giro da roda do mouse, e trocar o
  roteiro inteiro em silêncio é o acidente que este produto não pode ter. O que
  existe é um clique deliberado que abre um diálogo, e `Esc` o dispensa sem ter
  mudado nada.

- **Seletor de peça e dia** — `<dialog>` de 760px, duas listas lado a lado:
  peças à esquerda, dias da peça em foco à direita. Alvos de 60px, nome em
  `--fs-md`, local/data/contagens em `--ink-3`. A esquerda só muda o que a
  direita mostra; é o clique no dia que carrega o roteiro e fecha. O que já
  está no deck se marca por forma — moldura `--ink-3` e sinal de conferido —,
  nunca por cor: verde aqui significaria som no ar. Nada nesta superfície
  renomeia, reordena ou apaga.
- **PARAR TUDO** — faixa fixa inferior, borda a borda. Sempre presente e sempre
  reconhecível; contorno `--stop` em repouso, preenchimento sólido `--stop`
  quando há som tocando (isto é, quando o botão tem o que fazer), com a
  contagem de áudios ativos no rótulo.
- **Linha de lista (montar)** — número do roteiro, nome como **campo
  silencioso** (`.input--quiet`: sem moldura em repouso, moldura no hover e no
  foco) em `--fs-md`, qualificadores secundários, uma coluna de contagens com
  largura de piso que serve de link para o nível de baixo, e o bloco
  destrutivo na borda. A linha carregada muda de material (`--surface-hi`,
  borda `--ink-3`) e carrega a marca `Em cartaz` — três sinais, nenhum deles
  cor. Dez nomes dentro de dez molduras iguais viram dez caixas; a moldura
  repetida é que rouba a leitura, não o texto.

- **Vazio** — estados vazios ensinam o próximo passo concreto ("Adicione a
  primeira cena"), nunca "nenhum item encontrado".
- **Carregando** — esqueleto na forma do conteúdo. Sem spinner centralizado.

## Bans (deste projeto)

Além dos banimentos gerais: nenhum gradiente em texto, nenhuma barra lateral
colorida de acento, nenhum vidro fosco decorativo, nenhum kicker versalete
acima de seções, nenhuma numeração `01 / 02 / 03` como scaffolding — a
numeração de cenas é conteúdo real do roteiro e essa é a única exceção.
