import type { AudioAsset, Cue, Day, Deck, Scene, Show } from '../types'

/**
 * A única porta de acesso a dados.
 *
 * Duas implementações intercambiáveis: `mockRepo` (localStorage + IndexedDB,
 * hoje) e `apiRepo` (cliente HTTP do Django, depois). Nenhum componente sabe
 * qual está ativa — trocar de backend é trocar esta linha em `data/index.ts`.
 *
 * Remover é sempre em cascata e sempre devolve o que levou junto: o desfazer
 * do aviso precisa recompor a árvore inteira, não só a linha clicada.
 */

/** Uma peça e tudo que morria com ela. */
export interface ShowBundle {
  show: Show
  days: Day[]
  scenes: Scene[]
  cues: Cue[]
}

/** Um dia e tudo que morria com ele. */
export interface DayBundle {
  day: Day
  scenes: Scene[]
  cues: Cue[]
}

export interface SceneBundle {
  scene: Scene
  cues: Cue[]
}

export interface Repo {
  /** Entrega o projeto inteiro de uma vez. Nada de rede no caminho do disparo. */
  load(): Promise<Deck>

  createShow(input: { name: string; venue: string }): Promise<Show>
  updateShow(id: string, patch: Partial<Pick<Show, 'name' | 'venue'>>): Promise<void>
  deleteShow(id: string): Promise<ShowBundle>
  restoreShow(bundle: ShowBundle): Promise<void>
  reorderShows(ids: string[]): Promise<void>
  /** Copia a peça inteira — dias, cenas e cues. O mesmo roteiro em outro teatro. */
  duplicateShow(id: string, input: { name: string; venue: string }): Promise<Show>

  createDay(input: { showId: string; name: string; date: string | null }): Promise<Day>
  updateDay(id: string, patch: Partial<Pick<Day, 'name' | 'date'>>): Promise<void>
  deleteDay(id: string): Promise<DayBundle>
  restoreDay(bundle: DayBundle): Promise<void>
  reorderDays(showId: string, ids: string[]): Promise<void>
  /** Copia o dia com todas as cenas e cues — a segunda noite da mesma peça. */
  duplicateDay(id: string, input: { name: string; date: string | null }): Promise<Day>

  createScene(dayId: string, name: string): Promise<Scene>
  renameScene(id: string, name: string): Promise<void>
  /** Remove a cena e os cues dela. Devolve o que foi removido, para o desfazer. */
  deleteScene(id: string): Promise<SceneBundle>
  restoreScene(bundle: SceneBundle): Promise<void>
  reorderScenes(dayId: string, ids: string[]): Promise<void>
  /** Realoca a cena em outro dia, no fim do roteiro dele. */
  moveScene(id: string, dayId: string): Promise<void>
  /** Copia a cena e seus cues para um dia — o mesmo bloco em duas sessões. */
  copyScene(id: string, dayId: string): Promise<Scene>

  createCue(input: Omit<Cue, 'id' | 'order'>): Promise<Cue>
  updateCue(id: string, patch: Partial<Omit<Cue, 'id'>>): Promise<void>
  deleteCue(id: string): Promise<Cue>
  reorderCues(sceneId: string, ids: string[]): Promise<void>
  /** Reinsere um cue removido na posição original — o desfazer do toast. */
  restoreCues(cues: Cue[]): Promise<void>

  addAudio(file: File): Promise<AudioAsset>
  updateAudio(id: string, patch: Partial<Pick<AudioAsset, 'name' | 'description'>>): Promise<void>
  /** Remove o áudio e todo cue que dependia dele, em qualquer peça. */
  deleteAudio(id: string): Promise<{ audio: AudioAsset; cues: Cue[] }>
  /** Traz o áudio e seus cues de volta, dentro da janela de desfazer. */
  restoreAudio(audio: AudioAsset, cues: Cue[]): Promise<void>
}
