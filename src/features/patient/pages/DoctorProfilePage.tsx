import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Award, IdCard, Languages, MapPin, Wallet } from 'lucide-react';
import {
  Avatar,
  Button,
  Card,
  CardBody,
  EmptyState,
  ErrorState,
  PageHeader,
  SkeletonCard,
  SkeletonList,
  TimeSlotPicker,
} from '@/components/ui';
import { DateStrip } from '@/components/domain/DateStrip';
import { useDepartments, useDoctor, useHospital, useSchedule } from '@/hooks/queries/directory';
import { useSlots } from '@/hooks/queries/appointments';
import { useLocale } from '@/hooks/useLocale';
import { formatCurrency, formatDate, formatTime } from '@/lib/format';
import { addDaysIso, weekdayOf } from '@/lib/time';
import { WEEKDAYS } from '@/types';
import { usePatientContext } from '../usePatientContext';

export default function DoctorProfilePage() {
  const { t } = useTranslation(['patient', 'common']);
  const { lang, l, doctorName } = useLocale();
  const { doctorId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { today } = usePatientContext();
  const doctor = useDoctor(doctorId);
  const departments = useDepartments();
  const schedule = useSchedule(doctorId);
  const hospital = useHospital();
  const [chosenDate, setChosenDate] = useState<string | null>(null);
  const [start, setStart] = useState<string | null>(null);

  const date = chosenDate ?? doctor.data?.nextAvailable?.date ?? today;
  const slots = useSlots(doctorId, date);
  const days = hospital.data?.booking.maxDaysAhead ?? 14;
  const dates = useMemo(() => Array.from({ length: days }, (_, i) => addDaysIso(today, i)), [today, days]);
  const department = departments.data?.find((d) => d.id === doctor.data?.departmentId);
  const holidays = new Set(hospital.data?.holidays.map((h) => h.date));
  const isClosed = (d: string) =>
    holidays.has(d) || (schedule.data ? schedule.data.weekly[weekdayOf(d)].length === 0 : false);

  if (doctor.isPending) return <SkeletonCard />;
  if (doctor.isError) return <ErrorState error={doctor.error} onRetry={() => void doctor.refetch()} />;
  const d = doctor.data;
  const bookable = d.active && department?.bookable;
  const triage = params.get('triage');

  const proceed = () => {
    if (!start) return;
    const query = new URLSearchParams({ date, start, ...(triage ? { triage } : {}) });
    navigate(`/app/book/${d.id}?${query.toString()}`);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={doctorName(d)}
        breadcrumbs={[{ label: t('doctors.title'), to: '/app/doctors' }, { label: doctorName(d) }]}
      />
      {/* Large screens: doctor details on the left, booking panel on the right. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-start">
        <Card>
          <CardBody className="flex flex-col gap-4 sm:flex-row">
            <Avatar name={d.name} src={d.photoUrl} size="xl" />
            <div className="min-w-0 space-y-2">
              <p className="text-lg font-semibold text-fg">{l(department?.name)}</p>
              <p className="text-sm text-fg-muted">{t('common:experience', { count: d.experienceYears })}</p>
              {d.bio && <p className="text-fg">{l(d.bio)}</p>}
            </div>
          </CardBody>
          <dl className="grid gap-4 border-t p-4 text-sm sm:grid-cols-2 sm:p-5">
            {[
              { icon: Award, label: t('doctor.qualifications'), value: d.qualifications.join(', ') },
              {
                icon: Languages,
                label: t('doctor.languages'),
                value: d.languages.map((c) => t(`common:language.${c}`)).join(', '),
              },
              { icon: Wallet, label: t('common:fee'), value: formatCurrency(d.fee, lang) },
              {
                icon: MapPin,
                label: t('doctor.location'),
                value: department
                  ? t('doctor.locationValue', { room: d.room, wing: l(department.wing), floor: department.floor })
                  : d.room,
              },
              { icon: IdCard, label: t('doctor.registration'), value: d.registrationNo },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex gap-3">
                <Icon aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-fg-subtle" />
                <div>
                  <dt className="text-fg-muted">{label}</dt>
                  <dd className="font-medium text-fg">{value}</dd>
                </div>
              </div>
            ))}
          </dl>
          {schedule.data && (
            <div className="border-t p-4 sm:p-5">
              <h2 className="mb-2 text-sm font-semibold text-fg">{t('doctor.hours')}</h2>
              <ul className="grid gap-1 text-sm sm:grid-cols-2">
                {WEEKDAYS.map((day) => {
                  const ranges = schedule.data.weekly[day];
                  return (
                    <li key={day} className="flex justify-between gap-3">
                      <span className="text-fg-muted">{t(`common:weekdays.${day}`)}</span>
                      <span className="text-right font-medium text-fg tabular">
                        {ranges.length
                          ? ranges.map((r) => `${formatTime(r.start, lang)}–${formatTime(r.end, lang)}`).join(', ')
                          : t('doctor.closed')}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </Card>

        {!bookable ? (
          <EmptyState title={t('doctor.notBookable')} />
        ) : (
          <section
            aria-labelledby="book-title"
            className="space-y-4 rounded-xl border bg-surface p-4 sm:p-5 lg:sticky lg:top-24"
          >
            <h2 id="book-title" className="text-lg font-semibold text-fg">
              {t('doctor.chooseDate')}
            </h2>
            <DateStrip
              dates={dates}
              value={date}
              today={today}
              label={t('doctor.chooseDate')}
              isClosed={isClosed}
              onChange={(next) => {
                setChosenDate(next);
                setStart(null);
              }}
            />
            <h3 className="text-base font-semibold text-fg">{t('doctor.chooseTime')}</h3>
            {slots.isPending ? (
              <SkeletonList rows={2} rowClassName="h-12" />
            ) : slots.isError ? (
              <ErrorState error={slots.error} onRetry={() => void slots.refetch()} />
            ) : (
              <TimeSlotPicker slots={slots.data} value={start} onChange={setStart} />
            )}
            <div className="sticky bottom-20 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface/95 py-2 md:bottom-2 lg:static">
              <p className="text-sm text-fg-muted" aria-live="polite">
                {start
                  ? t('doctor.selected', { date: formatDate(date, lang, 'weekday'), time: formatTime(start, lang) })
                  : ''}
              </p>
              <Button size="lg" iconRight={ArrowRight} disabled={!start} onClick={proceed}>
                {t('doctor.continue')}
              </Button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
