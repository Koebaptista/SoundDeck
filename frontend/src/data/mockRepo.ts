import type { AudioAsset, Cue, Day, Deck, Scene, Show } from '../types'
import type { Repo } from './repo'
import { blobs } from './blobs'
import { SEED_AUDIOS, SEED_CUES, SEED_DAYS, SEED_SCENES, SEED_SHOWS } from './seed'

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

/** Formato anterior ao conceito de peça e dia: cenas soltas na raiz. */
interface StoredV1 {
  version: 1
  scenes: { id: string; name: string; order: number }[]
  cues: Cue[]
  audios: StoredAudio[]
}

interface Stored {
  version: 2
  shows: Show[]
  days: Day[]
  scenes: Scene[]
  cues: Cue[]
  audios: StoredAudio[]
}

const objectUrls = new Map<string, string>()

function seeded(): Stored {
  return {
    version: 2,
    shows: structuredClone(SEED_SHOWS),
    days: structuredClone(SEED_DAYS),
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

/**
 * Projeto da versão anterior: tudo que existia era uma temporada de um dia só.
 *
 * A migração inventa a peça e o dia que faltavam em vez de descartar o
 * trabalho — quem já tinha um roteiro montado abre o deck e encontra ele
 * inteiro, um nível abaixo.
 */
function migrate(old: StoredV1): Stored {
  const show: Show = { id: 'p-migrado', name: 'Meu espetáculo', venue: '', order: 0 }
  const day: Day = { id: 'd-migrado', showId: show.id, name: 'Dia 1', date: null, order: 0 }
  return {
    version: 2,
    shows: [show],
    days: [day],
    scenes: old.scenes.map((s) => ({ ...s, dayId: day.id })),
    cues: old.cues,
    audios: old.audios,
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
    const parsed = JSON.parse(raw) as Stored | StoredV1
    if (parsed.version === 1) {
      const migrated = migrate(parsed)
      write(migrated)
      return migrated
    }
    if (parsed.version !== 2) throw new Error('versão desconhecida')
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

/**
 * Ordem é posição na lista, sempre densa — evita buracos depois de remover.
 *
 * Cada nível é reindexado dentro do pai: dias dentro da peça, cenas dentro do
 * dia, cues dentro da cena. Sem isso, mover uma cena de dia deixaria dois
 * blocos com o mesmo número no deck.
 */
function reindex(state: Stored) {
  state.shows.sort((a, b) => a.order - b.order).forEach((s, i) => (s.order = i))
  densify(state.days, (d) => d.showId)
  densify(state.scenes, (s) => s.dayId)
  densify(state.cues, (c) => c.sceneId)
}

function densify<T extends { order: number }>(items: T[], parentOf: (item: T) => string) {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const list = groups.get(parentOf(item))
    if (list) list.push(item)
    else groups.set(parentOf(item), [item])
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.order - b.order).forEach((item, i) => (item.order = i))
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

const id = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

const inDay = (state: Stored, dayId: string) => state.scenes.filter((s) => s.dayId === dayId)

/**
 * Copia cenas e cues para dentro de um dia, no fim do roteiro dele.
 *
 * É a operação por trás de duplicar dia, duplicar peça e copiar cena: em todas
 * elas o cue precisa de id novo e de apontar para a cena nova, senão as duas
 * cópias passam a editar o mesmo cue.
 */
function copyInto(state: Stored, scenes: Scene[], cues: Cue[], dayId: string): Scene[] {
  let order = inDay(state, dayId).length
  const created: Scene[] = []
  for (const scene of [...scenes].sort((a, b) => a.order - b.order)) {
    const copy: Scene = { id: id('s'), dayId, name: scene.name, order: order++ }
    state.scenes.push(copy)
    created.push(copy)
    for (const cue of cues.filter((c) => c.sceneId === scene.id)) {
      state.cues.push({ ...cue, id: id('c'), sceneId: copy.id })
    }
  }
  return created
}

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
    const byOrder = <T extends { order: number }>(list: T[]) =>
      [...list].sort((a, b) => a.order - b.order)
    return {
      shows: byOrder(state.shows),
      days: byOrder(state.days),
      scenes: byOrder(state.scenes),
      cues: byOrder(state.cues),
      audios,
    }
  },

  /* ---------------- peças ---------------- */

  createShow({ name, venue }) {
    return mutate((state) => {
      const show: Show = { id: id('p'), name, venue, order: state.shows.length }
      state.shows.push(show)
      // Uma peça sem dia nenhum não tem onde guardar cena. O primeiro dia vem
      // junto para o operador nunca cair num lugar sem saída.
      state.days.push({ id: id('d'), showId: show.id, name: 'Dia 1', date: null, order: 0 })
      return show
    })
  },

  updateShow(showId, patch) {
    return mutate((state) => {
      const show = state.shows.find((s) => s.id === showId)
      if (show) Object.assign(show, patch)
    })
  },

  deleteShow(showId) {
    return mutate((state) => {
      const index = state.shows.findIndex((s) => s.id === showId)
      const show = state.shows[index]
      if (!show) throw new Error('peça não encontrada')

      const days = state.days.filter((d) => d.showId === showId)
      const dayIds = new Set(days.map((d) => d.id))
      const scenes = state.scenes.filter((s) => dayIds.has(s.dayId))
      const sceneIds = new Set(scenes.map((s) => s.id))
      const cues = state.cues.filter((c) => sceneIds.has(c.sceneId))

      state.shows.splice(index, 1)
      state.days = state.days.filter((d) => d.showId !== showId)
      state.scenes = state.scenes.filter((s) => !dayIds.has(s.dayId))
      state.cues = state.cues.filter((c) => !sceneIds.has(c.sceneId))

      return { show, days, scenes, cues }
    })
  },

  restoreShow({ show, days, scenes, cues }) {
    return mutate((state) => {
      for (const s of state.shows) if (s.order >= show.order) s.order += 1
      state.shows.push(show)
      state.days.push(...days)
      state.scenes.push(...scenes)
      state.cues.push(...cues)
    })
  },

  reorderShows(ids) {
    return mutate((state) => {
      ids.forEach((showId, index) => {
        const show = state.shows.find((s) => s.id === showId)
        if (show) show.order = index
      })
    })
  },

  duplicateShow(showId, { name, venue }) {
    return mutate((state) => {
      const source = state.shows.find((s) => s.id === showId)
      if (!source) throw new Error('peça não encontrada')

      const show: Show = { id: id('p'), name, venue, order: state.shows.length }
      state.shows.push(show)

      const days = state.days
        .filter((d) => d.showId === showId)
        .sort((a, b) => a.order - b.order)
      days.forEach((day, index) => {
        const copy: Day = {
          id: id('d'),
          showId: show.id,
          name: day.name,
          date: day.date,
          order: index,
        }
        state.days.push(copy)
        const scenes = inDay(state, day.id)
        const sceneIds = new Set(scenes.map((s) => s.id))
        copyInto(
          state,
          scenes,
          state.cues.filter((c) => sceneIds.has(c.sceneId)),
          copy.id,
        )
      })

      return show
    })
  },

  /* ---------------- dias ---------------- */

  createDay({ showId, name, date }) {
    return mutate((state) => {
      const order = state.days.filter((d) => d.showId === showId).length
      const day: Day = { id: id('d'), showId, name, date, order }
      state.days.push(day)
      return day
    })
  },

  updateDay(dayId, patch) {
    return mutate((state) => {
      const day = state.days.find((d) => d.id === dayId)
      if (day) Object.assign(day, patch)
    })
  },

  deleteDay(dayId) {
    return mutate((state) => {
      const index = state.days.findIndex((d) => d.id === dayId)
      const day = state.days[index]
      if (!day) throw new Error('dia não encontrado')

      const scenes = state.scenes.filter((s) => s.dayId === dayId)
      const sceneIds = new Set(scenes.map((s) => s.id))
      const cues = state.cues.filter((c) => sceneIds.has(c.sceneId))

      state.days.splice(index, 1)
      state.scenes = state.scenes.filter((s) => s.dayId !== dayId)
      state.cues = state.cues.filter((c) => !sceneIds.has(c.sceneId))

      return { day, scenes, cues }
    })
  },

  restoreDay({ day, scenes, cues }) {
    return mutate((state) => {
      for (const d of state.days) {
        if (d.showId === day.showId && d.order >= day.order) d.order += 1
      }
      state.days.push(day)
      state.scenes.push(...scenes)
      state.cues.push(...cues)
    })
  },

  reorderDays(showId, ids) {
    return mutate((state) => {
      ids.forEach((dayId, index) => {
        const day = state.days.find((d) => d.id === dayId && d.showId === showId)
        if (day) day.order = index
      })
    })
  },

  duplicateDay(dayId, { name, date }) {
    return mutate((state) => {
      const source = state.days.find((d) => d.id === dayId)
      if (!source) throw new Error('dia não encontrado')

      const day: Day = {
        id: id('d'),
        showId: source.showId,
        name,
        date,
        order: state.days.filter((d) => d.showId === source.showId).length,
      }
      state.days.push(day)

      const scenes = inDay(state, source.id)
      const sceneIds = new Set(scenes.map((s) => s.id))
      copyInto(
        state,
        scenes,
        state.cues.filter((c) => sceneIds.has(c.sceneId)),
        day.id,
      )

      return day
    })
  },

  /* ---------------- cenas ---------------- */

  createScene(dayId, name) {
    return mutate((state) => {
      const scene: Scene = { id: id('s'), dayId, name, order: inDay(state, dayId).length }
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

  restoreScene({ scene, cues }) {
    return mutate((state) => {
      for (const s of state.scenes) {
        if (s.dayId === scene.dayId && s.order >= scene.order) s.order += 1
      }
      state.scenes.push(scene)
      state.cues.push(...cues)
    })
  },

  reorderScenes(dayId, ids) {
    return mutate((state) => {
      ids.forEach((sceneId, index) => {
        const scene = state.scenes.find((s) => s.id === sceneId && s.dayId === dayId)
        if (scene) scene.order = index
      })
    })
  },

  moveScene(sceneId, dayId) {
    return mutate((state) => {
      const scene = state.scenes.find((s) => s.id === sceneId)
      if (!scene) throw new Error('cena não encontrada')
      if (!state.days.some((d) => d.id === dayId)) throw new Error('dia não encontrado')
      if (scene.dayId === dayId) return
      scene.dayId = dayId
      // Entra no fim do roteiro do destino: adivinhar posição no meio de um dia
      // que o operador não está olhando seria pior do que deixá-lo arrastar.
      scene.order = inDay(state, dayId).length
    })
  },

  copyScene(sceneId, dayId) {
    return mutate((state) => {
      const scene = state.scenes.find((s) => s.id === sceneId)
      if (!scene) throw new Error('cena não encontrada')
      const [copy] = copyInto(
        state,
        [scene],
        state.cues.filter((c) => c.sceneId === sceneId),
        dayId,
      )
      if (!copy) throw new Error('não foi possível copiar a cena')
      return copy
    })
  },

  /* ---------------- cues ---------------- */

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

  /* ---------------- biblioteca ---------------- */

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
  write({ version: 2, shows: [], days: [], scenes: [], cues: [], audios: [] })
}
