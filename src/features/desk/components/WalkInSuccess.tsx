// Walk-in result: the issued token on screen, plus a print-only token slip.
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Printer, UserPlus } from 'lucide-react';
import { Button, Card, CardBody, StatusPill } from '@/components/ui';
import { BookingQr } from '@/components/domain/BookingQr';
import { useDepartments, useHospital } from '@/hooks/queries/directory';
import { useLocale } from '@/hooks/useLocale';
import { formatDate, formatTime } from '@/lib/format';
import type { AppointmentView } from '@/types';

/** "Room 4, Main block, floor 1" when the department is known, otherwise just the room. */
function useWhere(appointment: AppointmentView) {
  const { t } = useTranslation(['desk', 'common']);
  const { l } = useLocale();
  const departments = useDepartments();
  const department = departments.data?.find((d) => d.id === appointment.departmentId);
  return {
    department,
    where: department
      ? t('walkIn.location', { room: appointment.room, wing: l(department.wing), floor: department.floor })
      : t('common:room', { room: appointment.room }),
  };
}

export function WalkInSuccess({
  appointment: a,
  onRegisterAnother,
}: {
  appointment: AppointmentView;
  onRegisterAnother: () => void;
}) {
  const { t } = useTranslation(['desk', 'common']);
  const { lang, l, doctorName } = useLocale();
  const { department, where } = useWhere(a);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const details: [string, string, string?][] = [
    [t('walkIn.patient'), a.patientName],
    [t('walkIn.doctorLabel'), doctorName(a), l(department?.name)],
    [t('walkIn.where'), where],
    [t('walkIn.expectedTime'), formatTime(a.start, lang), formatDate(a.date, lang, 'long')],
    [t('walkIn.bookingRef'), a.bookingRef],
  ];

  return (
    <Card className="mx-auto max-w-3xl">
      <CardBody className="space-y-6">
        <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success-soft p-4">
          <CheckCircle2 aria-hidden className="mt-0.5 h-6 w-6 shrink-0 text-success-ink" />
          <div>
            <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-success-ink focus:outline-none">
              {t('walkIn.successTitle')}
            </h2>
            <p className="text-sm text-fg">{t('walkIn.successBody', { name: a.patientName })}</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
          <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-primary bg-primary-soft/50 px-10 py-6 text-center">
            <p className="text-sm font-medium text-fg-muted">{t('walkIn.token')}</p>
            <p className="text-6xl font-extrabold tracking-tight text-fg tabular">{a.token}</p>
            <StatusPill status={a.status} size="md" />
          </div>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            {details.map(([label, value, extra]) => (
              <div key={label} className="min-w-0">
                <dt className="text-fg-muted">{label}</dt>
                <dd className="break-words font-semibold text-fg">{value}</dd>
                {extra && <dd className="text-fg-muted">{extra}</dd>}
              </div>
            ))}
          </dl>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="lg" icon={Printer} onClick={() => window.print()}>
            {t('walkIn.printSlip')}
          </Button>
          <Button size="lg" variant="outline" icon={UserPlus} onClick={onRegisterAnother}>
            {t('walkIn.registerAnother')}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

/** Hidden on screen; the only thing printed by "Print slip" (the rest of the page is `no-print`). */
export function TokenSlip({ appointment: a }: { appointment: AppointmentView }) {
  const { t } = useTranslation(['desk', 'common']);
  const { lang, l, doctorName } = useLocale();
  const hospital = useHospital();
  const { department, where } = useWhere(a);

  const rows: [string, string][] = [
    [t('walkIn.patient'), a.patientName],
    [t('walkIn.doctorLabel'), [doctorName(a), l(department?.name)].filter(Boolean).join(' · ')],
    [t('walkIn.where'), where],
    [t('walkIn.slip.date'), formatDate(a.date, lang, 'long')],
    [t('walkIn.expectedTime'), formatTime(a.start, lang)],
    [t('walkIn.bookingRef'), a.bookingRef],
  ];

  return (
    <section className="print-only mx-auto max-w-sm text-center text-fg">
      <p className="text-lg font-bold">{l(hospital.data?.name)}</p>
      <p className="text-sm">{t('walkIn.slip.title')}</p>
      <p className="my-4 text-7xl font-extrabold tracking-tight tabular">{a.token}</p>
      <dl className="space-y-1 border-y py-3 text-left text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt>{label}</dt>
            <dd className="text-right font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex justify-center">
        <BookingQr bookingRef={a.bookingRef} label={t('walkIn.slip.qr', { ref: a.bookingRef })} className="h-28 w-28" />
      </div>
      <p className="mt-3 text-sm">{t('walkIn.slip.note', { location: where })}</p>
    </section>
  );
}
