import { useState } from 'react'
import type { Day, Scene } from '../../types'
import { repo } from '../../data'
import { blurOnWheel } from '../../lib/select'
import { useDeck } from '../../state/deck'
import { useToasts } from '../../state/toasts'
import { plural } from '../../lib/format'
import { InlineText } from '../../components/InlineText'
import { CopyIcon, DownIcon, NextIcon, PlusIcon, TrashIcon, UpIcon } from '../../icons'

/**
 * Cenas do dia ativo: renomear, reordenar, realocar, remover.
 *
 * A ordem aqui é a ordem do espetáculo naquela noite, e a numeração que o
 * operador vê no modo operar sai daqui. Remover não pergunta nada — remove e
 * oferece desfazer.
 *
 * O seletor de dia em cada linha é o que separa uma temporada de um roteiro
 * só: a cena que saiu da sessão de sábado vai para a de domingo sem ser
 * remontada, com os cues junto.
 */

export function ScenesPanel({
  day,
  days,
  scenes,
  activeId,
  onSelect,
  onEditCues,
  onGoDays,
}: {
  day: Day | null
  days: Day[]
  scenes: Scene[]
  activeId: string | null
  onSelect: (id: string) => void
  onEditCues: (id: string) => void
  onGoDays: () => void
}) {
  const { cuesOf, run } = useDeck()
  const { push } = useToasts()
  const [name, setName] = useState('')

  if (!day) {
    return (
      <section className="panel">
        <div className="empty empty--inline">
          <p className="empty__title">Crie um dia primeiro</p>
          <p className="empty__body">
            As cenas pertencem a uma apresentação — é o dia que diz qual roteiro sobe ao palco.
          </p>
          <button type="button" className="btn btn--primary" onClick={onGoDays}>
            Ir para dias
          </button>
        </div>
      </section>
    )
  }

  const move = async (index: number, delta: number) => {
    const next = [...scenes]
    const a = next[index]
    const b = next[index + delta]
    if (!a || !b) return
    next[index] = b
    next[index + delta] = a
    await run(() => repo.reorderScenes(day.id, next.map((s) => s.id)))
  }

  const moveToDay = async (scene: Scene, dayId: string) => {
    const target = days.find((d) => d.id === dayId)
    if (!target || target.id === scene.dayId) return
    const from = scene.dayId
    const done = await run(() => repo.moveScene(scene.id, dayId))
    if (done === null) return
    push({
      message: `"${scene.name}" agora está em "${target.name}", com ${plural(
        cuesOf(scene.id).length,
        'música',
        'músicas',
      )}.`,
      action: { label: 'Desfazer', run: () => void run(() => repo.moveScene(scene.id, from)) },
    })
  }

  const copy = async (scene: Scene) => {
    const created = await run(() => repo.copyScene(scene.id, day.id))
    if (!created) return
    onSelect(created.id)
    push({
      message: `"${scene.name}" duplicada neste dia, com as músicas.`,
      action: { label: 'Desfazer', run: () => void run(() => repo.deleteScene(created.id)) },
    })
  }

  const remove = async (scene: Scene) => {
    const removed = await run(() => repo.deleteScene(scene.id))
    if (!removed) return
    push({
      message: `Cena "${scene.name}" removida com ${plural(removed.cues.length, 'cue', 'cues')}.`,
      tone: 'warn',
      action: { label: 'Desfazer', run: () => void run(() => repo.restoreScene(removed)) },
    })
  }

  const add = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const scene = await run(() => repo.createScene(day.id, trimmed))
    setName('')
    if (scene) onSelect(scene.id)
  }

  return (
    <section className="panel">
      <header className="panel__head">
        <h2 className="panel__title">Cenas de “{day.name}”</h2>
        <p className="panel__hint">
          A ordem desta lista é a ordem do roteiro desta apresentação, e vira a numeração que aparece
          no deck.
          {days.length > 1 &&
            ' O seletor de dia em cada linha realoca a cena inteira, com as músicas dela.'}
        </p>
      </header>

      {scenes.length === 0 ? (
        <div className="empty empty--inline">
          <p className="empty__title">Nenhuma cena neste dia</p>
          <p className="empty__body">
            Uma cena é um bloco do roteiro — “Abertura”, “Entrada de Ana”. As músicas moram dentro
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
                  className="input--quiet input--title"
                  label={`Nome da cena ${index + 1}`}
                  value={scene.name}
                  required
                  onCommit={(value) => void run(() => repo.renameScene(scene.id, value))}
                />
              </div>

              <button
                type="button"
                className="rowlink"
                onClick={() => onEditCues(scene.id)}
                aria-label={`Abrir as músicas de ${scene.name}`}
              >
                <span className="num">{plural(cuesOf(scene.id).length, 'música', 'músicas')}</span>
                <NextIcon size={13} className="rowlink__go" />
              </button>

              {days.length > 1 && (
                <label className="scenerow__day">
                  <span className="sr-only">Dia da cena {scene.name}</span>
                  <select
                    className="select"
                    value={scene.dayId}
                    onWheel={blurOnWheel}
                    onChange={(e) => void moveToDay(scene, e.target.value)}
                  >
                    {days.map((item, position) => (
                      <option key={item.id} value={item.id}>
                        {`${String(position + 1).padStart(2, '0')} · ${item.name}`}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="row__actions">
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => void copy(scene)}
                  aria-label={`Duplicar cena ${scene.name}`}
                  title="Duplicar neste dia, com as músicas"
                >
                  <CopyIcon size={14} />
                </button>
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
