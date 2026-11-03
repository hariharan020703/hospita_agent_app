// Sign-up: patient details, then DPDP-style consent. Nothing is saved until consent is given.
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogOut, ShieldCheck } from 'lucide-react';
import { Button, Card, Checkbox, Logo, Stepper } from '@/components/ui';
import { PatientForm } from '@/components/domain/PatientForm';
import { emptyPatientInput } from '@/components/domain/patientFormValues';
import { useSignOut } from '@/hooks/queries/auth';
import { useRegisterAccountHolder } from '@/hooks/queries/directory';
import { useLocale } from '@/hooks/useLocale';
import { useSession, useSessionStore } from '@/features/auth/session';
import type { PatientFormValues } from '@/types';

export default function RegisterPage() {
  const { t } = useTranslation('patient');
  const { lang } = useLocale();
  const session = useSession();
  const updateSession = useSessionStore((s) => s.update);
  const navigate = useNavigate();
  const [values, setValues] = useState<PatientFormValues | null>(null);
  const [agree, setAgree] = useState(false);
  const [notify, setNotify] = useState(true);
  const [consentError, setConsentError] = useState<string | undefined>();
  const register = useRegisterAccountHolder();
  const signOut = useSignOut('/login');

  if (!session) return null;
  if (session.patientId) return <Navigate to="/app" replace />;

  const submit = () => {
    if (!values) return;
    if (!agree) {
      setConsentError('consent');
      return;
    }
    register.mutate(
      { userId: session.userId, input: { values, consent: { notifications: notify } } },
      {
        onSuccess: (patient) => {
          updateSession({ patientId: patient.id, name: patient.name });
          navigate('/app', { replace: true });
        },
      },
    );
  };

  return (
    <main id="main" className="min-h-dvh bg-canvas px-4 py-8">
      <div className="mx-auto max-w-xl space-y-6 lg:max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Logo />
          <Button variant="outline" size="sm" icon={LogOut} onClick={signOut}>
            {t('nav.logout')}
          </Button>
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-fg">{t('register.title')}</h1>
          <p className="text-fg-muted">{t('register.subtitle')}</p>
        </div>
        <Stepper
          label={t('register.title')}
          steps={[t('register.steps.details'), t('register.steps.consent')]}
          current={values ? 1 : 0}
        />
        <Card className="p-5 sm:p-6">
          {!values ? (
            <PatientForm
              defaultValues={emptyPatientInput({ phone: session.phone ?? '', preferredLang: lang })}
              lockPhone
              onSubmit={setValues}
              submitLabel={t('register.next')}
            />
          ) : (
            <section aria-labelledby="consent-title" className="space-y-5">
              <div className="flex items-start gap-3">
                <ShieldCheck aria-hidden className="mt-1 h-6 w-6 shrink-0 text-primary-ink" />
                <div>
                  <h2 id="consent-title" className="text-xl font-bold text-fg">
                    {t('consent.title')}
                  </h2>
                  <p className="text-fg-muted">{t('consent.intro')}</p>
                </div>
              </div>
              <ul className="list-disc space-y-2 pl-5 text-sm text-fg">
                <li>{t('consent.points.collect')}</li>
                <li>{t('consent.points.purpose')}</li>
                <li>{t('consent.points.share')}</li>
                <li>{t('consent.points.retention')}</li>
                <li>{t('consent.points.rights')}</li>
              </ul>
              <p className="text-sm text-fg-muted">{t('consent.law')}</p>
              <div className="space-y-3 rounded-xl bg-surface-muted p-4">
                <Checkbox
                  label={t('consent.dataProcessing')}
                  checked={agree}
                  onChange={(e) => {
                    setAgree(e.target.checked);
                    setConsentError(undefined);
                  }}
                  error={consentError}
                />
                <Checkbox
                  label={t('consent.notifications')}
                  checked={notify}
                  onChange={(e) => setNotify(e.target.checked)}
                />
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <Button variant="outline" onClick={() => setValues(null)}>
                  {t('consent.back')}
                </Button>
                <Button size="lg" onClick={submit} loading={register.isPending}>
                  {t('consent.agree')}
                </Button>
              </div>
            </section>
          )}
        </Card>
      </div>
    </main>
  );
}
