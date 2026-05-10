// Toast.jsx — lightweight toast notification system
import { useEffect } from 'react';

export function ToastContainer({ toasts, onRemove }) {
  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map(t => (
        <Toast key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  );
}

function Toast({ toast, onRemove }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), toast.duration || 4000);
    return () => clearTimeout(timer);
  }, [toast, onRemove]);

  const icons = { success: '✅', error: '❌', info: 'ℹ️' };

  return (
    <div className={`toast ${toast.type || 'info'}`} role="alert">
      <span className="toast-icon">{icons[toast.type] || icons.info}</span>
      <span className="toast-msg">{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, lineHeight: 1, flexShrink: 0, padding: '0 0 0 4px' }}
        aria-label="Dismiss notification"
      >
        ✕
      </button>
    </div>
  );
}

let _toastId = 0;
export function createToast(message, type = 'info', duration = 4000) {
  return { id: ++_toastId, message, type, duration };
}
