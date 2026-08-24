import { useId } from 'react'
import type { Day, Scene, Show } from '../../types'
import { ShowsPanel } from './ShowsPanel'
import { DaysPanel } from './DaysPanel'
import { ScenesPanel } from './ScenesPanel'
import { CuesPanel } from './CuesPanel'
import { LibraryPanel } from './LibraryPanel'

/**
 * Modo MONTAR — tudo que não acontece durante a peça.
 *
 * Coluna única, denso, formulários compactos. É aqui que mora todo o
 * destrutivo, e é por isso que ele não mora no modo operar.
 *
 * As abas seguem a hierarquia do domínio, da mais larga para a mais estreita:
 * peça → dia → cena → cue. A biblioteca fica no fim porque é a única coisa
 * global, compartilhada por todas as peças.
 */

export type MontarTab = 'pecas' | 'dias' | 'cenas' | 'cues' | 'biblioteca'

const TABS: { id: MontarTab; label: string }[] = [
  { id: 'pecas', label: 'Peças' },
  { id: 'dias', label: 'Dias' },
  { id: 'cenas', label: 'Cenas' },
  { id: 'cues', label: 'Cues da cena' },
  { id: 'biblioteca', label: 'Biblioteca' },
]

type Props = {
  /** Controlada de fora: o seletor de peça também manda abrir uma aba daqui. */
  tab: MontarTab
  onTab: (tab: MontarTab) => void
  show: Show | null
  day: Day | null
  days: Day[]
  scene: Scene | null
  scenes: Scene[]
  onSelectShow: (id: string) => void
  onSelectDay: (id: string) => void
  onSelectScene: (id: string) => void
}

export function MontarView({
  tab,
  onTab,
  show,
  day,
  days,
  scene,
  scenes,
  onSelectShow,
  onSelectDay,
  onSelectScene,
}: Props) {
  const base = useId()

  return (
    <div className="montar">
      <div className="montar__inner">
        <div className="tabs" role="tablist" aria-label="Seções da montagem">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`${base}-${item.id}`}
              className="tabs__tab"
              aria-selected={tab === item.id}
              aria-controls={`${base}-${item.id}-panel`}
              tabIndex={tab === item.id ? 0 : -1}
              onClick={() => onTab(item.id)}
              onKeyDown={(e) => {
                const index = TABS.findIndex((t) => t.id === tab)
                const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
                if (!delta) return
                e.preventDefault()
                const next = TABS[(index + delta + TABS.length) % TABS.length]!
                onTab(next.id)
                document.getElementById(`${base}-${next.id}`)?.focus()
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`${base}-${tab}-panel`}
          aria-labelledby={`${base}-${tab}`}
          className="montar__panel"
        >
          {tab === 'pecas' && (
            <ShowsPanel
              activeId={show?.id ?? null}
              onSelect={onSelectShow}
              onEditDays={(id) => {
                onSelectShow(id)
                onTab('dias')
              }}
            />
          )}
          {tab === 'dias' && (
            <DaysPanel
              show={show}
              days={days}
              activeId={day?.id ?? null}
              onSelect={onSelectDay}
              onEditScenes={(id) => {
                onSelectDay(id)
                onTab('cenas')
              }}
              onGoShows={() => onTab('pecas')}
            />
          )}
          {tab === 'cenas' && (
            <ScenesPanel
              day={day}
              days={days}
              scenes={scenes}
              activeId={scene?.id ?? null}
              onSelect={onSelectScene}
              onEditCues={(id) => {
                onSelectScene(id)
                onTab('cues')
              }}
              onGoDays={() => onTab('dias')}
            />
          )}
          {tab === 'cues' && (
            <CuesPanel
              day={day}
              scene={scene}
              scenes={scenes}
              onSelectScene={onSelectScene}
              onGoLibrary={() => onTab('biblioteca')}
              onGoScenes={() => onTab('cenas')}
            />
          )}
          {tab === 'biblioteca' && <LibraryPanel />}
        </div>
      </div>
    </div>
  )
}
