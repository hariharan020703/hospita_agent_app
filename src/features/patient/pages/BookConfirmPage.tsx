import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarCheck, UserPlus } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  ErrorState,
  Field,
  PageHeader,
  RadioGroup,
  SkeletonCard,
  Textarea,
} from '@/components/ui';
import { useBookAppointment } from '@/hooks/queries/appointments';
import { useTriageSession } from '@/hooks/queries/clinical';
import { useDepartments, useDoctor } from '@/hooks/queries/directory';
import { useLocale } from '@/hooks/useLocale';
import { formatCurrency, formatDate, formatTime } from '@/lib/format';
import { errorCodeOf } from '@/services/errors';
import { usePatientContext } from '../usePatientContext';

export default function BookConfirmPage() {
  const { t } = useTranslation(['patient', 'common']);
  const { lang, l, doctorName } = useLocale();
  const { doctorId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { session, household } = usePatientContext();
  const date = params.get('date');
  const start = params.get('start');
  const triageId = params.get('triage') ?? undefined;
  const doctor = useDoctor(doctorId);
  const departments = useDepartments();
  const triage = useTriageSession(triageId);
  const book = useBookAppointment();
  const [patientId, setPatientId] = useState(session?.patientId ?? '');
  const [reason, setReason] = useState('');

  useEffect(() => {
    const said = triage.data?.messages.find((m) => m.from === 'patient')?.text;
    if (said) setReason((current) => current || said.slice(0, 200));
  }, [triage.data]);

  if (!date || !start || !doctorId)
    return <Navigate to={doctorId ? `/app/doctors/${doctorId}` : '/app/doctors'} replace />;
  if (doctor.isPending) return <SkeletonCard />;
  if (doctor.isError) return <ErrorState error={doctor.error} onRetry={() => void doctor.refetch()} />;
  const d = doctor.data;
  const department = departments.data?.find((x) => x.id === d.departmentId);
  const slotTaken = book.isError && errorCodeOf(book.error) === 'SLOT_TAKEN';

  const confirm = () =>
    book.mutate(
      {
        patientId,
        doctorId: d.id,
        date,
        start,
        source: 'app',
        ...(triageId ? { triageId } : {}),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      },
      { onSuccess: (appointment) => navigate(`/app/appointments/${appointment.id}?booked=1`, { replace: true }) },
    );

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('booking.title')}
        breadcrumbs={[{ label: doctorName(d), to: `/app/doctors/${d.id}` }, { label: t('booking.title') }]}
      />
      {/* Large screens: the form on the left, a sticky appointment summary on the right (first on phones). */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-8">
        <Card className="lg:sticky lg:top-24 lg:order-2">
          <CardBody>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-fg-muted">{t('booking.summary')}</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-1">
              <div>
                <dt className="text-fg-muted">{t('appointment.doctor')}</dt>
                <dd className="font-semibold text-fg">{doctorName(d)}</dd>
                <dd className="text-fg-muted">{l(department?.name)}</dd>
              </div>
              <div>
                <dt className="text-fg-muted">{t('appointment.when')}</dt>
                <dd className="font-semibold text-fg">{formatDate(date, lang, 'long')}</dd>
                <dd className="text-fg">{formatTime(start, lang)}</dd>
              </div>
              <div>
                <dt className="text-fg-muted">{t('appointment.where')}</dt>
                <dd className="text-fg">
                  {department
                    ? t('doctor.locationValue', { room: d.room, wing: l(department.wing), floor: department.floor })
                    : d.room}
                </dd>
              </div>
              <div>
                <dt className="text-fg-muted">{t('booking.fee')}</dt>
                <dd className="font-semibold text-fg">{formatCurrency(d.fee, lang)}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        <div className="space-y-5 lg:order-1">
          <Card>
            <CardBody className="space-y-5">
              {household.data && (
                <RadioGroup
                  legend={t('booking.for')}
                  name="patient"
                  layout="cards"
                  value={patientId}
                  onChange={setPatientId}
                  options={household.data.map((p) => ({
                    value: p.id,
                    label: p.name,
                    description: t(`common:relation.${p.relation}`),
                  }))}
                />
              )}
              <Link
                to="/app/profile?add=1"
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary-ink hover:underline"
              >
                <UserPlus aria-hidden className="h-4 w-4" />
                {t('booking.addMember')}
              </Link>
              <Field label={t('booking.reason')} hint={t('booking.reasonHint')}>
                {(c) => <Textarea {...c} value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />}
              </Field>
            </CardBody>
          </Card>

          {slotTaken && (
            <div
              role="alert"
              className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning-ink"
            >
              {t('common:errors.SLOT_TAKEN')}{' '}
              <Link to={`/app/doctors/${d.id}`} className="font-semibold underline">
                {t('booking.pickAnother')}
              </Link>
            </div>
          )}
          <Button size="lg" block icon={CalendarCheck} onClick={confirm} loading={book.isPending} disabled={!patientId}>
            {t('booking.confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}
