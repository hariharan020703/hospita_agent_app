import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CalendarDays,
  ChevronRight,
  FileStack,
  HeartPulse,
  MessageSquareText,
  Phone,
  Radio,
  Stethoscope,
  Users,
} from 'lucide-react';
import { buttonClasses, Card, EmptyState, ErrorState, SkeletonCard } from '@/components/ui';
import { AppointmentCard } from '@/components/domain/Cards';
import { useNotificationText } from '@/components/domain/useNotificationText';
import { useAgentSettings, useCarePlans } from '@/hooks/queries/agents';
import { useAppointments } from '@/hooks/queries/appointments';
import { useNotifications } from '@/hooks/queries/clinical';
import { useHospital } from '@/hooks/queries/directory';
import { formatRelativeMinutes } from '@/lib/format';
import { now } from '@/lib/clock';
import { useLocale } from '@/hooks/useLocale';
import { usePatientContext } from '../usePatientContext';

export default function HomePage() {
  const { t } = useTranslation('patient');
  const { lang } = useLocale();
  const { session, householdIds, today, userId } = usePatientContext();
  const hospital = useHospital();
  const upcoming = useAppointments(
    { patientIds: householdIds, from: today, statuses: ['booked', 'checked_in', 'in_consultation'] },
    { enabled: householdIds.length > 0 },
  );
  const notifications = useNotifications(userId);
  const notificationText = useNotificationText();
  const agents = useAgentSettings();
  const carePlans = useCarePlans(householdIds, agents.data?.care === true);
  const latestPlan = carePlans.data?.[0];
  const next = upcoming.data?.[0];
  const firstName = session?.name.split(' ')[0];

  const actions = [
    {
      to: '/app/assistant',
      icon: MessageSquareText,
      title: t('home.quick.assistant'),
      hint: t('home.quick.assistantHint'),
    },
    { to: '/app/doctors', icon: Stethoscope, title: t('home.quick.doctors'), hint: t('home.quick.doctorsHint') },
    {
      to: '/app/appointments',
      icon: CalendarDays,
      title: t('home.quick.appointments'),
      hint: t('home.quick.appointmentsHint'),
    },
    { to: '/app/profile', icon: Users, title: t('home.quick.family'), hint: t('home.quick.familyHint') },
    // The medical records agent's upload page is only offered while that agent is switched on.
    ...(agents.data?.records
      ? [{ to: '/app/records', icon: FileStack, title: t('home.quick.records'), hint: t('home.quick.recordsHint') }]
      : []),
    ...(agents.data?.care
      ? [{ to: '/app/care', icon: HeartPulse, title: t('home.quick.care'), hint: t('home.quick.careHint') }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fg">
          {firstName ? t('home.greeting', { name: firstName }) : t('home.greetingNoName')}
        </h1>
        <p className="text-fg-muted">{t('home.subtitle')}</p>
      </div>

      {/* Large screens: main column (appointment, quick actions) and a side column (updates, emergency). */}
      <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
        <div className="space-y-6 lg:col-span-2">
          <section aria-labelledby="next-title" className="space-y-3">
            <h2 id="next-title" className="text-lg font-semibold text-fg">
              {t('home.nextAppointment')}
            </h2>
            {upcoming.isPending && householdIds.length > 0 && <SkeletonCard />}
            {upcoming.isError && <ErrorState error={upcoming.error} onRetry={() => void upcoming.refetch()} />}
            {upcoming.isSuccess && !next && (
              <EmptyState
                icon={CalendarDays}
                title={t('home.noUpcoming')}
                action={
                  <Link to="/app/assistant" className={buttonClasses('primary')}>
                    {t('home.bookNow')}
                  </Link>
                }
              />
            )}
            {next && (
              <AppointmentCard
                appointment={next}
                today={today}
                showPatient={next.patientId !== session?.patientId}
                to={`/app/appointments/${next.id}`}
                footer={
                  next.date === today && (
                    <Link to={`/app/queue/${next.id}`} className={buttonClasses('primary', 'md', true)}>
                      <Radio aria-hidden className="h-4 w-4" />
                      {t('home.trackQueue')}
                    </Link>
                  )
                }
              />
            )}
          </section>

          {latestPlan && (
            <Link
              to={`/app/care/${latestPlan.id}`}
              className="flex items-center gap-4 rounded-xl border-2 border-primary/40 bg-primary-soft/30 p-4 shadow-xs hover:border-primary"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-fg">
                <HeartPulse aria-hidden className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-fg">{t('home.carePlan')}</span>
                <span className="block text-sm text-fg-muted">
                  {t('home.carePlanHint', { count: latestPlan.medicines.length })}
                </span>
              </span>
              <ChevronRight aria-hidden className="h-5 w-5 text-fg-subtle" />
            </Link>
          )}

          <section aria-labelledby="quick-title">
            <h2 id="quick-title" className="sr-only">
              {t('home.quickTitle')}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {actions.map(({ to, icon: Icon, title, hint }) => (
                <li key={to}>
                  <Link
                    to={to}
                    className="flex h-full items-center gap-3 rounded-xl border bg-surface p-4 shadow-xs transition-colors hover:border-primary/50"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-ink">
                      <Icon aria-hidden className="h-6 w-6" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-fg">{title}</span>
                      <span className="block text-sm text-fg-muted">{hint}</span>
                    </span>
                    <ChevronRight aria-hidden className="h-5 w-5 text-fg-subtle" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-6">
          {notifications.data && notifications.data.length > 0 && (
            <section aria-labelledby="updates-title" className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 id="updates-title" className="text-lg font-semibold text-fg">
                  {t('home.latestUpdates')}
                </h2>
                <Link to="/app/notifications" className="text-sm font-semibold text-primary-ink hover:underline">
                  {t('home.seeAll')}
                </Link>
              </div>
              <Card className="divide-y">
                {notifications.data.slice(0, 3).map((n) => (
                  <p key={n.id} className="px-4 py-3 text-sm text-fg">
                    {notificationText(n)}
                    <span className="mt-0.5 block text-xs text-fg-subtle">
                      {formatRelativeMinutes((new Date(n.createdAt).getTime() - now().getTime()) / 60_000, lang)}
                    </span>
                  </p>
                ))}
              </Card>
            </section>
          )}

          <section aria-labelledby="sos-title" className="rounded-xl border border-danger/30 bg-danger-soft p-4">
            <h2 id="sos-title" className="font-semibold text-danger-ink">
              {t('home.emergencyTitle')}
            </h2>
            <p className="mt-1 text-sm text-fg">{t('home.emergencyBody')}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={`tel:${hospital.data?.phones.ambulance ?? '108'}`} className={buttonClasses('danger')}>
                <Phone aria-hidden className="h-4 w-4" />
                {t('home.call108')}
              </a>
              <Link to="/app/emergency" className={buttonClasses('dangerOutline')}>
                {t('home.emergencyInfo')}
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
