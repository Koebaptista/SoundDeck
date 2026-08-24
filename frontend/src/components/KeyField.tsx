import { useState } from 'react'
import { CloseIcon, WarnIcon } from '../icons'

/**
 * Captura a tecla de atalho de um cue.
 *
 * Não se digita o nome da tecla, aperta-se a tecla — é o gesto que o operador
 * vai repetir na peça. O campo é somente leitura de propósito: o valor vem do
 * teclado, nunca de texto colado.
 *
 * Teclas repetidas dentro da mesma cena são avisadas na hora: uma delas nunca
 * dispararia, e descobrir isso durante o espetáculo é tarde demais.
 */

const IGNORED = new Set(['Shift', 'Control', 'Alt', 'Meta', 'Tab', 'CapsLock'])

export function KeyField({
  value,
  duplicated,
  onChange,
}: {
  value: string | null
  duplicated: boolean
  onChange: (key: string | null) => void
}) {
  const [listening, setListening] = useState(false)

  return (
    <div className="keyfield">
      <input
        className="input keyfield__input num"
        type="text"
        readOnly
        value={listening ? '' : (value ?? '')}
        placeholder={listening ? 'aperte…' : 'tecla'}
        aria-label="Tecla de atalho deste cue"
        aria-invalid={duplicated || undefined}
        onFocus={() => setListening(true)}
        onBlur={() => setListening(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.currentTarget.blur()
            return
          }
          if (IGNORED.has(event.key)) return
          event.preventDefault()
          if (event.key === 'Backspace' || event.key === 'Delete') {
            onChange(null)
            return
          }
          if (event.key.length !== 1) return
          onChange(event.key.toLowerCase())
          setListening(false)
          event.currentTarget.blur()
        }}
      />
      {value && (
        <button
          type="button"
          className="icon-btn keyfield__clear"
          onClick={() => onChange(null)}
          aria-label="Remover tecla deste cue"
        >
          <CloseIcon size={12} />
        </button>
      )}
      {duplicated && (
        <span className="keyfield__warn" role="status">
          <WarnIcon size={12} />
          <span className="sr-only">tecla repetida nesta cena</span>
        </span>
      )}
    </div>
  )
}
