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
import type { AudioAsset, Cue, Day, Deck, Scene } from '../types'
import { repo } from '../data'
import { engine } from '../audio/engine'

/**
 * Estado do deck: o que existe para tocar.
 *
 * Carrega uma vez na abertura e arma todo o áudio antes do primeiro clique.
 * Toda mutação passa pelo repositório e recarrega — o modo montar não é
 * sensível a latência, e consistência vale mais do que atualização otimista
 * numa ferramenta onde um cue fantasma custa a peça.
 *
 * O deck guarda o projeto inteiro, com todas as peças e todos os dias. Só a
 * biblioteca de áudio é global; a navegação recorta o resto (ver `useSelection`).
 */

type Status = 'loading' | 'ready' | 'error'

interface DeckStore {
  status: Status
  error: string | null
  deck: Deck
  /** Dias da peça, já ordenados. */
  daysOf: (showId: string) => Day[]
  /** Cenas do dia, já ordenadas. */
  scenesOf: (dayId: string) => Scene[]
  /** Cues da cena, já ordenados. */
  cuesOf: (sceneId: string) => Cue[]
  audioOf: (audioId: string) => AudioAsset | undefined
  reload: () => Promise<void>
  /** Roda uma escrita e recarrega. Erros viram mensagem, nunca tela morta. */
  run: <T>(action: () => Promise<T>) => Promise<T | null>
  writeError: string | null
  dismissWriteError: () => void
}

const EMPTY: Deck = { shows: [], days: [], scenes: [], audios: [], cues: [] }

const DeckContext = createContext<DeckStore | null>(null)

/** Agrupa por pai uma vez, em vez de varrer a lista inteira por linha na tela. */
function groupBy<T extends { order: number }>(items: T[], parentOf: (item: T) => string) {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const list = map.get(parentOf(item))
    if (list) list.push(item)
    else map.set(parentOf(item), [item])
  }
  for (const list of map.values()) list.sort((a, b) => a.order - b.order)
  return map
}

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

  const byShow = useMemo(() => groupBy(deck.days, (d) => d.showId), [deck.days])
  const byDay = useMemo(() => groupBy(deck.scenes, (s) => s.dayId), [deck.scenes])
  const byScene = useMemo(() => groupBy(deck.cues, (c) => c.sceneId), [deck.cues])
  const byAudio = useMemo(() => new Map(deck.audios.map((a) => [a.id, a])), [deck.audios])

  const value = useMemo<DeckStore>(
    () => ({
      status,
      error,
      deck,
      daysOf: (showId) => byShow.get(showId) ?? [],
      scenesOf: (dayId) => byDay.get(dayId) ?? [],
      cuesOf: (sceneId) => byScene.get(sceneId) ?? [],
      audioOf: (audioId) => byAudio.get(audioId),
      reload,
      run,
      writeError,
      dismissWriteError: () => setWriteError(null),
    }),
    [status, error, deck, byShow, byDay, byScene, byAudio, reload, run, writeError],
  )

  return <DeckContext.Provider value={value}>{children}</DeckContext.Provider>
}

export function useDeck(): DeckStore {
  const store = useContext(DeckContext)
  if (!store) throw new Error('useDeck precisa estar dentro de <DeckProvider>')
  return store
}

/** Onde o operador estava. Persistido: ele abre o deck e retoma no mesmo lugar. */
const SELECTION_KEY = 'sounddeck:selection'

interface Selection {
  showId: string | null
  dayId: string | null
  sceneId: string | null
}

const NOTHING: Selection = { showId: null, dayId: null, sceneId: null }

function storedSelection(): Selection {
  try {
    const raw = localStorage.getItem(SELECTION_KEY)
    if (raw) return { ...NOTHING, ...(JSON.parse(raw) as Selection) }
  } catch {
    /* seleção corrompida cai no primeiro item, que sempre existe */
  }
  // Antes das peças o deck só guardava a cena. Aproveita o que dá.
  const legacy = localStorage.getItem('sounddeck:scene')
  return legacy ? { ...NOTHING, sceneId: legacy } : NOTHING
}

/**
 * Peça, dia e cena ativos.
 *
 * Toda escolha é resolvida contra o que existe agora: apagar o dia em que se
 * estava não pode deixar o deck apontando para o vazio, então a resolução cai
 * sempre no primeiro item do nível. Trocar de peça zera o dia e a cena — ficar
 * com a cena da peça anterior selecionada seria pior do que recomeçar do topo.
 */
export function useSelection(deck: Deck) {
  const [selection, setSelection] = useState<Selection>(storedSelection)

  const show = deck.shows.find((s) => s.id === selection.showId) ?? deck.shows[0] ?? null

  const days = useMemo(
    () => deck.days.filter((d) => d.showId === show?.id).sort((a, b) => a.order - b.order),
    [deck.days, show?.id],
  )
  const day = days.find((d) => d.id === selection.dayId) ?? days[0] ?? null

  const scenes = useMemo(
    () => deck.scenes.filter((s) => s.dayId === day?.id).sort((a, b) => a.order - b.order),
    [deck.scenes, day?.id],
  )
  const scene = scenes.find((s) => s.id === selection.sceneId) ?? scenes[0] ?? null

  // Grava o que foi resolvido, não o que foi pedido: assim a próxima abertura
  // já começa de um estado válido.
  //
  // Nada é gravado enquanto o deck não chegou. Durante o carregamento não há
  // peça nenhuma para resolver, e escrever o vazio apagaria justamente a
  // seleção da sessão anterior, um instante antes de ela poder ser usada.
  useEffect(() => {
    if (deck.shows.length === 0) return
    const next: Selection = {
      showId: show?.id ?? null,
      dayId: day?.id ?? null,
      sceneId: scene?.id ?? null,
    }
    if (
      next.showId !== selection.showId ||
      next.dayId !== selection.dayId ||
      next.sceneId !== selection.sceneId
    ) {
      setSelection(next)
    }
    localStorage.setItem(SELECTION_KEY, JSON.stringify(next))
  }, [deck.shows.length, show?.id, day?.id, scene?.id, selection])

  const selectShow = useCallback((showId: string) => {
    setSelection({ showId, dayId: null, sceneId: null })
  }, [])

  const selectDay = useCallback((dayId: string) => {
    setSelection((current) => ({ ...current, dayId, sceneId: null }))
  }, [])

  const selectScene = useCallback((sceneId: string) => {
    setSelection((current) => ({ ...current, sceneId }))
  }, [])

  return { show, day, scene, days, scenes, selectShow, selectDay, selectScene }
}
