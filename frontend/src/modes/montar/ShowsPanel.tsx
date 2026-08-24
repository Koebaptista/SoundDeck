import { useState } from 'react'
import type { Show } from '../../types'
import { repo } from '../../data'
import { useDeck } from '../../state/deck'
import { useToasts } from '../../state/toasts'
import { plural } from '../../lib/format'
import { InlineText } from '../../components/InlineText'
import { CheckIcon, CopyIcon, DownIcon, NextIcon, PlusIcon, TrashIcon, UpIcon } from '../../icons'

/**
 * Peças: cada espetáculo que este computador opera.
 *
 * O mesmo deck serve à temporada deste mês e à que volta no ano que vem, em
 * outro teatro — por isso a peça guarda o local. Trocar de peça aqui troca o
 * roteiro inteiro; a biblioteca de áudio é a única coisa que atravessa todas.
 */

export function ShowsPanel({
  activeId,
  onSelect,
  onEditDays,
}: {
  activeId: string | null
  onSelect: (id: string) => void
  onEditDays: (id: string) => void
}) {
  const { deck, daysOf, scenesOf, cuesOf, run } = useDeck()
  const { push } = useToasts()
  const [name, setName] = useState('')
  const [venue, setVenue] = useState('')

  const shows = deck.shows

  const tally = (show: Show) => {
    const days = daysOf(show.id)
    const scenes = days.flatMap((day) => scenesOf(day.id))
    const cues = scenes.reduce((total, scene) => total + cuesOf(scene.id).length, 0)
    return { days: days.length, scenes: scenes.length, cues }
  }

  const move = async (index: number, delta: number) => {
    const next = [...shows]
    const a = next[index]
    const b = next[index + delta]
    if (!a || !b) return
    next[index] = b
    next[index + delta] = a
    await run(() => repo.reorderShows(next.map((s) => s.id)))
  }

  const duplicate = async (show: Show) => {
    const copy = await run(() =>
      repo.duplicateShow(show.id, { name: `${show.name} (cópia)`, venue: show.venue }),
    )
    if (!copy) return
    onSelect(copy.id)
    push({
      message: `"${show.name}" copiada com todos os dias, cenas e músicas. Renomeie a cópia.`,
    })
  }

  const remove = async (show: Show) => {
    const counts = tally(show)
    const removed = await run(() => repo.deleteShow(show.id))
    if (!removed) return
    push({
      message: `Peça "${show.name}" removida com ${plural(counts.days, 'dia', 'dias')} e ${plural(
        counts.cues,
        'música',
        'músicas',
      )}.`,
      tone: 'warn',
      action: { label: 'Desfazer', run: () => void run(() => repo.restoreShow(removed)) },
    })
  }

  const add = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const show = await run(() => repo.createShow({ name: trimmed, venue: venue.trim() }))
    setName('')
    setVenue('')
    if (show) {
      onSelect(show.id)
      push({ message: `"${trimmed}" criada com o primeiro dia. Monte o roteiro dele.` })
    }
  }

  return (
    <section className="panel">
      <header className="panel__head">
        <h2 className="panel__title">Peças</h2>
        <p className="panel__hint">
          Um espetáculo por linha. Dentro de cada um ficam os dias de apresentação, e dentro deles as
          cenas — a biblioteca de áudio é compartilhada por todas as peças.
        </p>
      </header>

      {shows.length === 0 ? (
        <div className="empty empty--inline">
          <p className="empty__title">Nenhuma peça ainda</p>
          <p className="empty__body">
            Comece pela peça que vai subir: o nome do espetáculo e onde ele acontece.
          </p>
        </div>
      ) : (
        <ol className="rows">
          {shows.map((show, index) => {
            const counts = tally(show)
            return (
              <li className="row" key={show.id} data-active={show.id === activeId || undefined}>
                <span className="row__num num">{String(index + 1).padStart(2, '0')}</span>

                <div className="showrow__fields">
                  <InlineText
                    className="showrow__name input--quiet input--title"
                    label={`Nome da peça ${index + 1}`}
                    value={show.name}
                    required
                    onCommit={(value) => void run(() => repo.updateShow(show.id, { name: value }))}
                  />
                  <InlineText
                    className="showrow__venue input--quiet"
                    label={`Local da peça ${index + 1}`}
                    value={show.venue}
                    placeholder="Teatro, escola, centro cultural…"
                    onCommit={(value) => void run(() => repo.updateShow(show.id, { venue: value }))}
                  />
                </div>

                {show.id === activeId && (
                  <span className="tag">
                    <CheckIcon size={12} />
                    Em cartaz
                  </span>
                )}

                <button
                  type="button"
                  className="rowlink"
                  onClick={() => onEditDays(show.id)}
                  aria-label={`Abrir os dias de ${show.name}`}
                >
                  <span className="num">{plural(counts.days, 'dia', 'dias')}</span>
                  <span className="row__aside num">{plural(counts.cues, 'cue', 'cues')}</span>
                  <NextIcon size={13} className="rowlink__go" />
                </button>

                <div className="row__actions">
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => void duplicate(show)}
                    aria-label={`Duplicar peça ${show.name}`}
                    title="Duplicar com dias, cenas e músicas"
                  >
                    <CopyIcon size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => void move(index, -1)}
                    disabled={index === 0}
                    aria-label={`Mover ${show.name} para cima`}
                  >
                    <UpIcon size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => void move(index, 1)}
                    disabled={index === shows.length - 1}
                    aria-label={`Mover ${show.name} para baixo`}
                  >
                    <DownIcon size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn--danger"
                    onClick={() => void remove(show)}
                    aria-label={`Remover peça ${show.name}`}
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
        <label className="showrow__name">
          <span className="sr-only">Nome da nova peça</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da peça"
          />
        </label>
        <label className="showrow__venue">
          <span className="sr-only">Local da nova peça</span>
          <input
            className="input"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            placeholder="Local (opcional)"
          />
        </label>
        <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
          <PlusIcon size={14} />
          Adicionar peça
        </button>
      </form>
    </section>
  )
}
