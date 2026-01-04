import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from 'react'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'

type NotificationType = 'success' | 'error' | 'info'

interface Notification {
  id: number
  message: string
  type: NotificationType
}

interface NotificationContextType {
  addNotification: (message: string, type: NotificationType) => void
}

const NotificationContext = createContext<NotificationContextType | null>(null)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const addNotification = useCallback(
    (message: string, type: NotificationType) => {
      setNotifications((prev) => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          message,
          type,
        },
      ])
    },
    []
  )

  const removeNotification = useCallback((id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  return (
    <NotificationContext.Provider value={{ addNotification }}>
      {children}

      <div className="fixed top-5 right-5 z-[200] w-full max-w-xs space-y-3">
        {notifications.map((notification) => (
          <NotificationToast
            key={notification.id}
            notification={notification}
            onClose={() => removeNotification(notification.id)}
          />
        ))}
      </div>
    </NotificationContext.Provider>
  )
}

function NotificationToast({
  notification,
  onClose,
}: {
  notification: Notification
  onClose: () => void
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000)
    return () => clearTimeout(timer)
  }, [onClose])

  const icons: Record<NotificationType, JSX.Element> = {
    success: <CheckCircle className="h-6 w-6 text-emerald-500" />,
    error: <XCircle className="h-6 w-6 text-red-500" />,
    info: <Info className="h-6 w-6 text-blue-500" />,
  }

  const styles: Record<NotificationType, string> = {
    success: 'bg-emerald-50 border-emerald-200',
    error: 'bg-red-50 border-red-200',
    info: 'bg-blue-50 border-blue-200',
  }

  return (
    <div
      className={`flex items-start rounded-xl border p-4 shadow-lg
        animate-[slideIn_0.25s_ease-out] ${styles[notification.type]}`}
    >
      <div className="flex-shrink-0">{icons[notification.type]}</div>

      <div className="ml-3 flex-1 pt-0.5">
        <p className="text-sm font-semibold text-slate-800">
          {notification.message}
        </p>
      </div>

      <button
        onClick={onClose}
        className="ml-4 rounded-full p-1 text-slate-400 hover:bg-slate-200/50"
        aria-label="Close notification"
      >
        <X className="h-4 w-4" />
      </button>

      {/* animation scoped */}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}

export function useNotifier() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifier must be used within a NotificationProvider')
  }
  return context
}
