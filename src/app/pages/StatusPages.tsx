import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Compass, Home, LogIn, ShieldX } from 'lucide-react';
import { buttonClasses, Logo } from '@/components/ui';
import { useTheme } from '@/hooks/useAppearance';
import { useSession, HOME_BY_ROLE } from '@/features/auth/session';

function StatusPage({
  icon: Icon,
  title,
  body,
  signInLink,
}: {
  icon: typeof Compass;
  title: string;
  body: string;
  signInLink?: boolean;
}) {
  const { t } = useTranslation();
  const session = useSession();
  useTheme();
  const home = session ? HOME_BY_ROLE[session.role] : '/login';
  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-canvas p-6">
      <div className="max-w-md space-y-5 text-center">
        <Logo className="justify-center" />
        <Icon aria-hidden className="mx-auto h-12 w-12 text-fg-subtle" />
        <h1 className="text-2xl font-bold text-fg">{title}</h1>
        <p className="text-fg-muted">{body}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link to={home} className={buttonClasses('primary')}>
            <Home aria-hidden className="h-4 w-4" />
            {t('actions.goHome')}
          </Link>
          {signInLink && (
            <Link to="/login" className={buttonClasses('outline')}>
              <LogIn aria-hidden className="h-4 w-4" />
              {t('pages.signInAgain')}
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}

export function NotFoundPage() {
  const { t } = useTranslation();
  return <StatusPage icon={Compass} title={t('pages.notFoundTitle')} body={t('pages.notFoundBody')} />;
}

export function UnauthorizedPage() {
  const { t } = useTranslation();
  return (
    <StatusPage icon={ShieldX} title={t('pages.unauthorizedTitle')} body={t('pages.unauthorizedBody')} signInLink />
  );
}
