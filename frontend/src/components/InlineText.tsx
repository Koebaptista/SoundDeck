import { useEffect, useState } from 'react'

/**
 * Campo de texto que só grava quando o operador termina.
 *
 * Gravar a cada tecla faria uma ida ao repositório por caractere — irrelevante
 * no mock, caro contra o Django, e errado dos dois lados: a validação acontece
 * no blur, não no meio da palavra. `Enter` grava, `Escape` desiste.
 */

type Props = {
  value: string
  onCommit: (value: string) => void
  label: string
  placeholder?: string
  /** Impede gravar vazio: volta ao valor anterior. */
  required?: boolean
  multiline?: boolean
  className?: string
}

export function InlineText({
  value,
  onCommit,
  label,
  placeholder,
  required,
  multiline,
  className,
}: Props) {
  const [draft, setDraft] = useState(value)

  // O valor pode mudar por fora (desfazer, recarga do deck).
  useEffect(() => setDraft(value), [value])

  const commit = () => {
    const trimmed = draft.trim()
    if (required && !trimmed) {
      setDraft(value)
      return
    }
    if (trimmed !== value) onCommit(trimmed)
  }

  const shared = {
    value: draft,
    placeholder,
    'aria-label': label,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !multiline) {
        e.preventDefault()
        ;(e.target as HTMLElement).blur()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setDraft(value)
        ;(e.target as HTMLElement).blur()
      }
    },
  }

  return multiline ? (
    <textarea className={`textarea ${className ?? ''}`} rows={2} {...shared} />
  ) : (
    <input className={`input ${className ?? ''}`} {...shared} />
  )
}
