import { useToasts } from '../state/toasts'
import { CloseIcon } from '../icons'

/** Avisos com desfazer, no canto inferior, acima da faixa de parar. */
export function ToastRegion() {
  const { toasts, dismiss } = useToasts()
  if (toasts.length === 0) return null

  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div className="toast" key={toast.id} data-tone={toast.tone}>
          <p className="toast__message">{toast.message}</p>
          {toast.action && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                toast.action?.run()
                dismiss(toast.id)
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button
            type="button"
            className="icon-btn"
            onClick={() => dismiss(toast.id)}
            aria-label="Dispensar aviso"
          >
            <CloseIcon size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}
