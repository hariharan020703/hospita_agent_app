import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BellOff, CheckCheck } from 'lucide-react';
import { Button, EmptyState, QueryBoundary, SkeletonList } from '@/components/ui';
import { useNotificationText } from '@/components/domain/useNotificationText';
import { useNotificationActions, useNotifications } from '@/hooks/queries/clinical';
import { useLocale } from '@/hooks/useLocale';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import { usePatientContext } from '../usePatientContext';

export default function NotificationsPage() {
  const { t } = useTranslation('patient');
  const { lang } = useLocale();
  const navigate = useNavigate();
  const { userId } = usePatientContext();
  const notifications = useNotifications(userId);
  const { markRead, markAllRead } = useNotificationActions();
  const text = useNotificationText();
  const unread = notifications.data?.filter((n) => !n.read).length ?? 0;

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-fg">{t('notifications.title')}</h1>
        {unread > 0 && (
          <Button
            variant="outline"
            size="sm"
            icon={CheckCheck}
            loading={markAllRead.isPending}
            onClick={() => markAllRead.mutate(userId)}
          >
            {t('notifications.markAll')}
          </Button>
        )}
      </div>
      <QueryBoundary
        query={notifications}
        loading={<SkeletonList rows={4} />}
        empty={<EmptyState icon={BellOff} title={t('notifications.empty')} body={t('notifications.emptyBody')} />}
      >
        {(list) => (
          <ul className="divide-y overflow-hidden rounded-xl border bg-surface">
            {list.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!n.read) markRead.mutate(n.id);
                    // Care companion notifications open the care plan; the rest open the appointment.
                    if (typeof n.params.planId === 'string') navigate(`/app/care/${n.params.planId}`);
                    else if (n.appointmentId) navigate(`/app/appointments/${n.appointmentId}`);
                  }}
                  className={cn(
                    'flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-muted',
                    !n.read && 'bg-primary-soft/30',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn('mt-2 h-2.5 w-2.5 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-primary')}
                  />
                  <span className="min-w-0 flex-1">
                    {!n.read && <span className="sr-only">{t('notifications.unread')}: </span>}
                    <span className={cn('block text-sm text-fg', !n.read && 'font-semibold')}>{text(n)}</span>
                    <span className="mt-0.5 block text-xs text-fg-subtle">{formatDateTime(n.createdAt, lang)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </QueryBoundary>
    </div>
  );
}
