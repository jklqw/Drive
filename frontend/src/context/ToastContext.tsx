import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { AlertCircle, CheckCircle2, X } from 'lucide-react'
import clsx from 'clsx'

type Tone = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  tone: Tone
}

interface ToastContextValue {
  notify: (message: string, tone?: Tone) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)
let toastCounter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const notify = useCallback(
    (message: string, tone: Tone = 'info') => {
      const id = ++toastCounter
      setToasts((current) => [...current, { id, message, tone }])
      window.setTimeout(() => dismiss(id), 5000)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[340px] max-w-[calc(100vw-2.5rem)] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={clsx(
              'pointer-events-auto flex items-start gap-3 rounded-lg border bg-surface px-4 py-3 shadow-sm',
              toast.tone === 'error' ? 'border-red-200' : 'border-border',
            )}
          >
            {toast.tone === 'error' ? (
              <AlertCircle size={17} className="mt-0.5 shrink-0 text-status-danger" />
            ) : (
              <CheckCircle2
                size={17}
                className={clsx('mt-0.5 shrink-0', toast.tone === 'success' ? 'text-status-success' : 'text-brand')}
              />
            )}
            <p className="flex-1 text-[13px] leading-5 text-ink-primary">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="text-ink-tertiary transition-colors hover:text-ink-primary"
              aria-label="Dismiss notification"
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside <ToastProvider>')
  return context
}
