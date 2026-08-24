import type { Cue, Day, Scene, Show } from '../types'

/**
 * Roteiro de exemplo do modo mock: uma temporada pequena e plausível.
 *
 * O exemplo existe para provar a estrutura que o operador vai usar de verdade:
 * quatro espetáculos, em quatro lugares diferentes, cada um com as suas noites
 * — de uma temporada de cinco dias a um sarau de noite única. Sem isso o
 * seletor de peça e de dia parece decoração.
 *
 * Nenhum áudio novo entra em nenhum deles: os quatro espetáculos se servem dos
 * mesmos sete arquivos. O trovão do "Jardim" é o mesmo trovão d'"A Última
 * Chuva", com outro volume e outra deixa — o áudio é da casa, a configuração é
 * do cue.
 *
 * As durações espelham `scripts/gen-audio.mjs` e servem só para exibição
 * enquanto o áudio ainda não armou — depois disso o engine manda.
 *
 * `musica-entrada` passa dos 45s de propósito: é o cue que exercita o caminho
 * de streaming, e ele aparece em várias cenas para provar que áudio é
 * reutilizável e que a configuração mora no cue.
 */

export interface SeedAudio {
  id: string
  name: string
  description: string
  file: string
  duration: number
}

export const SEED_AUDIOS: SeedAudio[] = [
  {
    id: 'a-campainha',
    name: 'Campainha',
    description: 'Ding-dong de porta de entrada, dois toques',
    file: 'campainha.wav',
    duration: 1.8,
  },
  {
    id: 'a-porta',
    name: 'Porta batendo',
    description: 'Batida seca com estalo de madeira',
    file: 'porta.wav',
    duration: 0.9,
  },
  {
    id: 'a-trovao',
    name: 'Trovão',
    description: 'Estalo próximo seguido de rolo grave',
    file: 'trovao.wav',
    duration: 5.2,
  },
  {
    id: 'a-passos',
    name: 'Passos no assoalho',
    description: 'Sete passos, andar sem pressa',
    file: 'passos.wav',
    duration: 3.6,
  },
  {
    id: 'a-vento',
    name: 'Vento',
    description: 'Rajada contínua, feita para rodar em loop',
    file: 'vento.wav',
    duration: 22,
  },
  {
    id: 'a-aplausos',
    name: 'Aplausos',
    description: 'Plateia cheia, entra e sai em rampa',
    file: 'aplausos.wav',
    duration: 7,
  },
  {
    id: 'a-musica',
    name: 'Música de entrada',
    description: 'Pad de quatro acordes — faixa longa, tocada por streaming',
    file: 'musica-entrada.wav',
    duration: 78,
  },
]

/**
 * Datas do exemplo, ancoradas na próxima sexta-feira.
 *
 * Duas armadilhas resolvidas de uma vez. A primeira: os dias se chamam
 * "Sábado, 20h" e "Domingo, matinê"; se as datas flutuassem a partir de hoje,
 * o nome e o dia da semana se contradiriam na barra de contexto em cinco dias
 * de sete — um exemplo que se desmente sozinho não prova nada. A âncora mantém
 * os dois honestos para sempre.
 *
 * A segunda: `toISOString()` converte para UTC antes de cortar a data. No
 * fuso de Brasília, tudo que roda antes das 3h da manhã volta um dia. A
 * formatação aqui é local, do jeito que o operador lê.
 */
