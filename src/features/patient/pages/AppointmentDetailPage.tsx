import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarClock, CalendarPlus, CheckCircle2, Radio, XCircle } from 'lucide-react';
import {
  Button,
  buttonClasses,
  Card,
  CardBody,
  ConfirmDialog,
  ErrorState,
  Field,
  Modal,
  PageHeader,
  RadioGroup,
  SkeletonCard,
  SkeletonList,
  StatusPill,
  Textarea,
  TimeSlotPicker,
} from '@/components/ui';
import { BookingQr } from '@/components/domain/BookingQr';
import { DateStrip } from '@/components/domain/DateStrip';
import { useAppointment, useCancelAppointment, useRescheduleAppointment, useSlots } from '@/hooks/queries/appointments';
import { useDepartments, useHospital } from '@/hooks/queries/directory';
import { useLocale } from '@/hooks/useLocale';
import { now } from '@/lib/clock';
import { downloadFile, toIcs } from '@/lib/download';
import { formatDate, formatTime } from '@/lib/format';
import { addDaysIso, atTime } from '@/lib/time';
import { CANCEL_REASONS, isActiveStatus, type AppointmentView, type CancelReason } from '@/types';
import { usePatientContext } from '../usePatientContext';

function RescheduleDialog({
  appointment,
  open,
  onClose,
  days,
}: {
  appointment: AppointmentView;
  open: boolean;
  onClose: () => void;
  days: number;
}) {
  const { t } = useTranslation(['patient', 'common']);
  const { today } = usePatientContext();
  const [date, setDate] = useState(appointment.date);
  const [start, setStart] = useState<string | null>(null);
  const slots = useSlots(appointment.doctorId, open ? date : null);
  const reschedule = useRescheduleAppointment();
  const dates = useMemo(() => Array.from({ length: days }, (_, i) => addDaysIso(today, i)), [today, days]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={t('appointment.rescheduleTitle')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common:actions.cancel')}
          </Button>
          <Button
            disabled={!start}
            loading={reschedule.isPending}
            onClick={() =>
              start && reschedule.mutate({ id: appointment.id, date, start, by: 'patient' }, { onSuccess: onClose })
            }
          >
            {t('appointment.rescheduleConfirm')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <DateStrip
          dates={dates}
          value={date}
          today={today}
          label={t('doctor.chooseDate')}
          onChange={(d) => {
            setDate(d);
            setStart(null);
          }}
        />
        {slots.isPending ? (
          <SkeletonList rows={2} rowClassName="h-12" />
        ) : slots.isError ? (
          <ErrorState error={slots.error} onRetry={() => void slots.refetch()} />
        ) : (
          <TimeSlotPicker slots={slots.data} value={start} onChange={setStart} />
        )}
      </div>
    </Modal>
  );
}

function CancelDialog({
  appointment,
  open,
  onClose,
}: {
  appointment: AppointmentView;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation(['patient', 'common']);
  const [code, setCode] = useState<CancelReason['code'] | undefined>();
  const [note, setNote] = useState('');
  const cancel = useCancelAppointment();
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      tone="danger"
      title={t('appointment.cancelTitle')}
      body={t('appointment.cancelBody')}
      confirmLabel={t('appointment.cancelConfirm')}
      confirmDisabled={!code}
      loading={cancel.isPending}
      onConfirm={() =>
        code &&
        cancel.mutate(
          { id: appointment.id, reason: { code, by: 'patient', ...(note.trim() ? { note: note.trim() } : {}) } },
          { onSuccess: onClose },
        )
      }
    >
      <div className="space-y-4">
        <RadioGroup
          legend={t('appointment.cancelReason')}
          name="cancel-reason"
          value={code}
          onChange={setCode}
          options={CANCEL_REASONS.map((r) => ({ value: r, label: t(`appointment.cancelReasons.${r}`) }))}
        />
        <Field label={t('appointment.cancelNote')}>
          {(c) => <Textarea {...c} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />}
        </Field>
      </div>
    </ConfirmDialog>
  );
}

export default function AppointmentDetailPage() {
  const { t } = useTranslation(['patient', 'common']);
  const { lang, l, doctorName } = useLocale();
  const { id } = useParams();
  const [params] = useSearchParams();
  const { today } = usePatientContext();
  const appointment = useAppointment(id);
  const hospital = useHospital();
  const departments = useDepartments();
  const [dialog, setDialog] = useState<'reschedule' | 'cancel' | null>(null);

  if (appointment.isPending) return <SkeletonCard />;
  if (appointment.isError) return <ErrorState error={appointment.error} onRetry={() => void appointment.refetch()} />;
  const a = appointment.data;
  const department = departments.data?.find((d) => d.id === a.departmentId);
  const active = isActiveStatus(a.status);
  const cutoffMins = hospital.data?.booking.changeCutoffMins ?? 60;
  const changeable = a.status === 'booked' && atTime(a.date, a.start).getTime() - cutoffMins * 60_000 > now().getTime();

  const addToCalendar = () => {
    const ics = toIcs(
      {
        uid: `${a.id}@mediflow`,
        title: t('appointment.calendarTitle', { doctor: doctorName(a) }),
        description: t('appointment.calendarDescription', { token: a.token, ref: a.bookingRef }),
        location: `${l(hospital.data?.name)}, ${t('common:room', { room: a.room })}`,
        start: atTime(a.date, a.start),
        end: atTime(a.date, a.end),
      },
      now(),
    );
    downloadFile(`mediflow-${a.bookingRef}.ics`, ics, 'text/calendar;charset=utf-8');
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('appointment.title')}
        breadcrumbs={[{ label: t('appointments.title'), to: '/app/appointments' }, { label: a.token }]}
      />

      {params.get('booked') === '1' && a.status === 'booked' && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-success/30 bg-success-soft p-4">
          <CheckCircle2 aria-hidden className="mt-0.5 h-6 w-6 shrink-0 text-success-ink" />
          <div>
            <p className="font-semibold text-success-ink">{t('booking.successTitle')}</p>
            <p className="text-sm text-fg">{t('booking.successBody')}</p>
          </div>
        </div>
      )}

      {/* Large screens: appointment details on the left, actions in a side panel. */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8">
        <Card>
          <CardBody className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium text-fg-muted">{t('appointment.token')}</p>
              <p className="text-5xl font-extrabold tracking-tight text-fg tabular">{a.token}</p>
              <StatusPill status={a.status} size="md" />
              <p className="text-sm text-fg-muted">
                {t('appointment.bookingRef')}: <span className="font-mono font-semibold text-fg">{a.bookingRef}</span>
              </p>
            </div>
            {active && (
              <div className="flex flex-col items-center gap-2">
                <BookingQr bookingRef={a.bookingRef} label={`${t('appointment.qrTitle')} ${a.bookingRef}`} />
                <p className="max-w-[14rem] text-xs text-fg-muted">{t('appointment.qrHint')}</p>
              </div>
            )}
          </CardBody>
          <dl className="grid gap-4 border-t p-4 text-sm sm:grid-cols-2 sm:p-5">
            <div>
              <dt className="text-fg-muted">{t('appointment.patient')}</dt>
              <dd className="font-medium text-fg">{a.patientName}</dd>
            </div>
            <div>
              <dt className="text-fg-muted">{t('appointment.doctor')}</dt>
              <dd className="font-medium text-fg">{doctorName(a)}</dd>
              <dd className="text-fg-muted">{l(department?.name)}</dd>
            </div>
            <div>
              <dt className="text-fg-muted">{t('appointment.when')}</dt>
              <dd className="font-medium text-fg">
                {formatDate(a.date, lang, 'long')}, {formatTime(a.start, lang)}
              </dd>
            </div>
            <div>
              <dt className="text-fg-muted">{t('appointment.where')}</dt>
              <dd className="font-medium text-fg">
                {department
                  ? t('doctor.locationValue', { room: a.room, wing: l(department.wing), floor: department.floor })
                  : a.room}
              </dd>
            </div>
            {a.reason && (
              <div className="sm:col-span-2">
                <dt className="text-fg-muted">{t('appointment.reason')}</dt>
                <dd className="text-fg">{a.reason}</dd>
              </div>
            )}
            {a.note && a.status === 'completed' && (
              <div className="sm:col-span-2">
                <dt className="text-fg-muted">{t('appointment.note')}</dt>
                <dd className="text-fg">{a.note}</dd>
              </div>
            )}
          </dl>
        </Card>

        {active && (
          <section
            aria-label={t('appointment.actions')}
            className="space-y-3 lg:sticky lg:top-24 lg:rounded-xl lg:border lg:bg-surface lg:p-5 lg:shadow-xs"
          >
            <h2 className="hidden font-semibold text-fg lg:block">{t('appointment.actions')}</h2>
            {a.date === today && (
              <Link to={`/app/queue/${a.id}`} className={buttonClasses('primary', 'lg', true)}>
                <Radio aria-hidden className="h-5 w-5" />
                {t('appointment.trackQueue')}
              </Link>
            )}
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
              <Button variant="outline" icon={CalendarPlus} onClick={addToCalendar}>
                {t('appointment.addToCalendar')}
              </Button>
              <Button
                variant="outline"
                icon={CalendarClock}
                disabled={!changeable}
                onClick={() => setDialog('reschedule')}
              >
                {t('appointment.reschedule')}
              </Button>
              <Button variant="dangerOutline" icon={XCircle} onClick={() => setDialog('cancel')}>
                {t('appointment.cancel')}
              </Button>
            </div>
            <p className="text-xs text-fg-subtle">
              {changeable || a.status !== 'booked'
                ? t('appointment.changeCutoff', { count: cutoffMins })
                : t('appointment.tooLateToChange')}
            </p>
          </section>
        )}
      </div>

      {dialog === 'reschedule' && (
        <RescheduleDialog
          appointment={a}
          open
          onClose={() => setDialog(null)}
          days={hospital.data?.booking.maxDaysAhead ?? 14}
        />
      )}
      {dialog === 'cancel' && <CancelDialog appointment={a} open onClose={() => setDialog(null)} />}
    </div>
  );
}
