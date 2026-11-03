// Doctor settings: theme, a read-only profile summary, and log out. The staff apps are English only.
import { useTranslation } from 'react-i18next';
import { Award, Clock, DoorOpen, IdCard, Languages, LogOut, Stethoscope, Wallet } from 'lucide-react';
import { Avatar, Button, Card, CardBody, CardHeader, ErrorState, SkeletonCard } from '@/components/ui';
import { ThemeSwitch } from '@/components/domain/Switches';
import { useSignOut } from '@/hooks/queries/auth';
import { useDepartments, useDoctor } from '@/hooks/queries/directory';
import { useLocale } from '@/hooks/useLocale';
import { usePrefs } from '@/hooks/usePrefs';
import { formatCurrency } from '@/lib/format';
import { useDoctorContext } from '../useDoctorContext';

export default function SettingsPage() {
  const { t } = useTranslation(['doctor', 'common']);
  const { lang, l, doctorName } = useLocale();
  const { doctorId } = useDoctorContext();
  const theme = usePrefs((s) => s.theme);
  const setTheme = usePrefs((s) => s.setTheme);
  const signOut = useSignOut('/login');
  const doctor = useDoctor(doctorId);
  const departments = useDepartments();
  const department = departments.data?.find((d) => d.id === doctor.data?.departmentId);

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold tracking-tight text-fg">{t('settings.title')}</h1>

      <Card>
        <CardHeader title={t('settings.appearance')} />
        <CardBody>
          <ThemeSwitch value={theme} onChange={setTheme} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t('settings.profile')} description={t('settings.profileHint')} />
        {doctor.isPending ? (
          <CardBody>
            <SkeletonCard className="border-0 p-0" />
          </CardBody>
        ) : doctor.isError ? (
          <CardBody>
            <ErrorState error={doctor.error} onRetry={() => void doctor.refetch()} />
          </CardBody>
        ) : (
          <>
            <CardBody className="flex items-center gap-4">
              <Avatar name={doctor.data.name} src={doctor.data.photoUrl} size="lg" />
              <div className="min-w-0">
                <p className="text-lg font-semibold text-fg">{doctorName(doctor.data)}</p>
                <p className="text-sm text-fg-muted">{l(department?.name)}</p>
              </div>
            </CardBody>
            <dl className="grid gap-4 border-t p-4 text-sm sm:grid-cols-2 sm:p-5">
              {[
                { icon: Award, label: t('settings.qualifications'), value: doctor.data.qualifications.join(', ') },
                { icon: IdCard, label: t('settings.registration'), value: doctor.data.registrationNo },
                {
                  icon: Languages,
                  label: t('settings.languages'),
                  value: doctor.data.languages.map((code) => t(`common:language.${code}`)).join(', '),
                },
                { icon: Wallet, label: t('common:fee'), value: formatCurrency(doctor.data.fee, lang) },
                {
                  icon: Clock,
                  label: t('settings.consultMins'),
                  value: t('common:minutesShort', { count: doctor.data.consultMins }),
                },
                { icon: DoorOpen, label: t('settings.room'), value: doctor.data.room },
                { icon: Stethoscope, label: t('settings.department'), value: l(department?.name) || '—' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex gap-3">
                  <Icon aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-fg-subtle" />
                  <div className="min-w-0">
                    <dt className="text-fg-muted">{label}</dt>
                    <dd className="break-words font-medium text-fg">{value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </>
        )}
      </Card>

      <Card>
        <CardHeader title={t('settings.account')} />
        <CardBody>
          <Button variant="outline" icon={LogOut} onClick={signOut}>
            {t('common:actions.signOut')}
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
