// The patient's assistant: one conversation with the orchestrator, which routes to the triage agent or calls tools
// (doctors, slots, booking, queue status). When the orchestrator or the triage agent is paused, the normal flow
// takes over: the patient picks a department and books from the doctors list.
import { useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, Stethoscope } from 'lucide-react';
import { Card, CardBody, CardHeader, SkeletonCard } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useAgentSettings, useDecideActivity } from '@/hooks/queries/agents';
import { useHospital } from '@/hooks/queries/directory';
import { useTriageRules } from '@/hooks/queries/clinical';
import { useLocale } from '@/hooks/useLocale';
import { AssistantThread } from '@/features/assistant/AssistantThread';
import { DepartmentPicker } from '@/features/assistant/DepartmentPicker';
import { useAssistant } from '@/features/assistant/useAssistant';
import { Disclaimer, StartOverButton } from '@/features/triage/components';
import { EmergencyScreen } from '@/features/triage/EmergencyScreen';
import type { ChatCommand, ChatMessage } from '@/types';
import { usePatientContext } from '../usePatientContext';

function HowItWorks() {
  const { t } = useTranslation('triage');
  return (
    <section aria-labelledby="how-title" className="hidden rounded-xl border bg-surface p-5 shadow-xs lg:block">
      <h2 id="how-title" className="font-semibold text-fg">
        {t('howItWorks.title')}
      </h2>
      <ol className="mt-3 space-y-3">
        {(['describe', 'answer', 'book'] as const).map((step, index) => (
          <li key={step} className="flex gap-3 text-sm text-fg">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary-ink">
              {index + 1}
            </span>
            <span className="pt-1">{t(`howItWorks.steps.${step}`)}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-sm text-fg-muted">{t('howItWorks.alsoAsk')}</p>
    </section>
  );
}

/** Normal flow without the assistant: choose a department, then a doctor. */
function ChooseDepartment() {
  const { t } = useTranslation('triage');
  const navigate = useNavigate();
  return (
    <Card>
      <CardHeader title={t('picker.title')} description={t('picker.body')} />
      <CardBody>
        <DepartmentPicker onPick={(id) => navigate(`/app/doctors?dept=${id}`)} />
      </CardBody>
    </Card>
  );
}

function Conversation() {
  const { t } = useTranslation(['triage', 'common']);
  const { lang } = useLocale();
  const navigate = useNavigate();
  const { session } = usePatientContext();
  const hospital = useHospital();
  const rules = useTriageRules();
  const decide = useDecideActivity();

  const onCommand = useCallback(
    (command: ChatCommand, message: ChatMessage) => {
      if (command.type !== 'open') return false;
      // Choosing a doctor from the list keeps the suggested department: the patient accepted the suggestion.
      if (message.card?.kind === 'triage_result' && message.card.result.activityId) {
        decide.mutate({ id: message.card.result.activityId, decision: 'accepted' });
      }
      navigate(command.to);
      return true;
    },
    [decide, navigate],
  );

  const assistant = useAssistant({
    channel: 'app',
    lang,
    patientId: session?.patientId,
    userId: session?.userId,
    onCommand,
  });
  const ongoing = assistant.status.outcome === 'ongoing';

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-fg">{t('title')}</h1>
          <p className="text-fg-muted">{t('subtitle')}</p>
        </div>
        {assistant.messages.length > 1 && <StartOverButton onClick={assistant.restart} />}
      </div>
      <Disclaimer />
      {/* Large screens: the conversation on the left, guidance on the right. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div
          className={cn(
            'flex flex-col rounded-xl border bg-surface px-4 pb-4 shadow-xs',
            ongoing
              ? 'h-[min(66dvh,44rem)] lg:h-[calc(100dvh-15rem)]'
              : 'h-[min(72dvh,48rem)] lg:h-[calc(100dvh-15rem)]',
          )}
        >
          <AssistantThread
            assistant={assistant}
            lang={lang}
            hospitalPhone={hospital.data?.phones.main}
            onPickDepartment={(id) => navigate(`/app/doctors?dept=${id}`)}
          />
        </div>
        <aside className="space-y-4 lg:sticky lg:top-24">
          <HowItWorks />
          <Link
            to="/app/doctors"
            className="hidden items-center gap-2 rounded-xl border bg-surface p-4 text-sm font-semibold text-primary-ink shadow-xs hover:bg-primary-soft/40 lg:flex"
          >
            <Stethoscope aria-hidden className="h-4 w-4" />
            {t('picker.browse')}
          </Link>
        </aside>
      </div>

      {assistant.status.outcome === 'emergency' && (
        <EmergencyScreen
          hospital={hospital.data}
          redFlag={rules.data?.redFlags.find((f) => f.id === assistant.status.redFlagId)}
          redFlagId={assistant.status.redFlagId}
          lang={lang}
          footer={
            <Link
              to="/app"
              className="inline-flex min-h-12 items-center gap-2 rounded-xl px-4 font-semibold text-white underline-offset-4 hover:underline"
            >
              <Home aria-hidden className="h-5 w-5" />
              {t('common:actions.goHome')}
            </Link>
          }
        />
      )}
    </div>
  );
}

export default function AssistantPage() {
  const { t } = useTranslation('triage');
  const settings = useAgentSettings();
  if (settings.isPending) return <SkeletonCard />;
  // Paused agents (or settings that fail to load) fall back to the normal flow.
  const assistantOn = settings.data ? settings.data.orchestrator && settings.data.triage : false;
  if (!assistantOn) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-fg">{t('picker.pageTitle')}</h1>
          <p className="text-fg-muted">{t('picker.pageSubtitle')}</p>
        </div>
        <ChooseDepartment />
      </div>
    );
  }
  return <Conversation />;
}
