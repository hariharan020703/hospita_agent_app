// Pieces shared by every symptom conversation (patient app and kiosk): the mandatory notice and "Start over".
import { useTranslation } from 'react-i18next';
import { Info, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';

/** The mandatory notice: shown above every symptom conversation. */
export function Disclaimer({ className, size = 'md' }: { className?: string; size?: 'md' | 'lg' }) {
  const { t } = useTranslation();
  return (
    <p
      className={cn(
        'flex items-start gap-2 rounded-lg border border-info/30 bg-info-soft px-3 py-2 text-info-ink',
        size === 'lg' ? 'text-base' : 'text-sm',
        className,
      )}
    >
      <Info aria-hidden className={cn('mt-0.5 shrink-0', size === 'lg' ? 'h-5 w-5' : 'h-4 w-4')} />
      <span>{t('disclaimer')}</span>
    </p>
  );
}

export function StartOverButton({ onClick, size = 'md' }: { onClick: () => void; size?: 'md' | 'lg' }) {
  const { t } = useTranslation('triage');
  return (
    <Button variant="ghost" icon={RotateCcw} onClick={onClick} size={size === 'lg' ? 'lg' : 'sm'}>
      {t('chat.startOver')}
    </Button>
  );
}
