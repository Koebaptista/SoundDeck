import { forwardRef } from 'react'
import { CloseIcon } from '../icons'

/**
 * Referência dos atalhos.
 *
 * `<dialog>` nativo: foco preso, `Escape` fecha, sem guerra de z-index e sem
 * reimplementar um modal. É a única superfície modal do produto — no caminho
 * da operação, confirmação modal é proibida.
 */

const KEYS: { keys: string[]; what: string }[] = [
  { keys: ['1', '…', '9'], what: 'dispara o cue com aquela tecla, dentro da cena ativa' },
  { keys: ['Esc'], what: 'para tudo imediatamente' },
  { keys: ['Espaço'], what: 'congela e solta todo o áudio no ar' },
  { keys: ['↑', '↓'], what: 'muda de cena, dentro do dia em cartaz' },
  { keys: ['Enter'], what: 'dispara o cue que está com o foco do teclado' },
]

export const ShortcutsDialog = forwardRef<HTMLDialogElement>(function ShortcutsDialog(_, ref) {
  return (
    <dialog className="dialog" ref={ref} aria-labelledby="shortcuts-title">
      <div className="dialog__head">
        <h2 id="shortcuts-title" className="dialog__title">
          Atalhos de teclado
        </h2>
        <form method="dialog">
          <button type="submit" className="icon-btn" aria-label="Fechar">
            <CloseIcon size={14} />
          </button>
        </form>
      </div>

      <dl className="shortcuts">
        {KEYS.map((row) => (
          <div className="shortcuts__row" key={row.what}>
            <dt>
              {row.keys.map((key) =>
                key === '…' ? (
                  <span key={key} className="shortcuts__sep" aria-hidden="true">
                    …
                  </span>
                ) : (
                  <kbd key={key}>{key}</kbd>
                ),
              )}
            </dt>
            <dd>{row.what}</dd>
          </div>
        ))}
      </dl>

      <p className="dialog__note">
        As teclas de cue valem só dentro da cena ativa — a mesma tecla pode existir em toda cena sem
        conflito. Nada dispara enquanto você digita em um campo de texto. A peça e o dia não têm
        atalho de propósito: eles se trocam pelo botão “Trocar” da barra de contexto, porque mudar
        de roteiro precisa ser uma decisão, nunca um deslize.
      </p>
    </dialog>
  )
})
