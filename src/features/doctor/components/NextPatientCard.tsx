// The first checked-in patient, with their AI pre-visit summary, "Call next" and "No-show".
import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BellRing, UserRound, UserX } from 'lucide-react';
import { Button, Card, CardBody, CardHeader, ConfirmDialog, EmptyState, toast } from '@/components/ui';
import { useVisitActions } from '@/hooks/queries/appointments';
import { useLocale } from '@/hooks/useLocale';
import { formatTime } from '@/lib/format';
import type { AppointmentView, DoctorQueue } from '@/types';
import { clockTime } from '../utils';
import { PreVisitSummaryPanel } from './PreVisitSummary';

export function NextPatientCard({ queue, doctorId }: { queue: DoctorQueue; doctorId: string }) {
  const { t } = useTranslation(['doctor', 'common']);
  const { lang } = useLocale();
  const { callNext, markNoShow } = useVisitActions();
  const [noShowTarget, setNoShowTarget] = useState<AppointmentView | null>(null);
  const hintId = useId();
  const next = queue.waiting[0] ?? null;
  const busy = queue.current !== null;
  const hint = busy ? t('next.busyHint') : next ? null : t('next.nobodyHint');

  const call = () =>
    callNext.mutate(doctorId, {
      onSuccess: (called) => {
        if (called) toast.success(t('next.called', { name: called.patientName, token: called.token }));
        else toast.info(t('next.nobodyCalled'));
      },
    });

  const confirmNoShow = () => {
    if (!noShowTarget) return;
    const { id, patientName } = noShowTarget;
    markNoShow.mutate(id, {
      onSuccess: () => {
        toast.success(t('next.noShowDone', { name: patientName }));
        setNoShowTarget(null);
      },
    });
  };

  return (
    <Card>
      <CardHeader
        title={t('next.title')}
        actions={
          <>
            <Button
              icon={BellRing}
              onClick={call}
              loading={callNext.isPending}
              disabled={busy || !next}
              aria-describedby={hint ? hintId : undefined}
            >
              {t('next.callNext')}
            </Button>
            {next && (
              <Button variant="dangerOutline" icon={UserX} onClick={() => setNoShowTarget(next)}>
                {t('next.noShow')}
              </Button>
            )}
          </>
        }
      />
      <CardBody className="space-y-4">
        {hint && (
          <p id={hintId} className="text-sm text-fg-muted">
            {hint}
          </p>
        )}
        <div aria-live="polite" aria-atomic="true">
          {next ? (
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 space-y-0.5">
                <Link
                  to={`/doctor/patients/${next.patientId}`}
                  className="inline-flex items-center gap-1.5 text-xl font-bold text-fg hover:text-primary-ink hover:underline"
                >
                  <UserRound aria-hidden className="h-5 w-5 shrink-0 text-fg-subtle" />
                  {next.patientName}
                </Link>
                <p className="text-sm text-fg-muted">
                  {[
                    t('next.slot', { time: formatTime(next.start, lang) }),
                    next.checkedInAt
                      ? t('next.checkedInAt', { time: formatTime(clockTime(next.checkedInAt), lang) })
                      : '',
                    t(`next.source.${next.source}`),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {next.reason && <p className="text-sm text-fg">{t('next.reason', { reason: next.reason })}</p>}
              </div>
              <div className="text-right">
                <p className="text-sm text-fg-muted">{t('common:token')}</p>
                <p className="text-3xl font-extrabold tracking-tight text-fg tabular">{next.token}</p>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={UserRound}
              title={t('next.empty')}
              body={queue.expected.length > 0 ? t('next.expectedLater', { count: queue.expected.length }) : undefined}
              className="py-6"
            />
          )}
        </div>
        {next && <PreVisitSummaryPanel key={next.id} appointment={next} />}
      </CardBody>

      <ConfirmDialog
        open={noShowTarget !== null}
        onClose={() => setNoShowTarget(null)}
        onConfirm={confirmNoShow}
        tone="danger"
        loading={markNoShow.isPending}
        title={t('next.noShowTitle', { name: noShowTarget?.patientName ?? '' })}
        body={t('next.noShowBody', { token: noShowTarget?.token ?? '' })}
        confirmLabel={t('next.noShowConfirm')}
      />
    </Card>
  );
}
