import { useState } from "react";

interface ConfirmModalProps {
  readonly isOpen: boolean;
  readonly title: string;
  readonly message: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly variant?: "danger" | "warning" | "info";
  readonly icon?: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly loading?: boolean;
}

const VARIANT_COLORS = {
  danger: {
    button: "linear-gradient(135deg, #ff4f64 0%, #cc3344 100%)",
    glow: "0 0 30px rgba(255, 79, 100, 0.4)",
    icon: "🚫",
  },
  warning: {
    button: "linear-gradient(135deg, #ffb347 0%, #cc8833 100%)",
    glow: "0 0 30px rgba(255, 179, 71, 0.4)",
    icon: "⚠️",
  },
  info: {
    button: "linear-gradient(135deg, var(--neon-green) 0%, #00aa55 100%)",
    glow: "0 0 30px rgba(0, 255, 106, 0.4)",
    icon: "💡",
  },
} as const;

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "info",
  icon,
  onConfirm,
  onCancel,
  loading = false,
}: Readonly<ConfirmModalProps>) {
  if (!isOpen) return null;

  const colors = VARIANT_COLORS[variant];
  const displayIcon = icon ?? colors.icon;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-content confirm-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ boxShadow: colors.glow }}
      >
        <div className="modal-icon">{displayIcon}</div>
        <h2 className="modal-title">{title}</h2>
        <p className="modal-message">{message}</p>

        <div className="modal-actions">
          <button
            className="modal-btn modal-btn-cancel"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            className="modal-btn modal-btn-confirm"
            onClick={onConfirm}
            disabled={loading}
            style={{ background: colors.button }}
          >
            {loading ? "⏳ Procesando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// Hook for easy modal usage
interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
  icon?: string;
}

export function useConfirm() {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: ((value: boolean) => void) | null;
  }>({
    isOpen: false,
    options: { title: "", message: "" },
    resolve: null,
  });

  const confirm = (options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setModalState({ isOpen: true, options, resolve });
    });
  };

  const handleConfirm = () => {
    modalState.resolve?.(true);
    setModalState((prev) => ({ ...prev, isOpen: false }));
  };

  const handleCancel = () => {
    modalState.resolve?.(false);
    setModalState((prev) => ({ ...prev, isOpen: false }));
  };

  const ConfirmDialog = () => (
    <ConfirmModal
      isOpen={modalState.isOpen}
      {...modalState.options}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return { confirm, ConfirmDialog };
}
