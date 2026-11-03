// Patients: searchable directory; a row opens a drawer with details and the patient's appointments.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarX2, CircleSlash, SearchX, ShieldCheck } from 'lucide-react';
import {
  Avatar,
  Badge,
  DataTable,
  Drawer,
  EmptyState,
  Field,
  PageHeader,
  QueryBoundary,
  SearchInput,
  Select,
  SkeletonList,
  StatusPill,
  type Column,
} from '@/components/ui';
import { useAppointments } from '@/hooks/queries/appointments';
import { usePatients } from '@/hooks/queries/directory';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useLocale } from '@/hooks/useLocale';
import { now } from '@/lib/clock';
import { formatDate, formatPhone, formatTime } from '@/lib/format';
import { ageFromBirthYear } from '@/lib/time';
import type { Patient } from '@/types';
import { useLookups } from '../hooks';
import { byDateTime } from '../lib';

type AbhaFilter = 'all' | 'linked' | 'none';

function PatientDrawer({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const { t } = useTranslation(['admin', 'common']);
  const { lang, doctorName } = useLocale();
  const { departmentName } = useLookups();
  const appointments = useAppointments({ patientIds: [patient.id] });
  const age = ageFromBirthYear(patient.birthYear, now());

  const details: [string, string][] = [
    [t('patients.fields.age'), t('patients.ageValue', { count: age })],
    [t('patients.fields.gender'), t(`common:gender.${patient.gender}`)],
    [t('patients.fields.phone'), formatPhone(patient.phone)],
    [
      t('patients.fields.address'),
      `${patient.address.line1}, ${patient.address.area}, ${patient.address.city} ${patient.address.pincode}`,
    ],
    [t('patients.fields.abha'), patient.abhaNumber ?? t('patients.abhaNone')],
    [t('patients.fields.language'), t(`common:language.${patient.preferredLang}`)],
    [t('patients.fields.relation'), t(`common:relation.${patient.relation}`)],
    [t('patients.fields.conditions'), patient.conditions.length ? patient.conditions.join(', ') : t('patients.none')],
    [
      t('patients.fields.consent'),
      patient.consent
        ? t('patients.consentValue', {
            date: formatDate(patient.consent.acceptedAt.slice(0, 10), lang, 'medium'),
            version: patient.consent.version,
          })
        : t('patients.consentNone'),
    ],
    [t('patients.fields.registered'), formatDate(patient.createdAt.slice(0, 10), lang, 'medium')],
  ];

  return (
    <Drawer open onClose={onClose} title={patient.name} description={t('patients.drawerHint')}>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Avatar name={patient.name} size="lg" />
          <div className="space-y-1">
            <p className="text-lg font-semibold text-fg">{patient.name}</p>
            {patient.abhaNumber ? (
              <Badge tone="success" icon={ShieldCheck}>
                {t('patients.abhaLinked')}
              </Badge>
            ) : (
              <Badge icon={CircleSlash}>{t('patients.abhaNotLinked')}</Badge>
            )}
          </div>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {details.map(([label, value]) => (
            <div key={label}>
              <dt className="text-fg-muted">{label}</dt>
              <dd className="font-medium text-fg">{value}</dd>
            </div>
          ))}
        </dl>

        <section aria-labelledby="patient-appointments" className="space-y-3">
          <h3 id="patient-appointments" className="text-base font-semibold text-fg">
            {t('patients.appointments')}
          </h3>
          <QueryBoundary
            query={appointments}
            loading={<SkeletonList rows={3} rowClassName="h-14" />}
            empty={<EmptyState icon={CalendarX2} title={t('patients.noAppointments')} />}
          >
            {(list) => (
              <ul className="divide-y rounded-xl border">
                {[...list]
                  .sort((a, b) => byDateTime(b, a))
                  .map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-fg">
                          {formatDate(a.date, lang, 'medium')} · {formatTime(a.start, lang)}
                        </p>
                        <p className="text-sm text-fg-muted">
                          {doctorName(a)} · {departmentName(a.departmentId)} ·{' '}
                          {t('patients.tokenValue', { token: a.token })}
                        </p>
                      </div>
                      <StatusPill status={a.status} />
                    </li>
                  ))}
              </ul>
            )}
          </QueryBoundary>
        </section>
      </div>
    </Drawer>
  );
}

