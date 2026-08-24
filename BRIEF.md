# Design Brief — SoundDeck

Produzido por `/impeccable shape`. Precede a implementação; não descreve código.

## 1. Resumo

Deck de disparo de áudio para espetáculos ao vivo, rodando localmente. O
operador cadastra áudios, organiza em cenas na ordem do roteiro e, durante a
apresentação, clica em um botão para o som sair na hora. Uma pessoa, um
computador, sem rede e sem contas.

O produto é julgado por um único critério: entre o clique e o som não existe
espera perceptível, e o operador nunca precisa procurar nada.

## 2. Ação primária

**Disparar o cue certo no instante da deixa.** Tudo o mais — cadastrar,
ordenar, ajustar volume, anotar a deixa — é preparação que acontece em outro
momento e não pode competir por espaço com essa ação.

## 3. Direção visual

- **Estratégia de cor: Restrained.** Neutros de croma 0 em toda a superfície,
  um acento único.
- **Tema — frase de cena:** *um operador sozinho na coxia, o palco iluminado a
  três metros, a tela como única fonte de luz no seu campo de visão, olhando de
  relance entre duas falas.* → **escuro, tema único**, sem alternância.
- **A regra que organiza a paleta:** cor na tela significa som no ar. Em
  repouso a interface é rigorosamente acromática. O verde `--live` só existe
  onde há áudio tocando naquele segundo; o vermelho `--stop` só existe no que
  interrompe som. Nenhuma outra cor tem permissão.
- **Referências:** Linear (densidade calma, foco em estado, zero decoração),
  Raycast (superfície escura neutra, alvo grande, teclado de primeira classe),
  e o *comportamento* do QLab — o modelo mental de cena/cue — explicitamente
  **sem** sua aparência de console.
- **Anti-referências ativas:** terminal verde-neon, pads coloridos tipo
  Launchpad, skeumorfismo de mesa de som, dashboard de SaaS.

## 4. Escopo

- **Fidelidade:** production-ready. Vai subir ao palco.
- **Amplitude:** aplicação completa — uma tela de operação e três superfícies
  de montagem.
- **Interatividade:** software funcional de ponta a ponta.
- **Tempo:** polir até ficar pronto, sem etapa de protótipo descartável.
- **Ordem de construção:** frontend inteiro com dados mockados primeiro,
  backend Django depois, trocando apenas a camada de acesso a dados.

## 5. Dois modos, não um

Decisão estrutural que responde ao medo de clicar no botão errado:

- **OPERAR** — padrão ao abrir. Só disparo. Nenhum botão de excluir, renomear
  ou reordenar existe na tela. Alvos grandes, espaçamento generoso.
- **MONTAR** — edição de cenas, cues e biblioteca. Denso, formulários
  compactos, tudo destrutivo mora aqui.

A troca é explícita e visível. Durante a peça, o único botão perigoso na tela
é o `PARAR TUDO`, e ele é perigoso de propósito.

## 6. Layout

**Modo OPERAR** — três colunas sobre uma faixa fixa:

```
┌────────────┬──────────────────────────────┬─────────────────┐
│  CENAS     │  CUES DA CENA ATIVA          │  TOCANDO AGORA  │
│  240px     │  grade auto-fit, min 280px   │  320px          │
│            │                              │                 │
│  01 Abert. │  ┌──────────┐ ┌──────────┐   │  > Chuva  02:14 │
│ >02 Entr.  │  │ 1        │ │ 2        │   │  ########__ P S │
│  03 Confr. │  │ Campainha│ │ Porta    │   │  ----volume---- │
│  04 Final  │  │ Ana toca │ │ Ele sai  │   │                 │
│            │  │     0:03 │ │     0:02 │   │  > Vento  00:41 │
│            │  └──────────┘ └──────────┘   │  ###_______ P S │
├────────────┴──────────────────────────────┴─────────────────┤
│                  PARAR  TUDO  ·  2                          │
└─────────────────────────────────────────────────────────────┘
```

- A coluna de cenas é navegação, não conteúdo — compacta, numerada, sem rolagem
  na maioria dos casos.
- A grade de cues é o centro de gravidade: `repeat(auto-fit, minmax(280px,1fr))`
  cresce de uma peça de 6 disparos para uma de 60 sem redesenho e sem
  breakpoint manual.
- O painel direito só existe quando há som tocando; vazio, ele encolhe e devolve
  o espaço à grade.
- A faixa `PARAR TUDO` é fixa, de borda a borda, sempre presente. Contornada em
  repouso, sólida quando há o que parar, com a contagem de áudios ativos.
- Abaixo de 1100px a coluna de cenas vira uma barra de abas no topo; abaixo de
  820px o painel de tocando vira uma gaveta. A faixa nunca sai da tela.

**Modo MONTAR** — coluna única, largura máxima 900px, formulários densos:
Cenas (lista reordenável) · Cues da cena · Biblioteca de áudios.

## 7. Anatomia do cue

O que o operador lê de relance, em ordem de peso visual:

1. **Nome** — 22 a 28px, peso médio. O maior elemento do botão.
2. **Deixa** — 13px, `--ink-2`. O gatilho em cena: "quando o João bate a porta".
   É o que o operador realmente procura, já que está olhando para o palco.
3. **Duração** — 13px tabular, canto inferior. Distinguir efeito de 2s de
   música de 8min antes de disparar.
