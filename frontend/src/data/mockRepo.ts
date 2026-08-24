import type { AudioAsset, Cue, Deck, Scene } from '../types'
import type { Repo } from './repo'
import { blobs } from './blobs'
import { SEED_AUDIOS, SEED_CUES, SEED_SCENES } from './seed'

/**
 * Repositório de mock: estrutura em `localStorage`, arquivos em IndexedDB.
 *
 * Escreve de forma síncrona e devolve promessas para ter exatamente a mesma
 * assinatura do cliente Django que virá depois. O modo montar não sabe a
 * diferença.
 */

const KEY = 'sounddeck:v1'

interface StoredAudio {
  id: string
  name: string
  description: string
  duration: number
  format: string
  size?: number
  /** Áudio que veio com o projeto, servido de `public/audio`. */
  file?: string
  /** Áudio enviado pelo operador, guardado como Blob no IndexedDB. */
  blobKey?: string
}

interface Stored {
  version: 1
  scenes: Scene[]
  cues: Cue[]
  audios: StoredAudio[]
}

const objectUrls = new Map<string, string>()

function seeded(): Stored {
  return {
    version: 1,
    scenes: structuredClone(SEED_SCENES),
    cues: structuredClone(SEED_CUES),
    audios: SEED_AUDIOS.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      duration: a.duration,
      format: 'WAV',
      file: a.file,
    })),
  }
}

function read(): Stored {
  const raw = localStorage.getItem(KEY)
  if (!raw) {
    const fresh = seeded()
    write(fresh)
    return fresh
  }
  try {
    const parsed = JSON.parse(raw) as Stored
    if (parsed.version !== 1) throw new Error('versão desconhecida')
    return parsed
  } catch {
    // Dados corrompidos não podem impedir a abertura do deck: recomeça do seed
    // em vez de deixar o operador com uma tela morta.
    const fresh = seeded()
    write(fresh)
    return fresh
  }
}

function write(state: Stored) {
  localStorage.setItem(KEY, JSON.stringify(state))
}

function mutate<T>(fn: (state: Stored) => T): Promise<T> {
  const state = read()
  const result = fn(state)
  reindex(state)
  write(state)
  return Promise.resolve(result)
}

/** Ordem é posição na lista, sempre densa — evita buracos depois de remover. */
function reindex(state: Stored) {
  state.scenes.sort((a, b) => a.order - b.order).forEach((s, i) => (s.order = i))
  const bySceneId = new Map<string, Cue[]>()
  for (const cue of state.cues) {
    const list = bySceneId.get(cue.sceneId) ?? []
    list.push(cue)
    bySceneId.set(cue.sceneId, list)
  }
  for (const list of bySceneId.values()) {
    list.sort((a, b) => a.order - b.order).forEach((c, i) => (c.order = i))
  }
}

async function resolveSrc(audio: StoredAudio): Promise<string> {
  if (audio.file) return `/audio/${audio.file}`
  if (!audio.blobKey) return ''
  const cached = objectUrls.get(audio.blobKey)
  if (cached) return cached
  const blob = await blobs.get(audio.blobKey)
  if (!blob) return ''
  const url = URL.createObjectURL(blob)
  objectUrls.set(audio.blobKey, url)
  return url
}

/** Lê a duração real do arquivo enviado antes de guardá-lo. */
function measure(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const el = new Audio()
    const done = (value: number) => {
      URL.revokeObjectURL(url)
      resolve(value)
    }
    el.addEventListener('loadedmetadata', () => done(el.duration || 0))
    el.addEventListener('error', () => done(0))
    el.preload = 'metadata'
    el.src = url
  })
}

const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

