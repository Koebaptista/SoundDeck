import type { AudioAsset, Cue, Deck, Scene } from '../types'

/**
 * A única porta de acesso a dados.
 *
 * Duas implementações intercambiáveis: `mockRepo` (localStorage + IndexedDB,
 * hoje) e `apiRepo` (cliente HTTP do Django, depois). Nenhum componente sabe
 * qual está ativa — trocar de backend é trocar esta linha em `data/index.ts`.
 */
export interface Repo {
  /** Entrega o deck inteiro de uma vez. Nada de rede no caminho do disparo. */
  load(): Promise<Deck>

  createScene(name: string): Promise<Scene>
  renameScene(id: string, name: string): Promise<void>
  /** Remove a cena e os cues dela. Devolve o que foi removido, para o desfazer. */
  deleteScene(id: string): Promise<{ scene: Scene; cues: Cue[] }>
  reorderScenes(ids: string[]): Promise<void>

  createCue(input: Omit<Cue, 'id' | 'order'>): Promise<Cue>
  updateCue(id: string, patch: Partial<Omit<Cue, 'id'>>): Promise<void>
  deleteCue(id: string): Promise<Cue>
  reorderCues(sceneId: string, ids: string[]): Promise<void>
  /** Reinsere um cue removido na posição original — o desfazer do toast. */
  restoreCues(cues: Cue[]): Promise<void>
  restoreScene(scene: Scene, cues: Cue[]): Promise<void>

  addAudio(file: File): Promise<AudioAsset>
  updateAudio(id: string, patch: Partial<Pick<AudioAsset, 'name' | 'description'>>): Promise<void>
  /** Remove o áudio e todo cue que dependia dele. */
  deleteAudio(id: string): Promise<{ audio: AudioAsset; cues: Cue[] }>
  /** Traz o áudio e seus cues de volta, dentro da janela de desfazer. */
  restoreAudio(audio: AudioAsset, cues: Cue[]): Promise<void>
}
