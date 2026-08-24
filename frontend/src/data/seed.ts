import type { Cue, Scene } from '../types'

/**
 * Roteiro de exemplo do modo mock: um espetáculo pequeno e plausível.
 *
 * As durações espelham `scripts/gen-audio.mjs` e servem só para exibição
 * enquanto o áudio ainda não armou — depois disso o engine manda.
 *
 * `musica-entrada` passa dos 45s de propósito: é o cue que exercita o caminho
 * de streaming, e ele aparece em duas cenas para provar que áudio é
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

export const SEED_SCENES: Scene[] = [
  { id: 's-abertura', name: 'Abertura', order: 0 },
  { id: 's-entrada', name: 'Entrada de Ana', order: 1 },
  { id: 's-confronto', name: 'Confronto', order: 2 },
  { id: 's-final', name: 'Final', order: 3 },
]

export const SEED_CUES: Cue[] = [
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
    cue: 'Na deixa "nunca mais"',
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
