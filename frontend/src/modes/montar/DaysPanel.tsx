import { useState } from 'react'
import type { Day, Show } from '../../types'
import { repo } from '../../data'
import { blurOnWheel } from '../../lib/select'
import { useDeck } from '../../state/deck'
import { useToasts } from '../../state/toasts'
import { plural } from '../../lib/format'
import { InlineText } from '../../components/InlineText'
import { CheckIcon, CopyIcon, DownIcon, NextIcon, PlusIcon, TrashIcon, UpIcon } from '../../icons'

/**
 * Dias de apresentação da peça ativa.
 *
 * Três noites em cartaz são três dias, e cada um tem o próprio roteiro. Na
 * temporada corrida eles nascem iguais — é para isso que serve o duplicar, que
 * copia cenas e cues de uma vez; no festival cada dia é diferente e o operador
 * monta um a um.
 */

export function DaysPanel({
  show,
  days,
  activeId,
  onSelect,
  onEditScenes,
  onGoShows,
}: {
  show: Show | null
  days: Day[]
  activeId: string | null
  onSelect: (id: string) => void
  onEditScenes: (id: string) => void
  onGoShows: () => void
}) {
  const { scenesOf, cuesOf, run } = useDeck()
  const { push } = useToasts()
  const [name, setName] = useState('')
  const [date, setDate] = useState('')

  if (!show) {
    return (
      <section className="panel">
        <div className="empty empty--inline">
          <p className="empty__title">Crie uma peça primeiro</p>
          <p className="empty__body">Os dias pertencem a um espetáculo — sem peça não há o que datar.</p>
          <button type="button" className="btn btn--primary" onClick={onGoShows}>
            Ir para peças
          </button>
        </div>
      </section>
    )
  }

  const tally = (day: Day) => {
    const scenes = scenesOf(day.id)
    return {
      scenes: scenes.length,
      cues: scenes.reduce((total, scene) => total + cuesOf(scene.id).length, 0),
    }
  }

  const move = async (index: number, delta: number) => {
    const next = [...days]
    const a = next[index]
    const b = next[index + delta]
    if (!a || !b) return
    next[index] = b
    next[index + delta] = a
    await run(() => repo.reorderDays(show.id, next.map((d) => d.id)))
  }

  const duplicate = async (day: Day) => {
    const counts = tally(day)
    // A cópia nasce sem data: duas apresentações com a mesma data seriam uma
    // mentira no seletor, e a data é justamente o que o operador vai trocar.
    const copy = await run(() =>
      repo.duplicateDay(day.id, { name: `${day.name} (cópia)`, date: null }),
    )
    if (!copy) return
    onSelect(copy.id)
    push({
      message: `"${day.name}" copiado com ${plural(counts.scenes, 'cena', 'cenas')} e ${plural(
        counts.cues,
        'música',
        'músicas',
      )}. Ajuste o nome e a data.`,
    })
  }

  const remove = async (day: Day) => {
    const counts = tally(day)
    const removed = await run(() => repo.deleteDay(day.id))
    if (!removed) return
    push({
      message: `Dia "${day.name}" removido com ${plural(
        counts.scenes,
        'cena',
        'cenas',
      )} e ${plural(counts.cues, 'cue', 'cues')}.`,
      tone: 'warn',
      action: { label: 'Desfazer', run: () => void run(() => repo.restoreDay(removed)) },
    })
  }

  const add = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const day = await run(() =>
      repo.createDay({ showId: show.id, name: trimmed, date: date || null }),
    )
    setName('')
    setDate('')
    if (day) onSelect(day.id)
  }

  return (
    <section className="panel">
      <header className="panel__head">
        <h2 className="panel__title">Dias de “{show.name}”</h2>
        <p className="panel__hint">
          Uma linha por apresentação. Para uma temporada em que todas as noites são iguais, monte o
          primeiro dia e duplique — cenas e músicas vão junto, e daí em diante cada dia muda sozinho.
        </p>
      </header>

      {days.length === 0 ? (
        <div className="empty empty--inline">
          <p className="empty__title">Nenhum dia nesta peça</p>
          <p className="empty__body">
            Crie o primeiro: “Estreia”, “Sábado 20h”, “Sessão da escola”. As cenas moram dentro dele.
          </p>
        </div>
      ) : (
        <ol className="rows">
          {days.map((day, index) => {
            const counts = tally(day)
            return (
              <li className="row" key={day.id} data-active={day.id === activeId || undefined}>
                <span className="row__num num">{String(index + 1).padStart(2, '0')}</span>

                <div className="row__grow">
                  <InlineText
                    className="input--quiet input--title"
                    label={`Nome do dia ${index + 1}`}
                    value={day.name}
                    required
                    onCommit={(value) => void run(() => repo.updateDay(day.id, { name: value }))}
                  />
                </div>

                {day.id === activeId && (
                  <span className="tag">
                    <CheckIcon size={12} />
                    Em cartaz
                  </span>
                )}

                <label className="dayrow__date">
                  <span className="sr-only">Data do dia {index + 1}</span>
                  <input
                    className="input input--quiet num"
                    type="date"
                    value={day.date ?? ''}
                    onWheel={blurOnWheel}
                    onChange={(e) =>
                      void run(() => repo.updateDay(day.id, { date: e.target.value || null }))
                    }
                  />
                </label>

                <button
                  type="button"
                  className="rowlink"
                  onClick={() => onEditScenes(day.id)}
                  aria-label={`Abrir as cenas de ${day.name}`}
                >
                  <span className="num">{plural(counts.scenes, 'cena', 'cenas')}</span>
                  <span className="row__aside num">{plural(counts.cues, 'cue', 'cues')}</span>
                  <NextIcon size={13} className="rowlink__go" />
                </button>

                <div className="row__actions">
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => void duplicate(day)}
                    aria-label={`Duplicar dia ${day.name}`}
                    title="Duplicar com cenas e músicas"
                  >
                    <CopyIcon size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => void move(index, -1)}
                    disabled={index === 0}
                    aria-label={`Mover ${day.name} para cima`}
                  >
                    <UpIcon size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => void move(index, 1)}
                    disabled={index === days.length - 1}
                    aria-label={`Mover ${day.name} para baixo`}
                  >
                    <DownIcon size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn--danger"
                    onClick={() => void remove(day)}
                    aria-label={`Remover dia ${day.name}`}
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      <form className="addbar" onSubmit={add}>
        <label className="row__grow">
          <span className="sr-only">Nome do novo dia</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`Dia ${days.length + 1}`}
          />
        </label>
        <label className="dayrow__date">
          <span className="sr-only">Data do novo dia</span>
          <input
            className="input"
            type="date"
            value={date}
            onWheel={blurOnWheel}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
          <PlusIcon size={14} />
          Adicionar dia
        </button>
      </form>
    </section>
  )
}