function fromFriday(offset: number): string {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  const untilFriday = (5 - date.getDay() + 7) % 7 || 7
  date.setDate(date.getDate() + untilFriday + offset)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export const SEED_SHOWS: Show[] = [
  { id: 'p-jardim', name: 'O Jardim de Inverno', venue: 'Teatro Municipal', order: 0 },
  { id: 'p-sarau', name: 'Sarau de Poesia', venue: 'Centro Cultural', order: 1 },
  { id: 'p-natal', name: 'Auto de Natal', venue: 'Escola Municipal Vila Nova', order: 2 },
  { id: 'p-chuva', name: 'A Última Chuva', venue: 'Teatro do Sesc', order: 3 },
]

const DAY_1: Day = {
  id: 'd-estreia',
  showId: 'p-jardim',
  name: 'Estreia',
  date: fromFriday(0),
  order: 0,
}

const DAY_2: Day = {
  id: 'd-sabado',
  showId: 'p-jardim',
  name: 'Sábado, 20h',
  date: fromFriday(1),
  order: 1,
}

const DAY_3: Day = {
  id: 'd-domingo',
  showId: 'p-jardim',
  name: 'Domingo, sessão reduzida',
  date: fromFriday(2),
  order: 2,
}

const DAY_4: Day = {
  id: 'd-sexta-2',
  showId: 'p-jardim',
  name: 'Sexta, segunda semana',
  date: fromFriday(7),
  order: 3,
}

const DAY_5: Day = {
  id: 'd-encerramento',
  showId: 'p-jardim',
  name: 'Sábado, encerramento',
  date: fromFriday(8),
  order: 4,
}

const DAY_NATAL_1: Day = {
  id: 'd-natal-tarde',
  showId: 'p-natal',
  name: 'Sexta, sessão da tarde',
  date: fromFriday(14),
  order: 0,
}

const DAY_NATAL_2: Day = {
  id: 'd-natal-noite',
  showId: 'p-natal',
  name: 'Sábado, sessão da noite',
  date: fromFriday(15),
  order: 1,
}

const DAY_CHUVA_1: Day = {
  id: 'd-chuva-estreia',
  showId: 'p-chuva',
  name: 'Estreia',
  date: fromFriday(21),
  order: 0,
}

const DAY_CHUVA_2: Day = {
  id: 'd-chuva-matine',
  showId: 'p-chuva',
  name: 'Domingo, matinê',
  date: fromFriday(23),
  order: 1,
}

const DAY_SARAU: Day = {
  id: 'd-sarau',
  showId: 'p-sarau',
  name: 'Noite única',
  date: fromFriday(28),
  order: 0,
}

const SCENES_1: Scene[] = [
  { id: 's-abertura', dayId: DAY_1.id, name: 'Abertura', order: 0 },
  { id: 's-entrada', dayId: DAY_1.id, name: 'Entrada de Ana', order: 1 },
  { id: 's-confronto', dayId: DAY_1.id, name: 'Confronto', order: 2 },
  { id: 's-final', dayId: DAY_1.id, name: 'Final', order: 3 },
]

const CUES_1: Cue[] = [
  {
    id: 'c-1',
    sceneId: 's-abertura',
    audioId: 'a-musica',
    cue: 'Casa aberta, antes da terceira campainha',
    order: 0,
    key: '1',
    volume: 0.7,
    loop: true,
  },
  {
    id: 'c-2',
    sceneId: 's-abertura',
    audioId: 'a-vento',
    cue: 'Luz baixa, cortina ainda fechada',
    order: 1,
    key: '2',
    volume: 0.45,
    loop: true,
  },
  {
    id: 'c-3',
    sceneId: 's-entrada',
    audioId: 'a-campainha',
    cue: 'Ana atravessa a sala e toca a campainha',
    order: 0,
    key: '1',
    volume: 0.9,
    loop: false,
  },
  {
    id: 'c-4',
    sceneId: 's-entrada',
    audioId: 'a-porta',
    cue: 'Ele sai e bate a porta',
    order: 1,
    key: '2',
    volume: 1,
    loop: false,
  },
  {
    id: 'c-5',
    sceneId: 's-entrada',
    audioId: 'a-passos',
    cue: 'Passos no corredor, fora de cena',
    order: 2,
    key: '3',
    volume: 0.75,
    loop: false,
  },
  {
    id: 'c-6',
    sceneId: 's-confronto',
    audioId: 'a-trovao',
    cue: 'Na deixa “nunca mais”',
    order: 0,
    key: '1',
    volume: 1,
    loop: false,
  },
  {
    id: 'c-7',
    sceneId: 's-confronto',
    audioId: 'a-vento',
    cue: 'A janela se abre sozinha',
    order: 1,
    key: '2',
    volume: 0.6,
    loop: true,
  },
  {
    id: 'c-8',
    sceneId: 's-confronto',
    audioId: 'a-porta',
    cue: 'Ela sai sem olhar para trás',
    order: 2,
    key: '3',
    volume: 1,
    loop: false,
  },
  {
    id: 'c-9',
    sceneId: 's-final',
    audioId: 'a-aplausos',
    cue: 'Escurece total',
    order: 0,
    key: '1',
    volume: 0.8,
    loop: false,
  },
  {
    id: 'c-10',
    sceneId: 's-final',
    audioId: 'a-musica',
    cue: 'Agradecimentos, luz de serviço',
    order: 1,
    key: '2',
    volume: 0.8,
    loop: false,
  },
]

/**
 * Copia um roteiro para outro dia — a mesma operação que o botão "Duplicar
 * dia" faz no modo montar. Aqui só serve para o exemplo já nascer com as
 * noites montadas.
 */
function cloneInto(day: Day, scenes: Scene[], cues: Cue[], suffix: string) {
  const copiedScenes = scenes.map((scene, index) => ({
    ...scene,
    id: `${scene.id}${suffix}`,
    dayId: day.id,
    order: index,
  }))
  const keep = new Set(scenes.map((s) => s.id))
  const copiedCues = cues
    .filter((cue) => keep.has(cue.sceneId))
    .map((cue) => ({ ...cue, id: `${cue.id}${suffix}`, sceneId: `${cue.sceneId}${suffix}` }))
  return { scenes: copiedScenes, cues: copiedCues }
}

// Cinco noites da mesma peça, e nenhuma delas idêntica por acaso: três repetem
// o roteiro inteiro, a de domingo só tem os dois primeiros blocos porque é a
// sessão curta, e a de encerramento ganha um bloco a mais. É assim que uma
// temporada de verdade se parece — e é o que o seletor de dia precisa mostrar.
const NIGHT_2 = cloneInto(DAY_2, SCENES_1, CUES_1, '-d2')
const NIGHT_3 = cloneInto(DAY_3, SCENES_1.slice(0, 2), CUES_1, '-d3')
const NIGHT_4 = cloneInto(DAY_4, SCENES_1, CUES_1, '-d4')
const NIGHT_5 = cloneInto(DAY_5, SCENES_1, CUES_1, '-d5')

/** O bloco que só existe na última noite, com os áudios que já estão na casa. */
const SCENE_HOMENAGEM: Scene = {
  id: 's-homenagem',
  dayId: DAY_5.id,
  name: 'Homenagem ao elenco',
  order: SCENES_1.length,
}

const CUES_HOMENAGEM: Cue[] = [
  {
    id: 'c-homenagem-1',
    sceneId: SCENE_HOMENAGEM.id,
    audioId: 'a-aplausos',
    cue: 'Chamada nominal, um a um',
    order: 0,
    key: '1',
    volume: 1,
    loop: false,
  },
  {
    id: 'c-homenagem-2',
    sceneId: SCENE_HOMENAGEM.id,
    audioId: 'a-musica',
    cue: 'Elenco de mãos dadas, luz baixando',
    order: 1,
    key: '2',
    volume: 0.65,
    loop: true,
  },
]

const SCENES_SARAU: Scene[] = [
  { id: 's-sarau-abertura', dayId: DAY_SARAU.id, name: 'Chamada do público', order: 0 },
]

const CUES_SARAU: Cue[] = [
  {
    id: 'c-sarau-1',
    sceneId: 's-sarau-abertura',
    audioId: 'a-musica',
    cue: 'Antes de abrir a sala',
    order: 0,
    key: '1',
    volume: 0.6,
    loop: true,
  },
  {
    id: 'c-sarau-2',
    sceneId: 's-sarau-abertura',
    audioId: 'a-aplausos',
    cue: 'Fim de cada poema',
    order: 1,
    key: '2',
    volume: 0.8,
    loop: false,
  },
]

/**
 * As duas peças da casa, montadas sobre a mesma biblioteca de sete áudios.
 *
 * Nenhum arquivo novo entra por elas: o trovão do "Jardim" é o mesmo trovão
 * d'"A Última Chuva", com outro volume e outra deixa. É o ponto do modelo —
 * o áudio é da casa, a configuração é do cue.
 *
 * De cada uma só o primeiro dia é escrito à mão; o segundo é uma cópia, que é
 * exatamente o que o botão "Duplicar dia" faz no modo montar.
 */

const SCENES_NATAL: Scene[] = [
  { id: 's-natal-pastores', dayId: DAY_NATAL_1.id, name: 'Chegada dos pastores', order: 0 },
  { id: 's-natal-estrela', dayId: DAY_NATAL_1.id, name: 'A estrela', order: 1 },
  { id: 's-natal-presepio', dayId: DAY_NATAL_1.id, name: 'Presépio', order: 2 },
]

const CUES_NATAL: Cue[] = [
  {
    id: 'c-natal-1',
    sceneId: 's-natal-pastores',
    audioId: 'a-passos',
    cue: 'Os pastores entram pela plateia',
    order: 0,
    key: '1',
    volume: 0.7,
    loop: false,
  },
  {
    id: 'c-natal-2',
    sceneId: 's-natal-pastores',
    audioId: 'a-campainha',
    cue: 'Sino da igreja, ao longe',
    order: 1,
    key: '2',
    volume: 0.5,
    loop: false,
  },
  {
    id: 'c-natal-3',
    sceneId: 's-natal-estrela',
    audioId: 'a-musica',
    cue: 'A estrela desce e a luz azula',
    order: 0,
    key: '1',
    volume: 0.65,
    loop: true,
  },
  {
    id: 'c-natal-4',
    sceneId: 's-natal-estrela',
    audioId: 'a-vento',
    cue: 'Noite fria no descampado',
    order: 1,
    key: '2',
    volume: 0.35,
    loop: true,
  },
  {
    id: 'c-natal-5',
    sceneId: 's-natal-presepio',
    audioId: 'a-musica',
    cue: 'Coro das crianças, começo bem baixo',
    order: 0,
    key: '1',
    volume: 0.5,
    loop: true,
  },
  {
    id: 'c-natal-6',
    sceneId: 's-natal-presepio',
    audioId: 'a-aplausos',
    cue: 'Todos de frente para a plateia',
    order: 1,
    key: '2',
    volume: 0.9,
    loop: false,
  },
]

const SCENES_CHUVA: Scene[] = [
  { id: 's-chuva-antes', dayId: DAY_CHUVA_1.id, name: 'Antes da tempestade', order: 0 },
  { id: 's-chuva-carta', dayId: DAY_CHUVA_1.id, name: 'A carta', order: 1 },
  { id: 's-chuva-depois', dayId: DAY_CHUVA_1.id, name: 'Depois da chuva', order: 2 },
]

const CUES_CHUVA: Cue[] = [
  {
    id: 'c-chuva-1',
    sceneId: 's-chuva-antes',
    audioId: 'a-vento',
    cue: 'O céu fecha atrás da casa',
    order: 0,
    key: '1',
    volume: 0.55,
    loop: true,
  },
  {
    id: 'c-chuva-2',
    sceneId: 's-chuva-antes',
    audioId: 'a-trovao',
    cue: 'Primeiro raio, ainda longe',
    order: 1,
    key: '2',
    volume: 0.8,
    loop: false,
  },
  {
    id: 'c-chuva-3',
    sceneId: 's-chuva-carta',
    audioId: 'a-porta',
    cue: 'Ela entra encharcada e fecha a porta',
    order: 0,
    key: '1',
    volume: 1,
    loop: false,
  },
  {
    id: 'c-chuva-4',
    sceneId: 's-chuva-carta',
    audioId: 'a-passos',
    cue: 'Ele sobe a escada devagar',
    order: 1,
    key: '2',
    volume: 0.6,
    loop: false,
  },
  {
    id: 'c-chuva-5',
    sceneId: 's-chuva-depois',
    audioId: 'a-musica',
    cue: 'Luz da manhã na janela',
    order: 0,
    key: '1',
    volume: 0.7,
    loop: true,
  },
  {
    id: 'c-chuva-6',
    sceneId: 's-chuva-depois',
    audioId: 'a-aplausos',
    cue: 'Escurece total',
    order: 1,
    key: '2',
    volume: 0.85,
    loop: false,
  },
]

const NATAL_NOITE = cloneInto(DAY_NATAL_2, SCENES_NATAL, CUES_NATAL, '-n2')
const CHUVA_MATINE = cloneInto(DAY_CHUVA_2, SCENES_CHUVA, CUES_CHUVA, '-c2')

export const SEED_DAYS: Day[] = [
  DAY_1,
  DAY_2,
  DAY_3,
  DAY_4,
  DAY_5,
  DAY_SARAU,
  DAY_NATAL_1,
  DAY_NATAL_2,
  DAY_CHUVA_1,
  DAY_CHUVA_2,
]

export const SEED_SCENES: Scene[] = [
  ...SCENES_1,
  ...NIGHT_2.scenes,
  ...NIGHT_3.scenes,
  ...NIGHT_4.scenes,
  ...NIGHT_5.scenes,
  SCENE_HOMENAGEM,
  ...SCENES_SARAU,
  ...SCENES_NATAL,
  ...NATAL_NOITE.scenes,
  ...SCENES_CHUVA,
  ...CHUVA_MATINE.scenes,
]

export const SEED_CUES: Cue[] = [
  ...CUES_1,
  ...NIGHT_2.cues,
  ...NIGHT_3.cues,
  ...NIGHT_4.cues,
  ...NIGHT_5.cues,
  ...CUES_HOMENAGEM,
  ...CUES_SARAU,
  ...CUES_NATAL,
  ...NATAL_NOITE.cues,
  ...CUES_CHUVA,
  ...CHUVA_MATINE.cues,
]
