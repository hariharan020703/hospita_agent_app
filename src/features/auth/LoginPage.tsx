// Entry page (English only): one button per app. Staff buttons sign in with that role's demo account
// (users.json); the patient app uses its own phone + OTP sign-in; the kiosk is public.
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight,
  MonitorSmartphone,
  Smartphone,
  Stethoscope,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Card, ErrorState, Logo, Spinner } from '@/components/ui';
import { useDemoAccounts, useSignInAs } from '@/hooks/queries/auth';
import { useAppLanguage, useTheme } from '@/hooks/useAppearance';
import type { Role } from '@/types';
import { useSession, useSessionStore } from './session';
import { safeNext } from './safeNext';

type DestinationId = 'app' | 'kiosk' | 'desk' | 'doctor' | 'admin';

interface Destination {
  id: DestinationId;
  path: string;
  icon: LucideIcon;
  /** Staff role whose demo account the button signs in with; null for the patient app and kiosk. */
  role: Exclude<Role, 'patient'> | null;
}

const PATIENT_DESTINATIONS: readonly Destination[] = [
  { id: 'app', path: '/app', icon: Smartphone, role: null },
  { id: 'kiosk', path: '/kiosk', icon: MonitorSmartphone, role: null },
];

const STAFF_DESTINATIONS: readonly Destination[] = [
  { id: 'desk', path: '/desk', icon: Users, role: 'desk' },
  { id: 'doctor', path: '/doctor', icon: Stethoscope, role: 'doctor' },
  { id: 'admin', path: '/admin', icon: UserCog, role: 'admin' },
];

export default function LoginPage() {
  const { t } = useTranslation(['auth', 'common']);
  useAppLanguage('en');
  useTheme();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const session = useSession();
  const signOut = useSessionStore((s) => s.signOut);
  const accounts = useDemoAccounts();
  const signIn = useSignInAs();
  const [opening, setOpening] = useState<DestinationId | null>(null);

  const accountFor = (role: Destination['role']) => accounts.data?.find((u) => u.active && u.role === role);

  const open = (destination: Destination) => {
    // A ?next= deep link (from a route guard) is honoured when it belongs to the chosen app.
    const next = safeNext(params.get('next'), destination.path);
    const target = next.startsWith(destination.path) ? next : destination.path;

    if (destination.role === null) {
      // The patient app has its own sign-in; leave any staff session behind before going there.
      if (destination.id === 'app' && session && session.role !== 'patient') signOut();
      navigate(target);
      return;
    }
    if (session?.role === destination.role) {
      navigate(target);
      return;
    }
    const account = accountFor(destination.role);
    if (!account) return;
    setOpening(destination.id);
    signIn.mutate(account.id, {
      onSuccess: () => navigate(target, { replace: true }),
      onSettled: () => setOpening(null),
    });
  };

  const button = (destination: Destination) => {
    const Icon = destination.icon;
    const account = destination.role ? accountFor(destination.role) : undefined;
    const unavailable = destination.role !== null && !account;
    const busy = opening === destination.id;
    return (
      <li key={destination.id}>
        <button
          type="button"
          onClick={() => open(destination)}
          disabled={unavailable || opening !== null}
          aria-busy={busy || undefined}
          className="group flex h-full w-full items-center gap-4 rounded-xl border bg-surface p-4 text-left shadow-xs transition-colors hover:border-primary/60 hover:bg-primary-soft/30 disabled:opacity-60 sm:p-5"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-ink">
            <Icon aria-hidden className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-semibold text-fg">
              {t(`launcher.destinations.${destination.id}.title`)}
            </span>
            <span className="block text-sm text-fg-muted">{t(`launcher.destinations.${destination.id}.body`)}</span>
            {account && (
              <span className="mt-1 block text-xs text-fg-subtle">
                {t('launcher.signsInAs', {
                  name: account.role === 'doctor' ? t('common:doctorName', { name: account.name }) : account.name,
                })}
              </span>
            )}
          </span>
          {busy ? (
            <Spinner className="h-5 w-5" label={t('launcher.opening')} />
          ) : (
            <ChevronRight
              aria-hidden
              className="h-5 w-5 text-fg-subtle transition-transform group-hover:translate-x-0.5"
            />
          )}
        </button>
      </li>
    );
  };

  return (
    <main id="main" className="min-h-dvh bg-canvas">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:py-12">
        <Logo subtitle={t('launcher.product')} />
        <div>
          <h1 className="text-2xl font-bold text-fg">{t('launcher.title')}</h1>
          <p className="mt-1 text-fg-muted">{t('launcher.subtitle')}</p>
        </div>

        <Card className="p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-fg-muted">
            {t('launcher.patientApps')}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">{PATIENT_DESTINATIONS.map(button)}</ul>
        </Card>

        <Card className="p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-fg-muted">
            {t('launcher.staffApps')}
          </h2>
          {accounts.isError ? (
            <ErrorState
              title={t('launcher.accountsError')}
              error={accounts.error}
              onRetry={() => void accounts.refetch()}
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-3">{STAFF_DESTINATIONS.map(button)}</ul>
          )}
        </Card>
      </div>
    </main>
  );
}
