// Modal dialog, confirmation dialog and side drawer. Focus is trapped, Escape closes, page scroll is locked.
import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { Button } from './Button';
import { IconButton } from './IconButton';

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  initialFocus?: RefObject<HTMLElement | null>;
  /** Prevent closing by Escape or the backdrop (e.g. while saving). */
  dismissible?: boolean;
}

function useOverlayBehaviour(onClose: () => void, dismissible: boolean) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissible) {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, dismissible]);
}

function DialogPanel({
  onClose,
  title,
  description,
  children,
  footer,
  initialFocus,
  dismissible = true,
  size,
}: Omit<OverlayProps, 'open'> & { size: 'sm' | 'md' | 'lg' | 'xl' }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useFocusTrap(ref, initialFocus);
  useOverlayBehaviour(onClose, dismissible);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        aria-hidden
        className="absolute inset-0 animate-fade-in bg-black/50"
        onClick={dismissible ? onClose : undefined}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[92dvh] w-full animate-slide-up flex-col rounded-t-2xl bg-surface shadow-lg sm:rounded-2xl',
          size === 'sm' && 'sm:max-w-md',
          size === 'md' && 'sm:max-w-lg',
          size === 'lg' && 'sm:max-w-2xl',
          size === 'xl' && 'sm:max-w-4xl',
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-fg">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-sm text-fg-muted">
                {description}
              </p>
            )}
          </div>
          {dismissible && (
            <IconButton icon={X} label={t('actions.close')} size="sm" onClick={onClose} className="-mr-2 -mt-1" />
          )}
        </div>
        {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>}
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Modal({ open, size = 'md', ...rest }: OverlayProps & { size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  if (!open) return null;
  return createPortal(<DialogPanel size={size} {...rest} />, document.body);
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  tone = 'primary',
  loading = false,
  children,
  confirmDisabled,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  body?: ReactNode;
  confirmLabel: string;
  /** "danger" for destructive actions (cancel, delete, deactivate). */
  tone?: 'primary' | 'danger';
  loading?: boolean;
  children?: ReactNode;
  confirmDisabled?: boolean;
}) {
  const { t } = useTranslation();
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={body}
      size="sm"
      dismissible={!loading}
      initialFocus={tone === 'danger' ? cancelRef : undefined}
      footer={
        <>
          <Button ref={cancelRef} variant="outline" onClick={onClose} disabled={loading}>
            {t('actions.cancel')}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}

function DrawerPanel({
  onClose,
  title,
  description,
  children,
  footer,
  initialFocus,
  dismissible = true,
  width,
}: Omit<OverlayProps, 'open'> & { width: 'md' | 'lg' }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(ref, initialFocus);
  useOverlayBehaviour(onClose, dismissible);
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        aria-hidden
        className="absolute inset-0 animate-fade-in bg-black/40"
        onClick={dismissible ? onClose : undefined}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'relative flex h-full w-full animate-slide-in-right flex-col bg-surface shadow-lg',
          width === 'md' ? 'sm:max-w-md' : 'sm:max-w-2xl',
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-fg">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
          </div>
          {dismissible && (
            <IconButton icon={X} label={t('actions.close')} size="sm" onClick={onClose} className="-mr-2 -mt-1" />
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, width = 'lg', ...rest }: OverlayProps & { width?: 'md' | 'lg' }) {
  if (!open) return null;
  return createPortal(<DrawerPanel width={width} {...rest} />, document.body);
}
