import { useState } from 'react'
import type { Scene } from '../../types'
import { repo } from '../../data'
import { useDeck } from '../../state/deck'
import { useToasts } from '../../state/toasts'
import { plural } from '../../lib/format'
import { InlineText } from '../../components/InlineText'
import { DownIcon, PlusIcon, TrashIcon, UpIcon } from '../../icons'

/**
 * Cenas: renomear, reordenar, remover.
 *
 * A ordem aqui é a ordem do espetáculo, e a numeração que o operador vê no
 * modo operar sai daqui. Remover não pergunta nada — remove e oferece desfazer.
 */

export function ScenesPanel({
  scenes,
  activeId,
  onSelect,
  onEditCues,
}: {
  scenes: Scene[]
  activeId: string | null
  onSelect: (id: string) => void
  onEditCues: (id: string) => void
}) {
  const { cuesOf, run } = useDeck()
  const { push } = useToasts()
  const [name, setName] = useState('')

  const move = async (index: number, delta: number) => {
    const next = [...scenes]
    const target = index + delta
    const a = next[index]
    const b = next[target]
    if (!a || !b) return
    next[index] = b
    next[target] = a
    await run(() => repo.reorderScenes(next.map((s) => s.id)))
  }

  const remove = async (scene: Scene) => {
    const removed = await run(() => repo.deleteScene(scene.id))
    if (!removed) return
    push({
      message: `Cena "${scene.name}" removida com ${plural(removed.cues.length, 'cue', 'cues')}.`,
      tone: 'warn',
      action: {
        label: 'Desfazer',
        run: () => void run(() => repo.restoreScene(removed.scene, removed.cues)),
      },
    })
  }

  const add = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const scene = await run(() => repo.createScene(trimmed))
    setName('')
    if (scene) onSelect(scene.id)
  }

  return (
    <section className="panel">
      <header className="panel__head">
        <h2 className="panel__title">Cenas</h2>
        <p className="panel__hint">
          A ordem desta lista é a ordem do roteiro. Ela vira a numeração que aparece no deck.
        </p>
      </header>

      {scenes.length === 0 ? (
        <div className="empty empty--inline">
          <p className="empty__title">Nenhuma cena ainda</p>
          <p className="empty__body">
            Uma cena é um bloco do roteiro — “Abertura”, “Entrada de Ana”. Os cues moram dentro
            delas.
          </p>
        </div>
      ) : (
        <ol className="rows">
          {scenes.map((scene, index) => (
            <li className="row" key={scene.id} data-active={scene.id === activeId || undefined}>
              <span className="row__num num">{String(index + 1).padStart(2, '0')}</span>

              <div className="row__grow">
                <InlineText
                  label={`Nome da cena ${index + 1}`}
                  value={scene.name}
                  required
                  onCommit={(name) => void run(() => repo.renameScene(scene.id, name))}
                />
              </div>

              <button type="button" className="btn btn--ghost" onClick={() => onEditCues(scene.id)}>
                {plural(cuesOf(scene.id).length, 'cue', 'cues')}
              </button>

              <div className="row__actions">
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => void move(index, -1)}
                  disabled={index === 0}
                  aria-label={`Mover ${scene.name} para cima`}
                >
                  <UpIcon size={14} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => void move(index, 1)}
                  disabled={index === scenes.length - 1}
                  aria-label={`Mover ${scene.name} para baixo`}
                >
                  <DownIcon size={14} />
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn--danger"
                  onClick={() => void remove(scene)}
                  aria-label={`Remover cena ${scene.name}`}
                >
                  <TrashIcon size={14} />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <form className="addbar" onSubmit={add}>
        <label className="row__grow">
          <span className="sr-only">Nome da nova cena</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da cena"
          />
        </label>
        <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
          <PlusIcon size={14} />
          Adicionar cena
        </button>
      </form>
    </section>
  )
}
