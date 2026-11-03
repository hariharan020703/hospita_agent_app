// Check-in for a booked appointment: scan the booking QR (or type the booking ID), confirm, check in.
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CameraOff,
  CircleCheckBig,
  Info,
  Keyboard,
  LogIn,
  MapPin,
  ScanQrCode,
  Search,
  SearchX,
  TriangleAlert,
} from 'lucide-react';
import { Button, ErrorState, Spinner } from '@/components/ui';
import { useAppointmentByRef, useVisitActions } from '@/hooks/queries/appointments';
import { useDepartments } from '@/hooks/queries/directory';
import { useQueueEstimate } from '@/hooks/queries/queue';
import { useLocale } from '@/hooks/useLocale';
import { cn } from '@/lib/cn';
import { todayIso } from '@/lib/clock';
import { formatDate, formatTime } from '@/lib/format';
import { errorCodeOf } from '@/services';
import type { AppointmentView } from '@/types';
import { CodeKeypad } from './Keypad';
import { BackButton, FactList, Notice, ScreenTitle } from './ui';
import { useQrScanner, type ScannerStatus } from './useQrScanner';
import { useVisitFacts } from './visitFacts';

/** Booking IDs are "MF" + 6 characters from this set (no 0/O or 1/I). */
const REF_PREFIX = 'MF';
const REF_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const REF_BODY_LENGTH = 6;
const REF_IN_TEXT = /MF[A-Z0-9]{6}/;

/** The QR holds the booking ID itself; accept it inside a longer text or link too. */
function bookingRefFrom(raw: string): string | null {
  return REF_IN_TEXT.exec(raw.trim().toUpperCase())?.[0] ?? null;
}

type Step =
  | { kind: 'scan' }
  | { kind: 'manual' }
  | { kind: 'lookup'; bookingRef: string; via: 'scan' | 'manual' }
  | { kind: 'done'; appointment: AppointmentView };

// ------------------------------------------------------------------------------------------------ scan

