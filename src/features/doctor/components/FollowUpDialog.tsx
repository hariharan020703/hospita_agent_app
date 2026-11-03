// Book a follow-up visit with the same doctor: next 14 days, then a free slot from real availability.
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ErrorState, Modal, SkeletonList, TimeSlotPicker, toast } from '@/components/ui';
import { DateStrip } from '@/components/domain/DateStrip';
import { useSlots, useVisitActions } from '@/hooks/queries/appointments';
import { useHospital, useSchedule } from '@/hooks/queries/directory';
import { useLocale } from '@/hooks/useLocale';
import { formatDate, formatTime } from '@/lib/format';
import { addDaysIso, weekdayOf } from '@/lib/time';
import type { AppointmentView } from '@/types';

const DAYS_AHEAD = 14;

export function FollowUpDialog({
  appointment,
  today,
  onClose,
}: {
  appointment: AppointmentView;
  today: string;
  onClose: () => void;
}) {
  const { t } = useTranslation(['doctor', 'common']);
  const { lang } = useLocale();
  const schedule = useSchedule(appointment.doctorId);
  const hospital = useHospital();
  const { scheduleFollowUp } = useVisitActions();
  const dates = useMemo(() => Array.from({ length: DAYS_AHEAD }, (_, i) => addDaysIso(today, i + 1)), [today]);
  const holidays = new Set(hospital.data?.holidays.map((h) => h.date));
  const isClosed = (date: string) =>
    holidays.has(date) || (schedule.data ? schedule.data.weekly[weekdayOf(date)].length === 0 : false);
  const [chosenDate, setChosenDate] = useState<string | null>(null);
  const [start, setStart] = useState<string | null>(null);
  const date = chosenDate ?? dates.find((d) => !isClosed(d)) ?? dates[0] ?? today;
  const slots = useSlots(appointment.doctorId, date);

  const confirm = () => {
    if (!start) return;
    scheduleFollowUp.mutate(
      { id: appointment.id, date, start },
      {
        onSuccess: () => {
          toast.success(
            t('followUp.booked', {
              name: appointment.patientName,
              date: formatDate(date, lang, 'weekday'),
              time: formatTime(start, lang),
            }),
          );
          onClose();
        },
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      dismissible={!scheduleFollowUp.isPending}
      title={t('followUp.title')}
      description={t('followUp.description', { name: appointment.patientName })}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={scheduleFollowUp.isPending}>
            {t('common:actions.cancel')}
          </Button>
          <Button disabled={!start} loading={scheduleFollowUp.isPending} onClick={confirm}>
            {t('followUp.confirm')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-fg">{t('followUp.chooseDate')}</h3>
        <DateStrip
          dates={dates}
          value={date}
          today={today}
          label={t('followUp.chooseDate')}
          isClosed={isClosed}
          onChange={(next) => {
            setChosenDate(next);
            setStart(null);
          }}
        />
        <h3 className="text-sm font-semibold text-fg">{t('followUp.chooseTime')}</h3>
        {slots.isPending ? (
          <SkeletonList rows={2} rowClassName="h-12" />
        ) : slots.isError ? (
          <ErrorState error={slots.error} onRetry={() => void slots.refetch()} />
        ) : (
          <TimeSlotPicker slots={slots.data} value={start} onChange={setStart} showUnavailable={false} />
        )}
        <p aria-live="polite" className="min-h-5 text-sm text-fg-muted">
          {start
            ? t('followUp.selected', { date: formatDate(date, lang, 'weekday'), time: formatTime(start, lang) })
            : ''}
        </p>
      </div>
    </Modal>
  );
}
