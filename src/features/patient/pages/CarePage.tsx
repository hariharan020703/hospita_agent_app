// Care companion pages: the list of care plans (/app/care) and one plan with its checklist, Listen button,
// check-ins and chat (/app/care/:planId). A plan exists only after the doctor signs the prescription.
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarClock, ChevronRight, HeartPulse, Pill, Square, Stethoscope, Volume2 } from 'lucide-react';
import {
  buttonClasses,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  SkeletonCard,
  SkeletonList,
  toast,
} from '@/components/ui';
import {
  useAgentActive,
  useAskCare,
  useCareMessages,
  useCarePlan,
  useCarePlans,
  useMarkDose,
  useSimulateCheckIn,
} from '@/hooks/queries/agents';
import { useDoctor, useHospital } from '@/hooks/queries/directory';
import { useTriageRules } from '@/hooks/queries/clinical';
import { useLocale } from '@/hooks/useLocale';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';
import { formatDate } from '@/lib/format';
import { newId } from '@/lib/id';
import { EmergencyScreen } from '@/features/triage/EmergencyScreen';
import type { CareMessage, CarePlan } from '@/types';
import { CareChat, MedicineChecklist, PlanDetails, usePlanSpeech } from '../components/care';
import { usePatientContext } from '../usePatientContext';

function Paused() {
  const { t } = useTranslation('patient');
  return <EmptyState icon={HeartPulse} title={t('care.paused')} body={t('care.pausedBody')} />;
}

