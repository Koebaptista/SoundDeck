import { useState } from 'react'
import type { Day, Show } from '../types'
import { plural, showDate } from '../lib/format'
import { SwapIcon } from '../icons'
import { ShowPicker } from './ShowPicker'

/**
 * Barra de contexto: que peça e que dia estão no deck.
 *
 * Uma barra só, igual nos dois modos — antes eram duas naturezas, e as duas
 * falhavam pelo mesmo motivo. No operar ela era um mostrador com um `Trocar`
 * fantasma, sem moldura, em 13px, no canto: a porta principal pintada como
 * controle terciário. No montar virava dois `<select>` nativos espremidos numa
 * faixa fina, onde escolher a noite certa era ler `02 · Sábado · sáb 14/03`
 * numa lista de sistema.
 *
 * Agora ela faz uma coisa e faz grande: diz o que está carregado, em corpo que
 * se lê de relance, e oferece um botão de verdade que abre o seletor. A troca
 * acontece no lugar, sem passar pela tela de edição, e o operador volta direto
 * ao deck com o roteiro novo.
 *
 * A regra de segurança não afrouxou — endureceu. Nenhum campo de escolha vive
 * na barra, então nem a roda do mouse nem a seta do teclado trocam o roteiro
 * em silêncio. O que existe é um clique deliberado que abre um diálogo, e
 * `Esc` o dispensa sem ter mudado nada.
 */

type Props = {
  mode: 'operar' | 'montar'
  show: Show | null
  days: Day[]
  day: Day | null
  sceneCount: number
  cueCount: number
  onSelectShow: (id: string) => void
  onSelectDay: (id: string) => void
  /** Sai do seletor direto para a aba de dias do montar, quando não há o que escolher. */
  onEditDays: (id: string) => void
}

export function ProgramBar({
  mode,
  show,
  days,
  day,
  sceneCount,
  cueCount,
  onSelectShow,
  onSelectDay,
  onEditDays,
}: Props) {
  const [picking, setPicking] = useState(false)

  if (!show) return null

  const index = days.findIndex((item) => item.id === day?.id)
  const date = showDate(day?.date ?? null)

  return (
    <section className={`progbar progbar--${mode}`} aria-label="Espetáculo carregado no deck">
      <div className="progbar__inner">
        <p className="progbar__group">
          <span className="progbar__label">Peça</span>
          <span className="progbar__show">{show.name}</span>
          {show.venue && <span className="progbar__venue">{show.venue}</span>}
        </p>

        <span className="progbar__sep" aria-hidden="true" />

        <p className="progbar__group progbar__group--day">
          <span className="progbar__label">
            {days.length > 1 && index >= 0 ? (
              <>
                Dia <span className="num">{index + 1}</span> de{' '}
                <span className="num">{days.length}</span>
              </>
            ) : (
              'Dia'
            )}
          </span>
          <span className="progbar__day">{day?.name ?? 'Nenhum dia'}</span>
          {date && <span className="progbar__date num">{date}</span>}
        </p>

        <span className="progbar__meta num">
          {plural(sceneCount, 'cena', 'cenas')} · {plural(cueCount, 'música', 'músicas')}
        </span>

        <button type="button" className="btn progbar__swap" onClick={() => setPicking(true)}>
          <SwapIcon size={15} />
          Trocar
          <span className="sr-only"> de peça ou dia</span>
        </button>
      </div>

      <ShowPicker
        open={picking}
        onClose={() => setPicking(false)}
        showId={show.id}
        dayId={day?.id ?? null}
        onPick={(showId, dayId) => {
          onSelectShow(showId)
          onSelectDay(dayId)
          setPicking(false)
        }}
        onEditDays={(id) => {
          onSelectShow(id)
          setPicking(false)
          onEditDays(id)
        }}
      />
    </section>
  )
}
