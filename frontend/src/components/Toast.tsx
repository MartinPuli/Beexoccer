import { useEffect, useState } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

const ICONS: Record<ToastType, string> = {
  success: "✅",
  error: "❌",
  warning: "⚠️",
  info: "💡",
};

const COLORS: Record<ToastType, { bg: string; border: string; glow: string }> = {
  success: {
    bg: "rgba(0, 255, 106, 0.1)",
    border: "var(--neon-green)",
    glow: "0 0 20px rgba(0, 255, 106, 0.3)",
  },
  error: {
    bg: "rgba(255, 79, 100, 0.1)",
    border: "#ff4f64",
    glow: "0 0 20px rgba(255, 79, 100, 0.3)",
  },
  warning: {
    bg: "rgba(255, 179, 71, 0.1)",
    border: "#ffb347",
    glow: "0 0 20px rgba(255, 179, 71, 0.3)",
  },
  info: {
    bg: "rgba(100, 200, 255, 0.1)",
    border: "#64c8ff",
    glow: "0 0 20px rgba(100, 200, 255, 0.3)",
  },
};

function Toast({ toast, onDismiss }: Readonly<ToastProps>) {
  const [isExiting, setIsExiting] = useState(false);
  const colors = COLORS[toast.type];

  useEffect(() => {
    const duration = toast.duration ?? 5000;
    const exitTimer = setTimeout(() => setIsExiting(true), duration - 300);
    const dismissTimer = setTimeout(() => onDismiss(toast.id), duration);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(dismissTimer);
    };
  }, [toast.id, toast.duration, onDismiss]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  return (
    <div
      className={`toast ${isExiting ? "toast-exit" : "toast-enter"}`}
      style={{
        background: colors.bg,
        borderColor: colors.border,
        boxShadow: colors.glow,
      }}
    >
      <div className="toast-icon">{ICONS[toast.type]}</div>
      <div className="toast-content">
        <div className="toast-title">{toast.title}</div>
        {toast.message && <div className="toast-message">{toast.message}</div>}
        {toast.action && (
          <button className="toast-action" onClick={toast.action.onClick}>
            {toast.action.label}
          </button>
        )}
      </div>
      <button className="toast-close" onClick={handleDismiss}>
        ✕
      </button>
    </div>
  );
}

// Toast Container Component
interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// Toast Hook for easy usage
let toastId = 0;
let addToastFn: ((toast: Omit<ToastMessage, "id">) => void) | null = null;

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (toast: Omit<ToastMessage, "id">) => {
    const id = `toast-${++toastId}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Expose globally
  addToastFn = addToast;

  return { toasts, addToast, dismissToast };
}

// Global toast functions
export const toast = {
  success: (title: string, message?: string, action?: ToastMessage["action"]) => {
    addToastFn?.({ type: "success", title, message, action });
  },
  error: (title: string, message?: string, action?: ToastMessage["action"]) => {
    addToastFn?.({ type: "error", title, message, action, duration: 8000 });
  },
  warning: (title: string, message?: string, action?: ToastMessage["action"]) => {
    addToastFn?.({ type: "warning", title, message, action, duration: 6000 });
  },
  info: (title: string, message?: string, action?: ToastMessage["action"]) => {
    addToastFn?.({ type: "info", title, message, action });
  },
};