function PlanCard({ plan }: { plan: CarePlan }) {
  const { t } = useTranslation('patient');
  const { lang, doctorName } = useLocale();
  const doctor = useDoctor(plan.doctorId);
  return (
    <li>
      <Link
        to={`/app/care/${plan.id}`}
        className="flex items-center gap-3 rounded-xl border bg-surface p-4 shadow-xs hover:border-primary/50"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-ink">
          <HeartPulse aria-hidden className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-fg">{doctor.data ? doctorName(doctor.data) : t('care.title')}</span>
          <span className="block text-sm text-fg-muted">
            {[
              formatDate(plan.createdAt.slice(0, 10), lang),
              t('care.medicines', { count: plan.medicines.length }),
              plan.followUpDate ? t('care.followUpOn', { date: formatDate(plan.followUpDate, lang) }) : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
        <ChevronRight aria-hidden className="h-5 w-5 text-fg-subtle" />
      </Link>
    </li>
  );
}

export function CarePlansPage() {
  const { t } = useTranslation('patient');
  const active = useAgentActive('care');
  const { householdIds } = usePatientContext();
  const plans = useCarePlans(householdIds, active === true);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fg">{t('care.title')}</h1>
        <p className="text-fg-muted">{t('care.subtitle')}</p>
      </div>
      {active === false ? (
        <Paused />
      ) : active === undefined || plans.isPending ? (
        <SkeletonList rows={2} />
      ) : plans.isError ? (
        <ErrorState error={plans.error} onRetry={() => void plans.refetch()} />
      ) : plans.data.length === 0 ? (
        <EmptyState icon={HeartPulse} title={t('care.empty')} body={t('care.emptyBody')} />
      ) : (
        <ul className="space-y-3">
          {plans.data.map((p) => (
            <PlanCard key={p.id} plan={p} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PlanView({ plan }: { plan: CarePlan }) {
  const { t } = useTranslation(['patient', 'common']);
  const { lang, doctorName } = useLocale();
  const { today } = usePatientContext();
  const doctor = useDoctor(plan.doctorId);
  const hospital = useHospital();
  const rules = useTriageRules();
  const messages = useCareMessages(plan.id);
  const ask = useAskCare();
  const markDose = useMarkDose();
  const checkIn = useSimulateCheckIn();
  const speech = useSpeechSynthesis();
  const planSpeech = usePlanSpeech();
  const [sending, setSending] = useState<CareMessage | null>(null);
  const [emergency, setEmergency] = useState<string | null>(null);
  const name = doctor.data ? doctorName(doctor.data) : '';
  const doctorPlain = doctor.data?.name ?? '';

  const send = (text: string) => {
    setSending({
      id: newId('tmp'),
      planId: plan.id,
      from: 'patient',
      kind: 'question',
      text,
      at: new Date().toISOString(),
    });
    ask.mutate(
      { planId: plan.id, text },
      {
        onSuccess: (replies) => {
          const urgent = replies.find((r) => r.kind === 'emergency');
          if (urgent?.redFlagId) setEmergency(urgent.redFlagId);
        },
        onSettled: () => setSending(null),
      },
    );
  };

  const thread = [...(messages.data ?? []), ...(sending ? [sending] : [])];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-fg">{t('care.planTitle')}</h1>
          <p className="text-fg-muted">
            {t('care.fromDoctor', { doctor: name, date: formatDate(plan.createdAt.slice(0, 10), lang) })}
          </p>
        </div>
        {speech.supported && (
          <Button
            variant={speech.speaking ? 'secondary' : 'outline'}
            icon={speech.speaking ? Square : Volume2}
            onClick={() => (speech.speaking ? speech.stop() : speech.speak(planSpeech(plan, doctorPlain), lang))}
          >
            {speech.speaking ? t('care.stopListening') : t('care.listen')}
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start">
        <div className="space-y-6">
          <Card>
            <CardHeader title={t('care.checklist.title')} description={formatDate(today, lang, 'long')} />
            <CardBody>
              <MedicineChecklist
                plan={plan}
                today={today}
                busy={markDose.isPending}
                onToggle={(medicineId, slot, taken) =>
                  markDose.mutate(
                    { planId: plan.id, dose: { medicineId, slot, date: today }, taken },
                    {
                      onSuccess: () => toast.success(taken ? t('care.checklist.marked') : t('care.checklist.unmarked')),
                    },
                  )
                }
              />
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <PlanDetails plan={plan} doctorName={name} />
            </CardBody>
          </Card>

          <Card>
            <CardBody className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CalendarClock aria-hidden className="h-6 w-6 text-primary" />
                <div>
                  <p className="font-semibold text-fg">{t('care.plan.followUp')}</p>
                  <p className="text-fg-muted">
                    {plan.followUpDate ? formatDate(plan.followUpDate, lang, 'long') : t('care.plan.noFollowUp')}
                  </p>
                </div>
              </div>
              <Link to={`/app/doctors/${plan.doctorId}`} className={buttonClasses('outline')}>
                <Stethoscope aria-hidden className="h-4 w-4" />
                {t('care.plan.book')}
              </Link>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t('care.checkIn.title')} description={t('care.checkIn.body')} />
            <CardBody className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-fg-muted">
                {plan.checkIns.length === 0
                  ? t('care.checkIn.none')
                  : t('care.checkIn.count', { count: plan.checkIns.length })}
              </p>
              <Button
                variant="outline"
                loading={checkIn.isPending}
                onClick={() => checkIn.mutate({ planId: plan.id, day: 3 })}
              >
                {t('care.checkIn.simulate', { day: 3 })}
              </Button>
            </CardBody>
          </Card>
        </div>

        <aside className="flex h-[min(78dvh,46rem)] flex-col rounded-xl border bg-surface px-4 pb-4 shadow-xs lg:sticky lg:top-24">
          <div className="space-y-1 border-b py-3">
            <h2 className="flex items-center gap-2 font-semibold text-fg">
              <Pill aria-hidden className="h-4 w-4 text-primary" />
              {t('care.chat.title')}
            </h2>
            <p className="text-xs text-fg-muted">{t('care.chat.scope', { doctor: name })}</p>
          </div>
          {messages.isPending ? (
            <SkeletonList rows={3} />
          ) : messages.isError ? (
            <ErrorState error={messages.error} onRetry={() => void messages.refetch()} />
          ) : (
            <CareChat
              plan={plan}
              messages={thread}
              busy={ask.isPending}
              error={ask.error}
              hospital={hospital.data}
              onSend={send}
              onRetry={() => {
                const last = ask.variables;
                if (last) send(last.text);
              }}
            />
          )}
        </aside>
      </div>

      {emergency && (
        <EmergencyScreen
          hospital={hospital.data}
          redFlag={rules.data?.redFlags.find((f) => f.id === emergency)}
          redFlagId={emergency}
          lang={lang}
          footer={
            <button
              type="button"
              onClick={() => setEmergency(null)}
              className="inline-flex min-h-12 items-center gap-2 rounded-xl px-4 font-semibold text-white underline-offset-4 hover:underline"
            >
              {t('care.backToPlan')}
            </button>
          }
        />
      )}
    </div>
  );
}

export default function CarePage() {
  const { planId } = useParams();
  const active = useAgentActive('care');
  const plan = useCarePlan(active ? planId : undefined);
  if (!planId) return <CarePlansPage />;
  if (active === false) return <Paused />;
  if (active === undefined || plan.isPending) return <SkeletonCard />;
  if (plan.isError) return <ErrorState error={plan.error} onRetry={() => void plan.refetch()} />;
  return <PlanView plan={plan.data} />;
}
