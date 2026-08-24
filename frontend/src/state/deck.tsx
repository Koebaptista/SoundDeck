import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { AudioAsset, Cue, Deck, Scene } from '../types'
import { repo } from '../data'
import { engine } from '../audio/engine'

/**
 * Estado do deck: o que existe para tocar.
 *
 * Carrega uma vez na abertura e arma todo o áudio antes do primeiro clique.
 * Toda mutação passa pelo repositório e recarrega — o modo montar não é
 * sensível a latência, e consistência vale mais do que atualização otimista
 * numa ferramenta onde um cue fantasma custa a peça.
 */

type Status = 'loading' | 'ready' | 'error'

interface DeckStore {
  status: Status
  error: string | null
  deck: Deck
  /** Cues da cena, já ordenados. */
  cuesOf: (sceneId: string) => Cue[]
  audioOf: (audioId: string) => AudioAsset | undefined
  reload: () => Promise<void>
  /** Roda uma escrita e recarrega. Erros viram mensagem, nunca tela morta. */
  run: <T>(action: () => Promise<T>) => Promise<T | null>
  writeError: string | null
  dismissWriteError: () => void
}

const EMPTY: Deck = { scenes: [], audios: [], cues: [] }

const DeckContext = createContext<DeckStore | null>(null)

export function DeckProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)
  const [writeError, setWriteError] = useState<string | null>(null)
  const [deck, setDeck] = useState<Deck>(EMPTY)
  const armed = useRef(new Set<string>())

  const reload = useCallback(async () => {
    try {
      const next = await repo.load()
      setDeck(next)
      setStatus('ready')
      setError(null)

      // Arma só o que ainda não foi armado. Rearmar tudo a cada renomeação
      // faria o deck baixar a biblioteca inteira de novo.
      const pending = next.audios.filter((a) => !armed.current.has(a.id + a.src))
      if (pending.length > 0) {
        for (const a of pending) armed.current.add(a.id + a.src)
        void engine.arm(next.audios)
      }
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'não foi possível abrir o projeto')
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const run = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T | null> => {
      try {
        const result = await action()
        await reload()
        return result
      } catch (err) {
        setWriteError(err instanceof Error ? err.message : 'a operação falhou')
        return null
      }
    },
    [reload],
  )

  const byScene = useMemo(() => {
    const map = new Map<string, Cue[]>()
    for (const cue of deck.cues) {
      const list = map.get(cue.sceneId)
      if (list) list.push(cue)
      else map.set(cue.sceneId, [cue])
    }
    for (const list of map.values()) list.sort((a, b) => a.order - b.order)
    return map
  }, [deck.cues])

  const byAudio = useMemo(
    () => new Map(deck.audios.map((a) => [a.id, a])),
    [deck.audios],
  )

  const value = useMemo<DeckStore>(
    () => ({
      status,
      error,
      deck,
      cuesOf: (sceneId) => byScene.get(sceneId) ?? [],
      audioOf: (audioId) => byAudio.get(audioId),
      reload,
      run,
      writeError,
      dismissWriteError: () => setWriteError(null),
    }),
    [status, error, deck, byScene, byAudio, reload, run, writeError],
  )

  return <DeckContext.Provider value={value}>{children}</DeckContext.Provider>
}

export function useDeck(): DeckStore {
  const store = useContext(DeckContext)
  if (!store) throw new Error('useDeck precisa estar dentro de <DeckProvider>')
  return store
}

/** Cena ativa persistida entre sessões — o operador retoma onde parou. */
const ACTIVE_KEY = 'sounddeck:scene'

export function useActiveScene(scenes: Scene[]) {
  const [id, setId] = useState<string | null>(() => localStorage.getItem(ACTIVE_KEY))

  const active = scenes.find((s) => s.id === id) ?? scenes[0] ?? null

  useEffect(() => {
    if (active && active.id !== id) setId(active.id)
  }, [active, id])

  const select = useCallback((next: string) => {
    setId(next)
    localStorage.setItem(ACTIVE_KEY, next)
  }, [])

  return { active, select }
}
