import type { AudioAsset, Cue, Day, Deck, Scene, Show } from '../types'
import type { DayBundle, PacoteRecebido, Repo, SceneBundle, ShowBundle } from './repo'

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
      shows: deck.shows,
      days: deck.days,
      scenes: deck.scenes,
      cues: deck.cues,
      audios: deck.audios.map((a) => ({ ...a, src: absolute(a.src) })),
    }
  },

  createShow: (input) => request<Show>('/api/shows/', json('POST', input)),
  updateShow: (id, patch) => request<void>(`/api/shows/${id}/`, json('PATCH', patch)),
  deleteShow: (id) => request<ShowBundle>(`/api/shows/${id}/`, json('DELETE')),
  restoreShow: (bundle) => request<void>('/api/shows/restore/', json('POST', bundle)),
  reorderShows: (ids) => request<void>('/api/shows/reorder/', json('POST', { ids })),
  duplicateShow: (id, input) => request<Show>(`/api/shows/${id}/duplicate/`, json('POST', input)),

  createDay: ({ showId, name, date }) =>
    request<Day>('/api/days/', json('POST', { show: showId, name, date })),
  updateDay: (id, patch) => request<void>(`/api/days/${id}/`, json('PATCH', patch)),
  deleteDay: (id) => request<DayBundle>(`/api/days/${id}/`, json('DELETE')),
  restoreDay: (bundle) => request<void>('/api/days/restore/', json('POST', bundle)),
  reorderDays: (showId, ids) =>
    request<void>('/api/days/reorder/', json('POST', { show: showId, ids })),
  duplicateDay: (id, input) => request<Day>(`/api/days/${id}/duplicate/`, json('POST', input)),

  createScene: (dayId, name) => request<Scene>('/api/scenes/', json('POST', { day: dayId, name })),
  renameScene: (id, name) => request<void>(`/api/scenes/${id}/`, json('PATCH', { name })),
  deleteScene: (id) => request<SceneBundle>(`/api/scenes/${id}/`, json('DELETE')),
  restoreScene: (bundle) => request<void>('/api/scenes/restore/', json('POST', bundle)),
  reorderScenes: (dayId, ids) =>
    request<void>('/api/scenes/reorder/', json('POST', { day: dayId, ids })),
  moveScene: (id, dayId) => request<void>(`/api/scenes/${id}/move/`, json('POST', { day: dayId })),
  copyScene: (id, dayId) =>
    request<Scene>(`/api/scenes/${id}/copy/`, json('POST', { day: dayId })),

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

  async exportarPacote() {
    // Fora do `request` de propósito: aquele espera JSON, e aqui a resposta é
    // um zip de megabytes que precisa chegar como `Blob` sem passar por
    // `JSON.parse`.
    let res: Response
    try {
      res = await fetch(`${BASE}/api/pacote/`)
    } catch {
      throw new ApiError('o servidor local não respondeu — ele está rodando?', 0)
    }
    if (!res.ok) throw new ApiError(await messageFor(res), res.status)
    return { blob: await res.blob(), nome: nomeDoAnexo(res.headers.get('Content-Disposition')) }
  },

  importarPacote(file) {
    const form = new FormData()
    form.append('file', file)
    return request<PacoteRecebido>('/api/pacote/', { method: 'POST', body: form })
  },
}

/**
 * O nome que o servidor deu ao arquivo, para o download não sair sem nome.
 *
 * Nomes de peça têm acento, e acento não cabe no cabeçalho: o servidor manda a
 * forma `filename*=utf-8''...`, percent-encoded, e é ela que vale quando
 * existe. A forma simples entre aspas fica como reserva.
 */
function nomeDoAnexo(header: string | null): string {
  const padrao = 'SoundDeck.sounddeck'
  if (!header) return padrao

  const estendido = /filename\*=utf-8''([^;]+)/i.exec(header)
  if (estendido?.[1]) {
    try {
      return decodeURIComponent(estendido[1])
    } catch {
      /* percent-encoding quebrado: cai no simples */
    }
  }

  const simples = /filename="?([^";]+)"?/i.exec(header)
  return simples?.[1] ?? padrao
}