export default function PatientsPage() {
  const { t } = useTranslation(['admin', 'common']);
  const { lang } = useLocale();
  const [q, setQ] = useState('');
  const [abha, setAbha] = useState<AbhaFilter>('all');
  const [selected, setSelected] = useState<Patient | null>(null);
  const debouncedQ = useDebouncedValue(q.trim(), 300);
  const patients = usePatients(debouncedQ);
  const [today] = useState(now);

  const rows = (patients.data ?? []).filter((p) => abha === 'all' || (abha === 'linked') === Boolean(p.abhaNumber));

  const columns: Column<Patient>[] = [
    {
      id: 'name',
      header: t('patients.columns.name'),
      sortValue: (p) => p.name,
      cell: (p) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSelected(p);
          }}
          className="flex items-center gap-3 rounded text-left font-medium text-fg hover:underline"
        >
          <Avatar name={p.name} size="sm" />
          <span>{p.name}</span>
        </button>
      ),
    },
    {
      id: 'age',
      header: t('patients.columns.age'),
      align: 'right',
      sortValue: (p) => ageFromBirthYear(p.birthYear, today),
      cell: (p) => <span className="tabular">{ageFromBirthYear(p.birthYear, today)}</span>,
    },
    {
      id: 'gender',
      header: t('patients.columns.gender'),
      hideBelow: 'md',
      sortValue: (p) => p.gender,
      cell: (p) => t(`common:gender.${p.gender}`),
    },
    {
      id: 'phone',
      header: t('patients.columns.phone'),
      cell: (p) => <span className="whitespace-nowrap tabular">{formatPhone(p.phone)}</span>,
    },
    {
      id: 'area',
      header: t('patients.columns.area'),
      hideBelow: 'lg',
      sortValue: (p) => p.address.area,
      cell: (p) => p.address.area,
    },
    {
      id: 'abha',
      header: t('patients.columns.abha'),
      sortValue: (p) => (p.abhaNumber ? 0 : 1),
      cell: (p) =>
        p.abhaNumber ? (
          <Badge tone="success" icon={ShieldCheck}>
            {t('patients.yes')}
          </Badge>
        ) : (
          <Badge>{t('patients.no')}</Badge>
        ),
    },
    {
      id: 'consent',
      header: t('patients.columns.consent'),
      hideBelow: 'xl',
      sortValue: (p) => p.consent?.acceptedAt ?? '',
      cell: (p) =>
        p.consent ? (
          formatDate(p.consent.acceptedAt.slice(0, 10), lang, 'medium')
        ) : (
          <span className="text-fg-subtle">{t('patients.consentNone')}</span>
        ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title={t('patients.title')} description={t('patients.description')} />
      <div className="grid gap-3 rounded-xl border bg-surface p-4 md:grid-cols-[1fr_14rem] md:items-end">
        <SearchInput value={q} onChange={setQ} label={t('patients.search')} placeholder={t('patients.searchHint')} />
        <Field label={t('patients.abhaFilter')}>
          {(c) => (
            <Select
              {...c}
              value={abha}
              onChange={(e) => setAbha(e.target.value as AbhaFilter)}
              options={[
                { value: 'all', label: t('patients.abhaAll') },
                { value: 'linked', label: t('patients.abhaLinked') },
                { value: 'none', label: t('patients.abhaNotLinked') },
              ]}
            />
          )}
        </Field>
      </div>
      <p className="text-sm text-fg-muted" aria-live="polite">
        {patients.isPending ? '' : t('patients.count', { count: rows.length })}
      </p>
      <DataTable
        caption={t('patients.title')}
        columns={columns}
        rows={rows}
        getRowId={(p) => p.id}
        initialSort={{ id: 'name', dir: 'asc' }}
        pageSize={15}
        loading={patients.isPending}
        error={patients.error}
        onRetry={() => void patients.refetch()}
        onRowClick={setSelected}
        empty={<EmptyState icon={SearchX} title={t('patients.empty')} className="border-0" />}
      />
      {selected && <PatientDrawer key={selected.id} patient={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