export const mockRepo: Repo = {
  async load(): Promise<Deck> {
    const state = read()
    const audios: AudioAsset[] = await Promise.all(
      state.audios.map(async (a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        duration: a.duration,
        format: a.format,
        size: a.size,
        src: await resolveSrc(a),
      })),
    )
    return {
      scenes: [...state.scenes].sort((a, b) => a.order - b.order),
      cues: [...state.cues].sort((a, b) => a.order - b.order),
      audios,
    }
  },

  createScene(name) {
    return mutate((state) => {
      const scene: Scene = { id: id('s'), name, order: state.scenes.length }
      state.scenes.push(scene)
      return scene
    })
  },

  renameScene(sceneId, name) {
    return mutate((state) => {
      const scene = state.scenes.find((s) => s.id === sceneId)
      if (scene) scene.name = name
    })
  },

  deleteScene(sceneId) {
    return mutate((state) => {
      const index = state.scenes.findIndex((s) => s.id === sceneId)
      const scene = state.scenes[index]
      if (!scene) throw new Error('cena não encontrada')
      const cues = state.cues.filter((c) => c.sceneId === sceneId)
      state.scenes.splice(index, 1)
      state.cues = state.cues.filter((c) => c.sceneId !== sceneId)
      return { scene, cues }
    })
  },

  restoreScene(scene, cues) {
    return mutate((state) => {
      for (const s of state.scenes) if (s.order >= scene.order) s.order += 1
      state.scenes.push(scene)
      state.cues.push(...cues)
    })
  },

  reorderScenes(ids) {
    return mutate((state) => {
      ids.forEach((sceneId, index) => {
        const scene = state.scenes.find((s) => s.id === sceneId)
        if (scene) scene.order = index
      })
    })
  },

  createCue(input) {
    return mutate((state) => {
      const order = state.cues.filter((c) => c.sceneId === input.sceneId).length
      const cue: Cue = { ...input, id: id('c'), order }
      state.cues.push(cue)
      return cue
    })
  },

  updateCue(cueId, patch) {
    return mutate((state) => {
      const cue = state.cues.find((c) => c.id === cueId)
      if (cue) Object.assign(cue, patch)
    })
  },

  deleteCue(cueId) {
    return mutate((state) => {
      const index = state.cues.findIndex((c) => c.id === cueId)
      const cue = state.cues[index]
      if (!cue) throw new Error('cue não encontrado')
      state.cues.splice(index, 1)
      return cue
    })
  },

  restoreCues(cues) {
    return mutate((state) => {
      for (const cue of cues) {
        for (const c of state.cues) {
          if (c.sceneId === cue.sceneId && c.order >= cue.order) c.order += 1
        }
        state.cues.push(cue)
      }
    })
  },

  reorderCues(sceneId, ids) {
    return mutate((state) => {
      ids.forEach((cueId, index) => {
        const cue = state.cues.find((c) => c.id === cueId && c.sceneId === sceneId)
        if (cue) cue.order = index
      })
    })
  },

  async addAudio(file) {
    const duration = await measure(file)
    const blobKey = id('blob')
    await blobs.put(blobKey, file)
    const stored: StoredAudio = {
      id: id('a'),
      name: file.name.replace(/\.[^.]+$/, ''),
      description: '',
      duration,
      format: (file.name.split('.').pop() ?? 'áudio').toUpperCase(),
      size: file.size,
      blobKey,
    }
    return mutate((state) => {
      state.audios.push(stored)
      return {
        id: stored.id,
        name: stored.name,
        description: stored.description,
        duration: stored.duration,
        format: stored.format,
        size: stored.size,
        src: URL.createObjectURL(file),
      }
    }).then((asset) => {
      objectUrls.set(blobKey, asset.src)
      return asset
    })
  },

  updateAudio(audioId, patch) {
    return mutate((state) => {
      const audio = state.audios.find((a) => a.id === audioId)
      if (audio) Object.assign(audio, patch)
    })
  },

  async deleteAudio(audioId) {
    const state = read()
    const stored = state.audios.find((a) => a.id === audioId)
    if (!stored) throw new Error('áudio não encontrado')

    // O Blob só é apagado depois que a janela de desfazer fecha. Apagar na
    // hora tornaria o "Desfazer" do aviso uma mentira para áudios enviados.
    if (stored.blobKey) {
      const key = stored.blobKey
      pendingDeletes.set(
        audioId,
        window.setTimeout(() => {
          pendingDeletes.delete(audioId)
          removed.delete(audioId)
          void blobs.remove(key)
          const url = objectUrls.get(key)
          if (url) {
            URL.revokeObjectURL(url)
            objectUrls.delete(key)
          }
        }, UNDO_WINDOW),
      )
    }
    removed.set(audioId, stored)

    return mutate((fresh) => {
      const audio: AudioAsset = {
        id: stored.id,
        name: stored.name,
        description: stored.description,
        duration: stored.duration,
        format: stored.format,
        size: stored.size,
        src: '',
      }
      const cues = fresh.cues.filter((c) => c.audioId === audioId)
      fresh.audios = fresh.audios.filter((a) => a.id !== audioId)
      fresh.cues = fresh.cues.filter((c) => c.audioId !== audioId)
      return { audio, cues }
    })
  },

  restoreAudio(audio, cues) {
    const stored = removed.get(audio.id)
    if (!stored) return Promise.reject(new Error('a janela de desfazer já fechou'))
    const timer = pendingDeletes.get(audio.id)
    if (timer) {
      window.clearTimeout(timer)
      pendingDeletes.delete(audio.id)
    }
    removed.delete(audio.id)
    return mutate((state) => {
      state.audios.push(stored)
      state.cues.push(...cues)
    })
  },
}

/** Precisa ser maior que a vida do aviso de desfazer em `state/toasts.tsx`. */
const UNDO_WINDOW = 12000
const pendingDeletes = new Map<string, number>()
const removed = new Map<string, StoredAudio>()

/** Usado pelo estado vazio: joga fora tudo e volta ao roteiro de exemplo. */
export function resetMock() {
  localStorage.removeItem(KEY)
  for (const url of objectUrls.values()) URL.revokeObjectURL(url)
  objectUrls.clear()
}

/** Deixa o projeto realmente vazio, para exercitar o primeiro uso. */
export function emptyMock() {
  write({ version: 1, scenes: [], cues: [], audios: [] })
}
