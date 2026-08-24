import { useEffect, useRef, useState } from 'react'
import { useDeck } from '../state/deck'
import { plural, showDate } from '../lib/format'
import { CheckIcon, CloseIcon, NextIcon } from '../icons'

/**
 * Seletor de peça e dia — a única superfície que existe só para trocar o que
 * está no deck.
 *
 * Antes, trocar de espetáculo era um desvio: o botão levava ao modo montar,
 * onde a escolha morava dentro de dois `<select>` de 13px, entre abas de
 * edição e botões de excluir. Quem só queria tocar outra noite tinha de
 * atravessar a tela mais perigosa do produto e depois voltar.
 *
 * Aqui a escolha é a tela inteira: peça à esquerda, dias daquela peça à
 * direita, alvos grandes, nome legível de longe e nenhuma ação destrutiva ao
 * alcance. Duas listas e dois cliques — clicar no dia é o que confirma.
 *
 * A trava contra o acidente continua de pé, e ficou mais forte: não existe
 * `<select>` nenhum aqui, então nem roda de mouse nem seta do teclado trocam
 * o roteiro. Um clique distraído no `Trocar` abre um diálogo, e `Esc` o fecha
 * sem ter mudado nada.
 */

type Props = {
  open: boolean
  onClose: () => void
  showId: string | null
  dayId: string | null
  onPick: (showId: string, dayId: string) => void
  /** Leva ao modo montar, na aba de dias da peça em foco. */
  onEditDays: (showId: string) => void
}

export function ShowPicker({ open, onClose, showId, dayId, onPick, onEditDays }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const { deck, daysOf, scenesOf, cuesOf } = useDeck()
  // A peça em foco na coluna da esquerda. Só a escolha do dia grava — assim
  // passear pelas peças para comparar as datas não troca nada por engano.
  const [draft, setDraft] = useState<string | null>(showId)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) {
      setDraft(showId)
      el.showModal()
    } else if (!open && el.open) {
      el.close()
    }
  }, [open, showId])

  const shows = deck.shows
  const focused = shows.find((s) => s.id === draft) ?? shows.find((s) => s.id === showId) ?? shows[0]
  const days = focused ? daysOf(focused.id) : []

  const dayTally = (id: string) => {
    const scenes = scenesOf(id)
    return {
      scenes: scenes.length,
      cues: scenes.reduce((total, scene) => total + cuesOf(scene.id).length, 0),
    }
  }

  return (
    <dialog
      className="dialog dialog--wide"
      ref={ref}
      onClose={onClose}
      // O clique fora não fecha um <dialog> nativo sozinho, e o alvo desse
      // clique é o próprio elemento — é assim que se distingue o fundo do
      // conteúdo. Fechar aqui não troca nada, então é seguro.
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      aria-labelledby="picker-title"
    >
      <div className="dialog__head">
        <h2 id="picker-title" className="dialog__title">
          Trocar espetáculo
        </h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar sem trocar">
          <CloseIcon size={14} />
        </button>
      </div>

      <div className="picker">
        <section className="picker__col" aria-label="Peças">
          <h3 className="picker__label">Peça</h3>
          <ul className="picker__list">
            {shows.map((item) => {
              const count = daysOf(item.id).length
              const current = item.id === focused?.id
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className="picker__show"
                    aria-current={current || undefined}
                    data-live={item.id === showId || undefined}
                    onClick={() => setDraft(item.id)}
                  >
                    <span className="picker__name">{item.name}</span>
                    {item.venue && <span className="picker__sub">{item.venue}</span>}
                    <span className="picker__count num">
                      {plural(count, 'dia', 'dias')}
                      {item.id === showId && <span className="picker__here"> · em cartaz</span>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="picker__col" aria-label={`Dias de ${focused?.name ?? ''}`}>
          <h3 className="picker__label">
            Dia de <span className="picker__of">“{focused?.name}”</span>
          </h3>

          {days.length === 0 ? (
            <div className="empty empty--inline">
              <p className="empty__title">Nenhum dia nesta peça</p>
              <p className="empty__body">
                Um dia é uma apresentação, e é ele que carrega o roteiro. Crie o primeiro para poder
                tocar esta peça.
              </p>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => focused && onEditDays(focused.id)}
              >
                Criar o primeiro dia
              </button>
            </div>
          ) : (
            <ul className="picker__list">
              {days.map((item, index) => {
                const counts = dayTally(item.id)
                const live = item.id === dayId && focused?.id === showId
                const date = showDate(item.date)
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="picker__day"
                      data-live={live || undefined}
                      onClick={() => focused && onPick(focused.id, item.id)}
                    >
                      <span className="picker__ord num">{String(index + 1).padStart(2, '0')}</span>
                      <span className="picker__daybody">
                        <span className="picker__name">
                          {item.name}
                          {date && <span className="picker__date num"> · {date}</span>}
                        </span>
                        <span className="picker__count num">
                          {plural(counts.scenes, 'cena', 'cenas')} ·{' '}
                          {plural(counts.cues, 'cue', 'cues')}
                        </span>
                      </span>
                      {live ? (
                        <span className="picker__mark" aria-label="carregado agora">
                          <CheckIcon size={14} />
                        </span>
                      ) : (
                        <span className="picker__go" aria-hidden="true">
                          <NextIcon size={14} />
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      <p className="dialog__note">
        Escolher o dia carrega o roteiro dele e volta para o deck. Nada aqui renomeia, reordena ou
        apaga — isso mora no modo Montar.
      </p>
    </dialog>
  )
}
