import { useTranslation } from 'react-i18next';
import { LogOut } from 'lucide-react';
import { Button, Card, CardBody, CardHeader, Field, Select, Switch } from '@/components/ui';
import { LanguageSwitch, ThemeSwitch } from '@/components/domain/Switches';
import { useSignOut } from '@/hooks/queries/auth';
import { useHospital } from '@/hooks/queries/directory';
import { useLocale } from '@/hooks/useLocale';
import { usePrefs } from '@/hooks/usePrefs';
import { formatPhone } from '@/lib/format';
import { usePatientContext } from '../usePatientContext';

const TRAVEL = [10, 15, 20, 30, 45, 60, 90];

export default function SettingsPage() {
  const { t } = useTranslation('patient');
  const { lang } = useLocale();
  const { session } = usePatientContext();
  const hospital = useHospital();
  const prefs = usePrefs();
  const signOut = useSignOut('/login');
  const defaultTravel = hospital.data?.travel.defaultMins ?? 30;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-fg">{t('settings.title')}</h1>
      {/* Large screens: settings cards in two columns. */}
      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardHeader title={t('settings.language')} />
          <CardBody>
            <LanguageSwitch value={lang} onChange={prefs.setPatientLang} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t('settings.appearance')} />
          <CardBody>
            <ThemeSwitch value={prefs.theme} onChange={prefs.setTheme} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t('settings.travel')} description={t('settings.travelHint')} />
          <CardBody>
            <Field label={t('settings.travel')} labelClassName="sr-only">
              {(c) => (
                <Select
                  {...c}
                  value={prefs.travelMins === null ? '' : String(prefs.travelMins)}
                  onChange={(e) => prefs.setTravelMins(e.target.value ? Number(e.target.value) : null)}
                  placeholder={t('settings.travelDefault', { count: defaultTravel })}
                  options={TRAVEL.map((m) => ({ value: String(m), label: t('queue.travelValue', { count: m }) }))}
                />
              )}
            </Field>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t('settings.notifications')} />
          <CardBody className="space-y-4">
            {(['bookingUpdates', 'queueAlerts', 'reminders', 'sms', 'whatsapp'] as const).map((key) => (
              <Switch
                key={key}
                label={t(`settings.${key}`)}
                checked={prefs.notifications[key]}
                onChange={(v) => prefs.setNotifications({ [key]: v })}
              />
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t('settings.account')} />
          <CardBody className="space-y-3">
            {session?.phone && (
              <p className="text-sm text-fg-muted">{t('settings.signedInAs', { phone: formatPhone(session.phone) })}</p>
            )}
            <Button variant="outline" icon={LogOut} onClick={signOut}>
              {t('settings.signOut')}
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
