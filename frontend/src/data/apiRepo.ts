import type { AudioAsset, Cue, Deck, Scene } from '../types'
import type { Repo } from './repo'

/**
 * Cliente HTTP do backend Django/DRF.
 *
 * Escrito contra o contrato que o backend vai expor. Trocar o mock por ele é
 * uma linha em `data/index.ts` — nenhum componente muda, porque nenhum
 * componente conhece a origem dos dados.
 *
 * Uma regra atravessa este arquivo: **nada aqui é chamado no caminho do
 * disparo.** O servidor entrega o deck no carregamento e some. Durante a peça
 * a rede pode cair sem que um único cue deixe de tocar.
 */

const BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

/** Erro com status, para a interface distinguir 404 de 500 de rede fora. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...init?.headers,
      },
    })
  } catch {
    throw new ApiError('o servidor local não respondeu — ele está rodando?', 0)
  }

  if (!res.ok) {
    throw new ApiError(await messageFor(res), res.status)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

async function messageFor(res: Response): Promise<string> {
  const fallback: Record<number, string> = {
    400: 'os dados enviados foram recusados',
    403: 'sem permissão para esta operação',
    404: 'esse item não existe mais no servidor',
    500: 'o servidor falhou ao processar',
  }
  try {
    const body = (await res.json()) as { detail?: string }
    if (body?.detail) return body.detail
  } catch {
    /* corpo não era JSON */
  }
  return fallback[res.status] ?? `o servidor respondeu ${res.status}`
}

/** O backend serve mídia por caminho relativo; o deck precisa de URL absoluta. */
function absolute(src: string): string {
  return /^https?:|^blob:/.test(src) ? src : `${BASE}${src}`
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})

export const apiRepo: Repo = {
  async load(): Promise<Deck> {
    const deck = await request<Deck>('/api/deck/')
    return {
      scenes: deck.scenes,
      cues: deck.cues,
      audios: deck.audios.map((a) => ({ ...a, src: absolute(a.src) })),
    }
  },

  createScene: (name) => request<Scene>('/api/scenes/', json('POST', { name })),
  renameScene: (id, name) => request<void>(`/api/scenes/${id}/`, json('PATCH', { name })),
  deleteScene: (id) =>
    request<{ scene: Scene; cues: Cue[] }>(`/api/scenes/${id}/`, json('DELETE')),
  restoreScene: (scene, cues) => request<void>('/api/scenes/restore/', json('POST', { scene, cues })),
  reorderScenes: (ids) => request<void>('/api/scenes/reorder/', json('POST', { ids })),

  createCue: (input) => request<Cue>('/api/cues/', json('POST', input)),
  updateCue: (id, patch) => request<void>(`/api/cues/${id}/`, json('PATCH', patch)),
  deleteCue: (id) => request<Cue>(`/api/cues/${id}/`, json('DELETE')),
  restoreCues: (cues) => request<void>('/api/cues/restore/', json('POST', { cues })),
  reorderCues: (sceneId, ids) =>
    request<void>('/api/cues/reorder/', json('POST', { scene: sceneId, ids })),

  async addAudio(file) {
    const form = new FormData()
    form.append('file', file)
    form.append('name', file.name.replace(/\.[^.]+$/, ''))
    const audio = await request<AudioAsset>('/api/audios/', { method: 'POST', body: form })
    return { ...audio, src: absolute(audio.src) }
  },

  updateAudio: (id, patch) => request<void>(`/api/audios/${id}/`, json('PATCH', patch)),
  deleteAudio: (id) =>
    request<{ audio: AudioAsset; cues: Cue[] }>(`/api/audios/${id}/`, json('DELETE')),
  restoreAudio: (audio, cues) =>
    request<void>('/api/audios/restore/', json('POST', { audio: audio.id, cues })),
}
