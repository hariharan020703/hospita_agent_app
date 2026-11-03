// Patient sign-in with mobile number + one-time code.
import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageSquareText, Smartphone } from 'lucide-react';
import { Button, Card, Field, FieldError, Input, Logo } from '@/components/ui';
import { env } from '@/config/env';
import { formatPhone } from '@/lib/format';
import { useRequestOtp, useVerifyOtp } from '@/hooks/queries/auth';
import { useLocale } from '@/hooks/useLocale';
import { usePrefs } from '@/hooks/usePrefs';
import { useSession } from '@/features/auth/session';
import { safeNext } from '@/features/auth/safeNext';
import { errorCodeOf } from '@/services/errors';
import { phoneSchema } from '@/types';
import { AuthShell } from '../components/AuthShell';

export default function PatientLoginPage() {
  const { t } = useTranslation(['auth', 'common']);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const session = useSession();
  const [phone, setPhone] = useState(params.get('phone') ?? '');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [codeError, setCodeError] = useState<string | undefined>();
  const requestOtp = useRequestOtp();
  const verifyOtp = useVerifyOtp();
  const setPatientLang = usePrefs((s) => s.setPatientLang);
  const { lang } = useLocale();
  const next = safeNext(params.get('next'), '/app');

  if (session?.role === 'patient') return <Navigate to={next} replace />;

  const sendCode = () => {
    const digits = phone.replace(/\D/g, '');
    if (!phoneSchema.safeParse(digits).success) {
      setPhoneError('phone');
      return;
    }
    setPhoneError(undefined);
    setPhone(digits);
    requestOtp.mutate(digits, { onSuccess: () => setStep('code') });
  };

  const verify = () => {
    if (!/^\d{6}$/.test(code)) {
      setCodeError(t('patientLogin.codeInvalid'));
      return;
    }
    setCodeError(undefined);
    verifyOtp.mutate(
      { phone, code },
      {
        onSuccess: (s) => navigate(s.patientId ? next : '/app/register', { replace: true }),
        onError: (error) => setCodeError(t(`common:errors.${errorCodeOf(error)}`)),
      },
    );
  };

  return (
    <AuthShell>
      <div className="w-full max-w-md space-y-6">
        <Logo />
        <Card className="space-y-5 p-5 sm:p-6">
          {step === 'phone' ? (
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                sendCode();
              }}
              className="space-y-5"
            >
              <div className="space-y-1">
                <h1 className="text-2xl font-bold text-fg">{t('patientLogin.title')}</h1>
                <p className="text-fg-muted">{t('patientLogin.subtitle')}</p>
              </div>
              <Field label={t('patientLogin.phone')} error={phoneError} required>
                {(c) => (
                  <div className="flex items-center gap-2">
                    <span className="flex min-h-11 items-center rounded-lg border border-border-strong bg-surface-sunken px-3 font-medium text-fg-muted">
                      +91
                    </span>
                    <Input
                      {...c}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      inputMode="tel"
                      autoComplete="tel-national"
                      maxLength={11}
                    />
                  </div>
                )}
              </Field>
              <Button type="submit" size="lg" block icon={Smartphone} loading={requestOtp.isPending}>
                {t('patientLogin.sendCode')}
              </Button>
            </form>
          ) : (
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                verify();
              }}
              className="space-y-5"
            >
              <div className="space-y-1">
                <h1 className="text-2xl font-bold text-fg">{t('patientLogin.codeTitle')}</h1>
                <p className="text-fg-muted">{t('patientLogin.codeSent', { phone: formatPhone(phone) })}</p>
              </div>
              <Field label={t('patientLogin.code')} required>
                {(c) => (
                  <Input
                    {...c}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="max-w-[12rem] text-center text-2xl tracking-[0.5em]"
                    aria-invalid={codeError ? true : undefined}
                  />
                )}
              </Field>
              {codeError && <FieldError>{codeError}</FieldError>}
              {env.dataSource === 'mock' && (
                <p className="text-sm text-fg-subtle">{t('patientLogin.sampleCode', { code: '123456' })}</p>
              )}
              <Button type="submit" size="lg" block icon={MessageSquareText} loading={verifyOtp.isPending}>
                {t('patientLogin.verify')}
              </Button>
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <button
                  type="button"
                  className="font-semibold text-primary-ink hover:underline"
                  onClick={() => setStep('phone')}
                >
                  {t('patientLogin.changeNumber')}
                </button>
                <button
                  type="button"
                  className="font-semibold text-primary-ink hover:underline"
                  onClick={() => requestOtp.mutate(phone)}
                  disabled={requestOtp.isPending}
                >
                  {t('patientLogin.resend')}
                </button>
              </div>
            </form>
          )}
        </Card>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <button
            type="button"
            lang={lang === 'ta' ? 'en' : 'ta'}
            className="min-h-11 font-semibold text-primary-ink hover:underline"
            onClick={() => setPatientLang(lang === 'ta' ? 'en' : 'ta')}
          >
            {lang === 'ta' ? 'English' : 'தமிழ்'}
          </button>
          <Link to="/login" className="text-fg-muted hover:text-fg hover:underline">
            {t('patientLogin.backHome')}
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
