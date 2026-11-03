// One patient's details and their visit history with this doctor.
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { History } from 'lucide-react';
import {
  Avatar,
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  PageHeader,
  SkeletonCard,
  SkeletonList,
  StatusPill,
} from '@/components/ui';
import { useAppointments } from '@/hooks/queries/appointments';
import { usePatient } from '@/hooks/queries/directory';
import { useLocale } from '@/hooks/useLocale';
import { now } from '@/lib/clock';
import { formatDate, formatPhone, formatTime } from '@/lib/format';
import { ageFromBirthYear } from '@/lib/time';
import { useDoctorContext } from '../useDoctorContext';
import { byDateTime } from '../utils';

export default function PatientDetailPage() {
  const { t } = useTranslation(['doctor', 'common']);
  const { lang } = useLocale();
  const { patientId } = useParams();
  const { doctorId } = useDoctorContext();
  const patient = usePatient(patientId);
  const visits = useAppointments({ doctorId, patientIds: [patientId ?? ''] }, { enabled: Boolean(patientId) });
  const history = [...(visits.data ?? [])].sort(byDateTime).reverse();
  const crumbs = [
    { label: t('patients.title'), to: '/doctor/patients' },
    { label: patient.data?.name ?? t('patient.title') },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={patient.data?.name ?? t('patient.title')} breadcrumbs={crumbs} />

      {patient.isPending ? (
        <SkeletonCard />
      ) : patient.isError ? (
        <ErrorState error={patient.error} onRetry={() => void patient.refetch()} />
      ) : (
        <Card>
          <CardHeader title={t('patient.details')} />
          <CardBody className="flex flex-col gap-5 sm:flex-row">
            <Avatar name={patient.data.name} size="lg" />
            <dl className="grid flex-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-fg-muted">{t('patient.age')}</dt>
                <dd className="font-medium text-fg">
                  {t('patient.ageValue', { count: ageFromBirthYear(patient.data.birthYear, now()) })}
                </dd>
              </div>
              <div>
                <dt className="text-fg-muted">{t('patient.gender')}</dt>
                <dd className="font-medium text-fg">{t(`common:gender.${patient.data.gender}`)}</dd>
              </div>
              <div>
                <dt className="text-fg-muted">{t('patient.phone')}</dt>
                <dd className="font-medium text-fg tabular">{formatPhone(patient.data.phone)}</dd>
              </div>
              <div>
                <dt className="text-fg-muted">{t('patient.language')}</dt>
                <dd className="font-medium text-fg" lang={patient.data.preferredLang}>
                  {t(`common:language.${patient.data.preferredLang}`)}
                </dd>
              </div>
              <div>
                <dt className="text-fg-muted">{t('patient.abha')}</dt>
                <dd>
                  <Badge tone={patient.data.abhaNumber ? 'success' : 'neutral'}>
                    {patient.data.abhaNumber ? t('patient.abhaLinked') : t('patient.abhaNotLinked')}
                  </Badge>
                </dd>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-fg-muted">{t('patient.conditions')}</dt>
                <dd className="mt-1">
                  {patient.data.conditions.length > 0 ? (
                    <span className="flex flex-wrap gap-1.5">
                      {patient.data.conditions.map((condition) => (
                        <Badge key={condition} tone="neutral" size="md">
                          {condition}
                        </Badge>
                      ))}
                    </span>
                  ) : (
                    <span className="text-fg">{t('patient.noConditions')}</span>
                  )}
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title={t('patient.history')} description={t('patient.historyDescription')} />
        {visits.isPending ? (
          <CardBody>
            <SkeletonList rows={3} rowClassName="h-16" />
          </CardBody>
        ) : visits.isError ? (
          <CardBody>
            <ErrorState error={visits.error} onRetry={() => void visits.refetch()} />
          </CardBody>
        ) : history.length === 0 ? (
          <CardBody>
            <EmptyState icon={History} title={t('patient.noHistory')} className="border-0" />
          </CardBody>
        ) : (
          <ol className="divide-y">
            {history.map((a) => (
              <li key={a.id} className="space-y-2 px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-fg">
                    {formatDate(a.date, lang, 'medium')}, <span className="tabular">{formatTime(a.start, lang)}</span>
                    <span className="ml-2 font-mono text-sm font-medium text-fg-muted">{a.token}</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {a.followUpOf && <Badge tone="info">{t('patient.followUp')}</Badge>}
                    <StatusPill status={a.status} />
                  </div>
                </div>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-fg-muted">{t('patient.reason')}</dt>
                    <dd className="text-fg">{a.reason || t('patient.notRecorded')}</dd>
                  </div>
                  <div>
                    <dt className="text-fg-muted">{t('patient.note')}</dt>
                    <dd className="whitespace-pre-line text-fg">{a.note || t('patient.notRecorded')}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
