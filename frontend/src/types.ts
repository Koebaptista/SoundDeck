/**
 * Modelo de domínio do SoundDeck.
 *
 * Vocabulário do teatro, não de software: peça, dia, cena, cue, deixa. Os
 * mesmos nomes aparecem na interface, no repositório e — quando existir — no
 * Django.
 *
 * A hierarquia é peça → dia → cena → cue. A biblioteca de áudios fica fora
 * dela, global ao projeto: o mesmo trovão serve a duas peças em dois teatros.
 */

/**
 * Um espetáculo. O projeto guarda vários — a montagem deste mês e a que volta
 * no ano que vem, em outro teatro, com outro roteiro.
 */
export interface Show {
  id: string
  name: string
  /** Onde acontece: "Teatro Municipal". É o que distingue duas montagens. */
  venue: string
  order: number
}

/**
 * Uma apresentação da peça. Três noites são três dias, e cada um carrega o
 * próprio roteiro — na temporada corrida costumam ser iguais, no festival
 * quase nunca são.
 */
export interface Day {
  id: string
  showId: string
  /** Rótulo livre: "Estreia", "Sábado 20h", "Sessão infantil". */
  name: string
  /** `YYYY-MM-DD`, ou `null` enquanto a data não está fechada. */
  date: string | null
  order: number
}

/** Um bloco do roteiro de um dia. A ordem é a ordem do espetáculo. */
export interface Scene {
  id: string
  dayId: string
  name: string
  order: number
}

/**
 * Um arquivo de áudio da biblioteca. Reutilizável em várias cenas, dias e
 * peças — quem carrega a configuração de disparo é o cue, não o áudio.
 */
export interface AudioAsset {
  id: string
  name: string
  description: string
  /** URL servível. Mock: `/audio/*.wav` ou blob do IndexedDB. Django: MEDIA_URL. */
  src: string
  /** Segundos. Metadado para exibição antes de armar; o engine reconcilia depois. */
  duration: number
  format: string
  /** Bytes, quando conhecido. */
  size?: number
}

/** Liga uma cena a um áudio, com a configuração de disparo daquele momento. */
export interface Cue {
  id: string
  sceneId: string
  audioId: string
  /** O gatilho em cena: "quando o João bate a porta". É o que o operador procura. */
  cue: string
  order: number
  /** Tecla resolvida dentro da cena ativa — `1` pode existir em toda cena. */
  key: string | null
  /** 0..1, multiplicado pelo master. */
  volume: number
  loop: boolean
}

/** Tudo que o deck precisa para operar, entregue de uma vez no carregamento. */
export interface Deck {
  shows: Show[]
  days: Day[]
  scenes: Scene[]
  audios: AudioAsset[]
  cues: Cue[]
}

/** Estado de preparação de um áudio. "Falhou" precisa gritar antes da peça. */
export type ArmState = 'idle' | 'arming' | 'ready' | 'failed'

export interface AssetStatus {
  state: ArmState
  /** Duração real, medida depois de decodificar/carregar metadados. */
  duration: number
  /** Como o áudio vai tocar: decodificado em memória ou por streaming. */
  strategy: 'buffer' | 'element' | null
  error: string | null
}

/** Uma emissão de som viva. Disparar duas vezes o mesmo cue cria duas vozes. */
export interface Voice {
  id: string
  cueId: string
  audioId: string
  name: string
  duration: number
  loop: boolean
  volume: number
  paused: boolean
}
