// Layout for the patient app's pre-sign-in pages. Phones: the form alone. Large screens: a brand panel with the
// hospital name and what the app does, beside the form.
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarCheck, MessageSquareText, Radio } from 'lucide-react';
import { LogoMark } from '@/components/ui';
import { useHospital } from '@/hooks/queries/directory';
import { useLocale } from '@/hooks/useLocale';

const POINTS = [
  { id: 'describe', icon: MessageSquareText },
  { id: 'book', icon: CalendarCheck },
  { id: 'queue', icon: Radio },
] as const;

export function AuthShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation(['auth', 'common']);
  const { l } = useLocale();
  const hospital = useHospital();
  return (
    <main id="main" className="min-h-dvh bg-canvas lg:grid lg:grid-cols-2">
      <section className="hidden flex-col justify-between gap-10 bg-primary p-12 text-primary-fg lg:flex xl:p-16">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-white p-1.5">
            <LogoMark className="h-9 w-9" />
          </span>
          <span className="text-xl font-bold">MediFlow</span>
        </div>
        <div className="max-w-lg">
          <p className="text-4xl font-bold leading-tight">{t('authShell.title')}</p>
          {hospital.data && <p className="mt-3 text-lg opacity-90">{l(hospital.data.name)}</p>}
          <ul className="mt-10 space-y-5">
            {POINTS.map(({ id, icon: Icon }) => (
              <li key={id} className="flex items-start gap-4 text-lg">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15">
                  <Icon aria-hidden className="h-5 w-5" />
                </span>
                <span className="pt-1.5">{t(`authShell.points.${id}`)}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="max-w-lg text-sm opacity-90">{t('common:disclaimer')}</p>
      </section>
      <div className="grid min-h-dvh place-items-center px-4 py-10 lg:px-12">{children}</div>
    </main>
  );
}