function ScanStep({
  onCode,
  onManual,
  onBack,
}: {
  onCode: (bookingRef: string) => void;
  onManual: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation('kiosk');
  const [foreignCode, setForeignCode] = useState(false);
  const handleCode = useCallback(
    (value: string) => {
      const ref = bookingRefFrom(value);
      if (!ref) {
        setForeignCode(true);
        return false;
      }
      onCode(ref);
      return true;
    },
    [onCode],
  );
  const { videoRef, status } = useQrScanner(true, handleCode);
  const failed = status === 'denied' || status === 'unavailable' || status === 'error';
  const statusText: Record<ScannerStatus, string> = {
    starting: t('checkIn.starting'),
    scanning: t('checkIn.scanning'),
    denied: t('checkIn.denied'),
    unavailable: t('checkIn.noCamera'),
    error: t('checkIn.cameraError'),
  };

  return (
    <section aria-labelledby="kiosk-scan-title" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <ScreenTitle id="kiosk-scan-title">{t('checkIn.title')}</ScreenTitle>
          <p className="text-base text-fg-muted">{t('checkIn.scanHint')}</p>
        </div>
        <BackButton onClick={onBack} />
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border-2 border-border-strong bg-black">
          <video
            ref={videoRef}
            muted
            playsInline
            aria-label={t('checkIn.camera')}
            className={cn('h-full w-full object-cover', failed && 'invisible')}
          />
          {status === 'scanning' && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-[15%] rounded-3xl border-4 border-white shadow-[0_0_0_9999px_rgb(0_0_0/0.35)]"
            />
          )}
          {status === 'starting' && (
            <div aria-hidden className="absolute inset-0 grid place-items-center text-white">
              <Spinner className="h-9 w-9" />
            </div>
          )}
          {failed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-surface-sunken p-5 text-center">
              <CameraOff aria-hidden className="h-12 w-12 text-fg-muted" />
              <p className="text-balance text-lg text-fg">{statusText[status]}</p>
            </div>
          )}
        </div>
        <div className="space-y-4">
          <p role="status" className="flex items-start gap-3 text-base text-fg">
            <ScanQrCode aria-hidden className="mt-1 h-7 w-7 shrink-0 text-primary-ink" />
            {statusText[status]}
          </p>
          {foreignCode && status === 'scanning' && (
            <Notice tone="warning" role="alert" icon={TriangleAlert}>
              <p>{t('checkIn.notOurCode')}</p>
            </Notice>
          )}
          <Button size="lg" block variant={failed ? 'primary' : 'outline'} icon={Keyboard} onClick={onManual}>
            {t('checkIn.typeInstead')}
          </Button>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------- manual

function ManualStep({
  initial,
  onSubmit,
  onScan,
  onBack,
}: {
  initial: string;
  onSubmit: (bookingRef: string) => void;
  onScan: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation('kiosk');
  const [body, setBody] = useState(initial);
  const complete = body.length === REF_BODY_LENGTH;
  const type = (c: string) => setBody((b) => (b.length >= REF_BODY_LENGTH ? b : b + c));
  const cells = Array.from({ length: REF_BODY_LENGTH }, (_, i) => body[i] ?? '');

  return (
    <section aria-labelledby="kiosk-manual-title" className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_auto]">
      <div className="space-y-5">
        <ScreenTitle id="kiosk-manual-title">{t('checkIn.manualTitle')}</ScreenTitle>
        <p className="text-base text-fg-muted">{t('checkIn.manualHint')}</p>
        <div aria-hidden className="flex items-center gap-2 font-mono text-2xl font-bold">
          <span className="px-1 text-fg-muted">{REF_PREFIX}</span>
          {cells.map((c, i) => (
            <span
              key={i}
              className={cn(
                'grid h-12 w-9 place-items-center rounded-xl border-2 bg-surface',
                i === body.length ? 'border-primary' : 'border-border-strong',
              )}
            >
              {c}
            </span>
          ))}
        </div>
        <p aria-live="polite" className="sr-only">
          {`${REF_PREFIX} ${body.split('').join(' ')}`}
        </p>
        <Button size="lg" block icon={Search} disabled={!complete} onClick={() => onSubmit(REF_PREFIX + body)}>
          {t('checkIn.find')}
        </Button>
        <div className="flex flex-wrap gap-3">
          <BackButton onClick={onBack} />
          <Button size="lg" variant="outline" icon={ScanQrCode} onClick={onScan}>
            {t('checkIn.scanInstead')}
          </Button>
        </div>
      </div>
      <CodeKeypad
        label={t('checkIn.keypad')}
        chars={REF_CHARS}
        onChar={type}
        onBackspace={() => setBody((b) => b.slice(0, -1))}
        onClear={() => setBody('')}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------------------------- lookup

function LookupStep({
  bookingRef,
  onRetry,
  onCheckedIn,
  onDone,
}: {
  bookingRef: string;
  onRetry: () => void;
  onCheckedIn: (appointment: AppointmentView) => void;
  onDone: () => void;
}) {
  const { t } = useTranslation(['kiosk', 'common']);
  const lookup = useAppointmentByRef(bookingRef);

  if (lookup.isPending) {
    return (
      <div role="status" className="grid min-h-[50dvh] place-items-center">
        <p className="flex items-center gap-4 text-xl text-fg">
          <Spinner className="h-10 w-10" />
          {t('checkIn.finding')}
        </p>
      </div>
    );
  }

  if (lookup.isError) {
    const notFound = errorCodeOf(lookup.error) === 'NOT_FOUND';
    return (
      <section aria-labelledby="kiosk-lookup-title" className="mx-auto max-w-4xl space-y-4">
        <ScreenTitle id="kiosk-lookup-title">{t('checkIn.notFoundTitle')}</ScreenTitle>
        {notFound ? (
          <Notice tone="warning" icon={SearchX}>
            <p>{t('checkIn.notFound', { ref: bookingRef })}</p>
          </Notice>
        ) : (
          <ErrorState error={lookup.error} onRetry={() => void lookup.refetch()} className="text-base" />
        )}
        <div className="flex flex-wrap gap-4">
          <Button size="lg" onClick={onRetry}>
            {t('checkIn.tryAgain')}
          </Button>
          <Button size="lg" variant="outline" onClick={onDone}>
            {t('common:actions.done')}
          </Button>
        </div>
      </section>
    );
  }

  return <BookingFound appointment={lookup.data} onRetry={onRetry} onCheckedIn={onCheckedIn} onDone={onDone} />;
}

/** The booking summary, and either "Check in" or the reason it can't be checked in here. */
function BookingFound({
  appointment: a,
  onRetry,
  onCheckedIn,
  onDone,
}: {
  appointment: AppointmentView;
  onRetry: () => void;
  onCheckedIn: (appointment: AppointmentView) => void;
  onDone: () => void;
}) {
  const { t } = useTranslation(['kiosk', 'common']);
  const { lang } = useLocale();
  const departments = useDepartments();
  const { checkIn } = useVisitActions();
  const facts = useVisitFacts({
    appointment: a,
    department: departments.data?.find((d) => d.id === a.departmentId),
    show: ['patient', 'doctor', 'when', 'token'],
  });
  const today = todayIso();
  let blocked: string | null = null;
  if (a.status === 'checked_in' || a.status === 'in_consultation') {
    blocked = t('checkIn.reason.alreadyIn', { room: a.room });
  } else if (a.status === 'completed') {
    blocked = t('checkIn.reason.completed');
  } else if (a.status === 'cancelled') {
    blocked = t('checkIn.reason.cancelled');
  } else if (a.status === 'no_show') {
    blocked = t('checkIn.reason.noShow');
  } else if (a.date > today) {
    blocked = t('checkIn.reason.future', { date: formatDate(a.date, lang, 'long'), time: formatTime(a.start, lang) });
  } else if (a.date < today) {
    blocked = t('checkIn.reason.past', { date: formatDate(a.date, lang, 'long') });
  }
  const canCheckIn = blocked === null && a.status === 'booked' && a.date === today;

  return (
    <section aria-labelledby="kiosk-lookup-title" className="mx-auto max-w-5xl space-y-4">
      <ScreenTitle id="kiosk-lookup-title">
        {canCheckIn ? t('checkIn.confirmTitle') : t('checkIn.bookingTitle')}
      </ScreenTitle>
      <div className="rounded-3xl border-2 border-primary/30 bg-surface p-6 shadow-sm">
        <p className="mb-4 text-lg text-fg-muted">
          {t('checkIn.bookingRef')}: <span className="font-mono font-bold text-fg">{a.bookingRef}</span>
        </p>
        <FactList facts={facts} />
      </div>
      {blocked && (
        <Notice tone={a.status === 'checked_in' || a.status === 'in_consultation' ? 'info' : 'warning'} icon={Info}>
          <p>{blocked}</p>
        </Notice>
      )}
      <div className="flex flex-wrap gap-4">
        {canCheckIn ? (
          <>
            <Button
              size="lg"
              icon={LogIn}
              loading={checkIn.isPending}
              onClick={() => checkIn.mutate(a.id, { onSuccess: onCheckedIn })}
              className="min-w-64"
            >
              {t('checkIn.checkInNow')}
            </Button>
            <Button size="lg" variant="outline" onClick={onRetry} disabled={checkIn.isPending}>
              {t('checkIn.notMine')}
            </Button>
          </>
        ) : (
          <Button size="lg" onClick={onDone} className="min-w-48">
            {t('common:actions.done')}
          </Button>
        )}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------------------------------------ done

function CheckedInScreen({ appointment, onDone }: { appointment: AppointmentView; onDone: () => void }) {
  const { t } = useTranslation(['kiosk', 'common']);
  const { l } = useLocale();
  const departments = useDepartments();
  const estimate = useQueueEstimate(appointment.id);
  const department = departments.data?.find((d) => d.id === appointment.departmentId);
  const facts = useVisitFacts({
    appointment,
    department,
    estimate: estimate.data,
    show: ['room', 'ahead', 'expected', 'doctor'],
  });

  return (
    <section aria-labelledby="kiosk-checked-in-title" className="space-y-4">
      <div className="flex items-center gap-4">
        <CircleCheckBig aria-hidden className="h-12 w-12 shrink-0 text-success-ink" />
        <ScreenTitle id="kiosk-checked-in-title">{t('checkIn.successTitle')}</ScreenTitle>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[auto_minmax(0,1fr)]">
        <div className="rounded-3xl border-2 border-primary/40 bg-surface px-6 py-8 text-center shadow-sm">
          <p className="text-base font-semibold text-fg-muted">{t('common:token')}</p>
          <p className="text-8xl font-extrabold tracking-tight text-fg tabular">{appointment.token}</p>
        </div>
        <FactList facts={facts} />
      </div>
      <Notice tone="success" icon={MapPin} role="status">
        <p className="font-semibold">
          {department
            ? t('checkIn.successBody', { room: appointment.room, wing: l(department.wing), floor: department.floor })
            : t('checkIn.successBodyRoomOnly', { room: appointment.room })}
        </p>
      </Notice>
      <Button size="lg" onClick={onDone} className="min-w-48">
        {t('common:actions.done')}
      </Button>
    </section>
  );
}

// ------------------------------------------------------------------------------------------------ flow

export function CheckInFlow({ onHome, onReset }: { onHome: () => void; onReset: () => void }) {
  const [step, setStep] = useState<Step>({ kind: 'scan' });
  const [typed, setTyped] = useState('');
  const onScanned = useCallback((bookingRef: string) => setStep({ kind: 'lookup', bookingRef, via: 'scan' }), []);

  switch (step.kind) {
    case 'scan':
      return <ScanStep onCode={onScanned} onManual={() => setStep({ kind: 'manual' })} onBack={onHome} />;
    case 'manual':
      return (
        <ManualStep
          initial={typed}
          onSubmit={(bookingRef) => {
            setTyped(bookingRef.slice(REF_PREFIX.length));
            setStep({ kind: 'lookup', bookingRef, via: 'manual' });
          }}
          onScan={() => setStep({ kind: 'scan' })}
          onBack={onHome}
        />
      );
    case 'lookup':
      return (
        <LookupStep
          bookingRef={step.bookingRef}
          onRetry={() => setStep({ kind: step.via })}
          onCheckedIn={(appointment) => setStep({ kind: 'done', appointment })}
          onDone={onReset}
        />
      );
    case 'done':
      return <CheckedInScreen appointment={step.appointment} onDone={onReset} />;
  }
}
