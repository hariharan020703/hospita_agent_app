import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Pencil, Settings, ShieldCheck, UserPlus } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  buttonClasses,
  Card,
  CardBody,
  CardHeader,
  Drawer,
  ErrorState,
  IconButton,
  SkeletonCard,
} from '@/components/ui';
import { PatientForm } from '@/components/domain/PatientForm';
import { emptyPatientInput, patientToFormInput } from '@/components/domain/patientFormValues';
import { useAddFamilyMember, useUpdatePatient } from '@/hooks/queries/directory';
import { useLocale } from '@/hooks/useLocale';
import { useSessionStore } from '@/features/auth/session';
import { now } from '@/lib/clock';
import { formatDate, formatPhone } from '@/lib/format';
import { ageFromBirthYear } from '@/lib/time';
import type { Patient } from '@/types';
import { usePatientContext } from '../usePatientContext';

type DrawerState = { mode: 'edit'; patient: Patient } | { mode: 'add' } | null;

export default function ProfilePage() {
  const { t } = useTranslation(['patient', 'common']);
  const { lang } = useLocale();
  const [params, setParams] = useSearchParams();
  const { patient, household, session } = usePatientContext();
  const updateSession = useSessionStore((s) => s.update);
  const [drawer, setDrawer] = useState<DrawerState>(params.get('add') === '1' ? { mode: 'add' } : null);
  const update = useUpdatePatient();
  const addMember = useAddFamilyMember();

  const close = () => {
    setDrawer(null);
    if (params.get('add')) setParams({}, { replace: true });
  };

  if (patient.isPending) return <SkeletonCard />;
  if (patient.isError) return <ErrorState error={patient.error} onRetry={() => void patient.refetch()} />;
  const me = patient.data;
  const members = household.data?.filter((p) => p.id !== me.id) ?? [];
  const age = (p: Patient) => t('profile.ageValue', { count: ageFromBirthYear(p.birthYear, now()) });

  const rows: [string, string][] = [
    [t('profile.age'), age(me)],
    [t('form.gender'), t(`common:gender.${me.gender}`)],
    [t('profile.phone'), formatPhone(me.phone)],
    [t('profile.address'), `${me.address.line1}, ${me.address.area}, ${me.address.city} ${me.address.pincode}`],
    [t('profile.abha'), me.abhaNumber ?? t('profile.abhaNone')],
    [t('profile.conditions'), me.conditions.length ? me.conditions.join(', ') : t('profile.none')],
    [t('profile.language'), t(`common:language.${me.preferredLang}`)],
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-fg">{t('profile.title')}</h1>
        <Link to="/app/settings" className={buttonClasses('outline', 'sm')}>
          <Settings aria-hidden className="h-4 w-4" />
          {t('nav.settings')}
        </Link>
      </div>
      {/* Large screens: my details and family members side by side. */}
      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardHeader
            title={t('profile.me')}
            actions={
              <Button
                variant="outline"
                size="sm"
                icon={Pencil}
                onClick={() => setDrawer({ mode: 'edit', patient: me })}
              >
                {t('profile.edit')}
              </Button>
            }
          />
          <CardBody className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar name={me.name} size="lg" />
              <div>
                <p className="text-lg font-semibold text-fg">{me.name}</p>
                {me.abhaNumber && (
                  <Badge tone="success" icon={ShieldCheck}>
                    ABHA {t('profile.abhaLinked')}
                  </Badge>
                )}
              </div>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {rows.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-fg-muted">{label}</dt>
                  <dd className="font-medium text-fg">{value}</dd>
                </div>
              ))}
            </dl>
            {me.consent && (
              <p className="flex items-center gap-2 rounded-lg bg-surface-muted px-3 py-2 text-sm text-fg-muted">
                <ShieldCheck aria-hidden className="h-4 w-4 shrink-0 text-success-ink" />
                {t('profile.consentGiven', {
                  date: formatDate(me.consent.acceptedAt.slice(0, 10), lang),
                  version: me.consent.version,
                })}
              </p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={t('profile.family')}
            description={t('profile.familyHint')}
            actions={
              <Button size="sm" icon={UserPlus} onClick={() => setDrawer({ mode: 'add' })}>
                {t('profile.addMember')}
              </Button>
            }
          />
          <ul className="divide-y">
            {members.length === 0 && <li className="px-5 py-4 text-sm text-fg-muted">{t('profile.noFamily')}</li>}
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <Avatar name={m.name} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-fg">{m.name}</p>
                  <p className="text-sm text-fg-muted">
                    {t(`common:relation.${m.relation}`)} · {age(m)}
                  </p>
                </div>
                <IconButton
                  icon={Pencil}
                  label={`${t('profile.editMember')}: ${m.name}`}
                  onClick={() => setDrawer({ mode: 'edit', patient: m })}
                />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Drawer
        open={drawer !== null}
        onClose={close}
        width="md"
        title={
          drawer?.mode === 'add'
            ? t('profile.addMember')
            : drawer?.patient.id === me.id
              ? t('profile.edit')
              : t('profile.editMember')
        }
      >
        {drawer?.mode === 'add' && (
          <PatientForm
            defaultValues={emptyPatientInput({
              phone: me.phone,
              address: me.address,
              relation: 'parent',
              preferredLang: me.preferredLang,
            })}
            showRelation
            submitLabel={t('profile.addMember')}
            submitting={addMember.isPending}
            onSubmit={(values) => addMember.mutate({ householdId: me.householdId, values }, { onSuccess: close })}
          />
        )}
        {drawer?.mode === 'edit' && (
          <PatientForm
            defaultValues={patientToFormInput(drawer.patient)}
            showRelation={drawer.patient.relation !== 'self'}
            lockPhone={drawer.patient.id === me.id}
            submitLabel={t('form.save')}
            submitting={update.isPending}
            onSubmit={(values) =>
              update.mutate(
                { id: drawer.patient.id, values },
                {
                  onSuccess: (saved) => {
                    if (saved.id === session?.patientId) updateSession({ name: saved.name });
                    close();
                  },
                },
              )
            }
          />
        )}
      </Drawer>
    </div>
  );
}
