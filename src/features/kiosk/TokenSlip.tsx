// Walk-in token: big token number, where to go, live queue position, booking QR, and an 80 mm printable slip.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleCheckBig, MapPin, Printer } from 'lucide-react';
import { Button } from '@/components/ui';
import { BookingQr } from '@/components/domain/BookingQr';
import { useQueueEstimate } from '@/hooks/queries/queue';
import { useLocale } from '@/hooks/useLocale';
import { now } from '@/lib/clock';
import { formatDate, formatTime } from '@/lib/format';
import { timeOf, toIsoDate } from '@/lib/time';
import type { AppointmentView, Department, Hospital, QueueEstimate } from '@/types';
import { FactList, Notice, ScreenTitle } from './ui';
import { useVisitFacts } from './visitFacts';

/** Thermal-printer slip: black on white, about 80 mm wide. Hidden on screen, the only thing printed. */
function PrintSlip({
  appointment,
  department,
  hospital,
  estimate,
  issuedAt,
}: {
  appointment: AppointmentView;
  department: Department | undefined;
  hospital: Hospital | undefined;
  estimate: QueueEstimate | undefined;
  issuedAt: Date;
}) {
  const { t } = useTranslation(['kiosk', 'common']);
  const { lang, l, doctorName } = useLocale();
  const rows: { label: string; value: string }[] = [
    { label: t('facts.department'), value: l(department?.name) || '—' },
  ];
  if (department) {
    rows.push({
      label: t('facts.where'),
      value: t('facts.location', { wing: l(department.wing), floor: department.floor }),
    });
  }
  rows.push(
    { label: t('facts.doctor'), value: doctorName(appointment) },
    { label: t('facts.room'), value: appointment.room },
    { label: t('facts.expected'), value: formatTime(estimate?.expectedStart ?? appointment.start, lang) },
  );
  if (estimate) rows.push({ label: t('facts.ahead'), value: String(estimate.patientsAhead) });
  return (
    <section className="print-only mx-auto w-[80mm] bg-white p-1 text-[11pt] leading-snug text-black">
      <div className="space-y-2 text-center">
        <p className="text-[13pt] font-bold">{l(hospital?.name)}</p>
        <p className="font-semibold">{t('slip.printHeading')}</p>
        <p className="text-[40pt] font-extrabold leading-none">{appointment.token}</p>
      </div>
      <hr className="my-2 border-dashed border-black" />
      <dl className="space-y-1">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex justify-between gap-3">
            <dt>{label}</dt>
            <dd className="text-right font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <hr className="my-2 border-dashed border-black" />
      <div className="flex flex-col items-center gap-1 text-center">
        <BookingQr
          bookingRef={appointment.bookingRef}
          label={t('slip.qr', { ref: appointment.bookingRef })}
          className="h-[32mm] w-[32mm] rounded-none p-0"
        />
        <p>
          {t('slip.bookingRef')}: <span className="font-mono font-bold">{appointment.bookingRef}</span>
        </p>
        <p>
          {t('slip.issued', {
            date: formatDate(toIsoDate(issuedAt), lang, 'medium'),
            time: formatTime(timeOf(issuedAt), lang),
          })}
        </p>
        <p className="font-semibold">{t('slip.printFooter')}</p>
        <p className="text-[9pt]">{t('common:disclaimer')}</p>
      </div>
    </section>
  );
}

export function TokenSlip({
  appointment,
  department,
  hospital,
  onDone,
}: {
  appointment: AppointmentView;
  department: Department | undefined;
  hospital: Hospital | undefined;
  onDone: () => void;
}) {
  const { t } = useTranslation(['kiosk', 'common']);
  const { l } = useLocale();
  const estimate = useQueueEstimate(appointment.id);
  const [issuedAt] = useState(now);
  const facts = useVisitFacts({
    appointment,
    department,
    estimate: estimate.data,
    show: ['department', 'doctor', 'room', 'expected', 'ahead'],
  });

  return (
    <>
      <section aria-labelledby="kiosk-slip-title" className="no-print space-y-4">
        <div className="flex items-center gap-4">
          <CircleCheckBig aria-hidden className="h-10 w-10 shrink-0 text-success-ink" />
          <ScreenTitle id="kiosk-slip-title">{t('slip.title')}</ScreenTitle>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="space-y-5 rounded-3xl border-2 border-primary/40 bg-surface p-6 shadow-sm">
            <div>
              <p className="text-base font-semibold text-fg-muted">{t('common:token')}</p>
              <p className="text-8xl font-extrabold tracking-tight text-fg tabular">{appointment.token}</p>
            </div>
            <FactList facts={facts} />
          </div>
          <div className="flex flex-col items-center gap-3 rounded-3xl border bg-surface p-6 text-center shadow-sm">
            <BookingQr
              bookingRef={appointment.bookingRef}
              label={t('slip.qr', { ref: appointment.bookingRef })}
              className="h-56 w-56"
            />
            <p className="text-lg text-fg-muted">{t('slip.bookingRef')}</p>
            <p className="font-mono text-xl font-bold text-fg">{appointment.bookingRef}</p>
            <p className="max-w-[16rem] text-base text-fg-muted">{t('slip.qrHint')}</p>
          </div>
        </div>
        <Notice icon={MapPin}>
          <p>
            {department
              ? t('slip.where', { wing: l(department.wing), floor: department.floor, room: appointment.room })
              : t('slip.whereRoomOnly', { room: appointment.room })}
          </p>
        </Notice>
        <div className="flex flex-wrap gap-4">
          <Button size="lg" variant="outline" icon={Printer} onClick={() => window.print()}>
            {t('slip.print')}
          </Button>
          <Button size="lg" onClick={onDone} className="min-w-48">
            {t('common:actions.done')}
          </Button>
        </div>
      </section>
      <PrintSlip
        appointment={appointment}
        department={department}
        hospital={hospital}
        estimate={estimate.data}
        issuedAt={issuedAt}
      />
    </>
  );
}
