import { create } from 'zustand';

interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  danger: boolean;
  onConfirm: () => void;
  show: (opts: {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
    onConfirm: () => void;
  }) => void;
  close: () => void;
}

export const useConfirmStore = create<ConfirmState>((set) => ({
  open: false,
  title: '确认操作',
  message: '',
  confirmText: '确定',
  cancelText: '取消',
  danger: false,
  onConfirm: () => {},
  show: (opts) =>
    set({
      open: true,
      title: opts.title || '确认操作',
      message: opts.message,
      confirmText: opts.confirmText || '确定',
      cancelText: opts.cancelText || '取消',
      danger: opts.danger || false,
      onConfirm: opts.onConfirm,
    }),
  close: () => set({ open: false }),
}));

export function ConfirmDialog() {
  const { open, title, message, confirmText, cancelText, danger, onConfirm, close } =
    useConfirmStore();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 animate-fade-in"
        onClick={close}
      />
      <div className="relative bg-[var(--color-forum-card)] rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4 z-10 animate-scale-in">
        <h3 className="text-lg font-bold text-[var(--color-forum-text)] mb-2">{title}</h3>
        <p className="text-sm text-muted mb-5">{message}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={close}
            className="px-4 py-2 text-sm text-muted hover:text-[var(--color-forum-text)] transition-colors rounded-lg hover:bg-[var(--color-forum-hover)]"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              close();
            }}
            className={`px-5 py-2 rounded-lg text-sm font-bold text-white transition-opacity hover:opacity-90 ${
              danger ? 'bg-red-500' : 'bg-[var(--color-forum-header)]'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
