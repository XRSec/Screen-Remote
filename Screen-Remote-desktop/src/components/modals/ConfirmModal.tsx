import React from 'react';
import { AlertTriangle, AlertCircle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  isDestructive = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onCancel} style={{ zIndex: 200 }}>
      <div
        className="modal-window-card"
        style={{ width: '420px', maxWidth: '92vw', padding: '24px', gap: '16px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
              isDestructive
                ? 'bg-red-500/15 text-red-400 border border-red-500/25'
                : 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
            }`}
          >
            {isDestructive ? <AlertTriangle size={22} /> : <AlertCircle size={22} />}
          </div>

          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] leading-snug">{title}</h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--border-card)]">
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-secondary px-4 py-1.5 text-xs font-medium cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className={`btn px-4 py-1.5 text-xs font-medium cursor-pointer ${
              isDestructive ? 'btn-danger' : 'btn-primary'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
