import type { Scene } from '../../types'
import { plural } from '../../lib/format'

/**
 * Navegação entre cenas. Navegação, não conteúdo: compacta, numerada, e nunca
 * disputando peso visual com a grade de cues.
 *
 * A numeração forte é a única orientação de roteiro que o produto impõe —
 * sem fila sequencial, sem botão GO. Abaixo de 1100px o CSS transforma esta
 * mesma marcação em uma barra de abas no topo.
 */

type Props = {
  scenes: Scene[]
  activeId: string | null
  countOf: (sceneId: string) => number
  liveIn: (sceneId: string) => boolean
  onSelect: (id: string) => void
}

export function SceneRail({ scenes, activeId, countOf, liveIn, onSelect }: Props) {
  return (
    <nav className="rail" aria-label="Cenas">
      <h2 className="rail__title">Cenas</h2>
      <ol className="rail__list">
        {scenes.map((scene, index) => {
          const count = countOf(scene.id)
          return (
            <li key={scene.id}>
              <button
                type="button"
                className="rail__item"
                aria-current={scene.id === activeId ? 'true' : undefined}
                onClick={() => onSelect(scene.id)}
              >
                <span className="rail__num num">{String(index + 1).padStart(2, '0')}</span>
                <span className="rail__name">{scene.name}</span>
                {liveIn(scene.id) && (
                  <span className="rail__live" title="tem som tocando">
                    <span className="sr-only">tem som tocando</span>
                  </span>
                )}
                <span className="rail__count num" aria-label={plural(count, 'cue', 'cues')}>
                  {count}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