4. **Tecla** — 11px, canto superior, discreta. Lembrete, não conteúdo.
5. **Loop** — marca só quando ativo.

## 8. Estados

| Estado | O que o operador vê |
|---|---|
| **Armando** | Esqueleto na forma do cue, sem clique. Acontece só na abertura. |
| **Pronto** | Superfície neutra, borda sutil. Silencioso e disponível. |
| **Tocando** | Preenchimento `--live-bg`, borda `--live`, barra de progresso avançando, tempo restante regressivo, rótulo textual. Quatro sinais, nunca só cor. |
| **Em loop** | Como tocando, com marca de repetição persistente. |
| **Pausado** | Progresso congelado, cor esmaecida, rótulo "pausado". |
| **Falhou** | Borda `--warn`, ícone, texto do erro. **Este estado é crítico:** um arquivo que não carrega precisa gritar antes da peça, nunca durante. |
| **Cena sem cues** | "Nenhum cue nesta cena ainda" + atalho para adicionar (só no modo montar). |
| **Projeto vazio** | Primeiro uso: passo a passo concreto — enviar áudio, criar cena, montar cue. |

## 9. Interação

- **Clique no cue** → som imediato. Sem confirmação, sem diálogo, sem delay.
- **Disparos somam.** Vários áudios tocam juntos por padrão; disparar um cue já
  tocando abre uma segunda voz do mesmo som (comportamento correto para efeitos
  curtos repetidos).
- **Por voz ativa:** pausar, retomar, parar, reiniciar, volume, loop,
  saltar dez segundos para trás ou para frente, e buscar qualquer ponto
  clicando ou arrastando a barra de progresso.
- **Volume master** na barra superior, afetando tudo.
- **Sem atalhos de teclado, e de propósito.** Existiram — tecla por cue, `ESC`
  para tudo, `ESPAÇO` para pausa geral, setas entre cenas — e foram removidos.
  A rede de segurança virou a armadilha: na coxia escura, uma tecla esbarrada
  põe som no ar sem confirmação e sem desfazer. O disparo é do mouse, e o modo
  operar chega a impedir que `Enter` e `ESPAÇO` acionem o botão em foco.
- **Sem estalo:** toda interrupção aplica uma rampa de ganho de ~15ms. Cortar
  uma onda no meio produz um clique audível nas caixas — inaceitável em sala.
- **Feedback de disparo** em até 100ms, para o operador saber que o clique
  pegou mesmo em áudio de ataque suave.

## 10. Arquitetura de áudio

A exigência de latência zero é resolvida antes da peça, não durante:

- **Um `AudioContext`**, destravado no primeiro gesto do usuário (política de
  autoplay do navegador), com um aviso explícito enquanto estiver suspenso.
- **Áudios curtos** (até ~45s) são decodificados para `AudioBuffer` na abertura.
  Disparo = novo `AudioBufferSourceNode` + `start(0)`: latência de milissegundos
  e polifonia real do mesmo som.
- **Áudios longos** usam `HTMLAudioElement` com `preload="auto"` ligado ao grafo
  por `MediaElementAudioSourceNode` — decodificar 10 minutos em memória custaria
  centenas de MB sem ganho perceptível.
- **Cadeia:** fonte → ganho da voz → ganho master → saída.
- **Pausa de buffer** guarda o deslocamento e recria o nó ao retomar
  (`AudioBufferSourceNode` não tem pausa nativa).
- **Progresso** lido em `requestAnimationFrame`, nunca por temporizador.
- **Nenhuma requisição ao backend no caminho do disparo.** O servidor entrega
  arquivo e metadados no carregamento e some.

## 11. Dados e mock

Uma única interface de acesso a dados, com duas implementações intercambiáveis:
mock em `localStorage` agora, cliente HTTP do Django depois. Nenhum componente
sabe qual está ativa.

Entidades, da mais larga para a mais estreita: **Peça** (nome, local, ordem) ·
**Dia** (pertence à peça; nome, data, ordem) · **Cena** (pertence ao dia; nome,
ordem) · **Cue** (liga cena e áudio; deixa, ordem, volume, loop). Fora
da hierarquia, global ao projeto: **Áudio** (arquivo, nome, descrição, duração,
formato).

O mesmo computador opera várias peças, em vários lugares, e uma peça em cartaz
por três noites são três dias — cada um com o próprio roteiro, porque a sessão
de domingo raramente é a de sexta. Dias iguais se montam uma vez e se duplicam
com cenas e cues junto; uma cena pode ser realocada de um dia para outro sem ser
remontada. O áudio é reutilizável por todas as peças; o cue carrega a
configuração.

Para o mock ser realmente tocável, o projeto gera arquivos WAV sintéticos
(campainha, porta, trovão, passos, música de entrada) — dados falsos que
produzem som de verdade, permitindo validar latência e polifonia antes do
backend existir.

## 12. Referências de implementação

`interaction-design.md` (formulários e controles do modo montar) ·
`layout.md` (grade e ritmo do deck) · `harden.md` (estado de falha de áudio,
que é o risco real) · `onboard.md` (primeiro uso e estados vazios).

## 13. Decisões assertadas

Sem fila sequencial nem botão GO — o operador recusou o modelo. A orientação no
roteiro vem da numeração forte das cenas e de uma marca discreta nos cues já
disparados na sessão, que não impõe ordem.

Sem autenticação, sem upload em nuvem, sem histórico, sem desfazer global, sem
formas de onda desenhadas, sem fade configurável, sem tema claro.
