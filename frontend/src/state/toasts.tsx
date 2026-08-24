import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

/**
 * Avisos com desfazer.
 *
 * Nada no modo montar pede confirmação: o operador clica em "sim" sem ler, e
 * um diálogo a mais é uma chance a mais de errar. Remove-se na hora e o
 * desfazer fica visível por dez segundos — reversível vale mais que protegido.
 */

export interface Toast {
  id: number
  message: string
  tone: 'neutral' | 'warn'
  action?: { label: string; run: () => void }
}

interface ToastStore {
  toasts: Toast[]
  push: (toast: Omit<Toast, 'id' | 'tone'> & { tone?: Toast['tone'] }) => void
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastStore | null>(null)
const LIFETIME = 10000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const push = useCallback<ToastStore['push']>(
    (toast) => {
      const id = ++seq.current
      setToasts((list) => [...list.slice(-2), { tone: 'neutral', ...toast, id }])
      window.setTimeout(() => dismiss(id), LIFETIME)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss])

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

export function useToasts(): ToastStore {
  const store = useContext(ToastContext)
  if (!store) throw new Error('useToasts precisa estar dentro de <ToastProvider>')
  return store
}
