// Toast notifications for mutation results. Announced politely to screen readers; failures stay longer.
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { create } from 'zustand';
import { cn } from '@/lib/cn';

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastStore {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, 'id'>) => void;
  dismiss: (id: number) => void;
}

let counter = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (item) => set((s) => ({ toasts: [...s.toasts.slice(-3), { ...item, id: ++counter }] })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

const push = (tone: ToastTone) => (title: string, description?: string) =>
  useToastStore.getState().push({ tone, title, ...(description ? { description } : {}) });

export const toast = { success: push('success'), error: push('error'), info: push('info') };

const STYLE: Record<ToastTone, { icon: typeof Info; className: string }> = {
  success: { icon: CheckCircle2, className: 'text-success-ink' },
  error: { icon: AlertTriangle, className: 'text-warning-ink' },
  info: { icon: Info, className: 'text-info-ink' },
};

function ToastView({ item }: { item: ToastItem }) {
  const { t } = useTranslation();
  const dismiss = useToastStore((s) => s.dismiss);
  useEffect(() => {
    const id = window.setTimeout(() => dismiss(item.id), item.tone === 'error' ? 8000 : 5000);
    return () => window.clearTimeout(id);
  }, [dismiss, item.id, item.tone]);
  const { icon: Icon, className } = STYLE[item.tone];
  return (
    <div className="pointer-events-auto flex w-full animate-slide-up items-start gap-3 rounded-xl border bg-surface p-4 shadow-lg">
      <Icon aria-hidden className={cn('mt-0.5 h-5 w-5 shrink-0', className)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-fg">{item.title}</p>
        {item.description && <p className="mt-0.5 text-sm text-fg-muted">{item.description}</p>}
      </div>
      <button
        type="button"
        onClick={() => dismiss(item.id)}
        aria-label={t('actions.dismiss')}
        className="-m-1 grid h-8 w-8 shrink-0 place-items-center rounded-md text-fg-subtle hover:bg-surface-sunken hover:text-fg"
      >
        <X aria-hidden className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Toaster() {
  const { t } = useTranslation();
  const toasts = useToastStore((s) => s.toasts);
  return (
    <section
      aria-label={t('a11y.toasts')}
      aria-live="polite"
      className="no-print pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:bottom-4 sm:left-auto sm:right-4 sm:w-96 sm:items-end sm:p-0"
    >
      {toasts.map((item) => (
        <ToastView key={item.id} item={item} />
      ))}
    </section>
  );
}
