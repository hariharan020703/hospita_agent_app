import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Logo } from '@/components/ui';
import { usePrefs } from '@/hooks/usePrefs';
import { safeNext } from '@/features/auth/safeNext';
import type { Lang } from '@/types';
import { AuthShell } from '../components/AuthShell';

export default function WelcomePage() {
  const { t } = useTranslation(['auth', 'common']);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const setPatientLang = usePrefs((s) => s.setPatientLang);

  const choose = (lang: Lang) => {
    setPatientLang(lang);
    navigate(safeNext(params.get('next'), '/app'), { replace: true });
  };

  const option = (lang: Lang, label: string, hint: string) => (
    <button
      type="button"
      lang={lang}
      onClick={() => choose(lang)}
      className="flex min-h-20 w-full items-center justify-between gap-4 rounded-2xl border-2 bg-surface px-6 text-left transition-colors hover:border-primary hover:bg-primary-soft/40"
    >
      <span>
        <span className="block text-2xl font-bold text-fg">{label}</span>
        <span className="block text-sm text-fg-muted">{hint}</span>
      </span>
      <ArrowRight aria-hidden className="h-6 w-6 text-primary-ink" />
    </button>
  );

  return (
    <AuthShell>
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Logo />
          <Link
            to="/login"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary-ink hover:underline"
          >
            <ArrowLeft aria-hidden className="h-4 w-4" />
            {t('patientLogin.backHome')}
          </Link>
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-fg">
            <span lang="ta">வணக்கம்</span> · <span lang="en">Welcome</span>
          </h1>
          <p className="text-fg-muted">{t('welcome.subtitle')}</p>
        </div>
        <div className="space-y-3" role="group" aria-label={t('common:language.label')}>
          {option('ta', 'தமிழ்', 'Tamil')}
          {option('en', 'English', 'ஆங்கிலம்')}
        </div>
      </div>
    </AuthShell>
  );
}
