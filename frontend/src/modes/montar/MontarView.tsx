import { useId, useState } from 'react'
import type { Scene } from '../../types'
import { ScenesPanel } from './ScenesPanel'
import { CuesPanel } from './CuesPanel'
import { LibraryPanel } from './LibraryPanel'

/**
 * Modo MONTAR — tudo que não acontece durante a peça.
 *
 * Coluna única, denso, formulários compactos. É aqui que mora todo o
 * destrutivo, e é por isso que ele não mora no modo operar.
 */

type Tab = 'cenas' | 'cues' | 'biblioteca'

const TABS: { id: Tab; label: string }[] = [
  { id: 'cenas', label: 'Cenas' },
  { id: 'cues', label: 'Cues da cena' },
  { id: 'biblioteca', label: 'Biblioteca' },
]

type Props = {
  scene: Scene | null
  scenes: Scene[]
  onSelectScene: (id: string) => void
}

export function MontarView({ scene, scenes, onSelectScene }: Props) {
  const [tab, setTab] = useState<Tab>('cenas')
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
              onClick={() => setTab(item.id)}
              onKeyDown={(e) => {
                const index = TABS.findIndex((t) => t.id === tab)
                const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
                if (!delta) return
                e.preventDefault()
                const next = TABS[(index + delta + TABS.length) % TABS.length]!
                setTab(next.id)
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
          {tab === 'cenas' && (
            <ScenesPanel
              scenes={scenes}
              activeId={scene?.id ?? null}
              onSelect={onSelectScene}
              onEditCues={(id) => {
                onSelectScene(id)
                setTab('cues')
              }}
            />
          )}
          {tab === 'cues' && (
            <CuesPanel
              scene={scene}
              scenes={scenes}
              onSelectScene={onSelectScene}
              onGoLibrary={() => setTab('biblioteca')}
              onGoScenes={() => setTab('cenas')}
            />
          )}
          {tab === 'biblioteca' && <LibraryPanel />}
        </div>
      </div>
    </div>
  )
}
