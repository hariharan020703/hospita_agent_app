// Walk-in without an appointment: symptom intake (the orchestrator and triage agent) -> department -> patient
// details -> token slip. Red flags go straight to the emergency screen (never a token); unclear cases go to the help
// desk. With the assistant paused, the patient picks a department on screen instead.
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HandHelping, ListChecks, MapPin, MessageSquareText, Ticket, TriangleAlert, UserRoundPen } from 'lucide-react';
import { Button, SkeletonCard } from '@/components/ui';
import { useAgentSettings } from '@/hooks/queries/agents';
import { useCreateEscalation, useTriageRules } from '@/hooks/queries/clinical';
import { useDepartments, useRegisterWalkIn } from '@/hooks/queries/directory';
import { useIssueWalkIn } from '@/hooks/queries/appointments';
import { useLocale } from '@/hooks/useLocale';
import { AssistantThread } from '@/features/assistant/AssistantThread';
import { DepartmentPicker } from '@/features/assistant/DepartmentPicker';
import { useAssistant } from '@/features/assistant/useAssistant';
import { Disclaimer } from '@/features/triage/components';
import { EmergencyScreen, EscalatedNotice } from '@/features/triage/EmergencyScreen';
import { errorCodeOf } from '@/services';
import type { AppointmentView, ChatCommand, Hospital, PatientFormValues } from '@/types';
import { DetailsWizard, type WalkInDetails } from './DetailsWizard';
import { EmergencyDoneButton } from './EmergencyDoneButton';
import { TokenSlip } from './TokenSlip';
import { BackButton, Notice, ScreenTitle } from './ui';

type Step =
  | { kind: 'intake' }
  | { kind: 'details' }
  | { kind: 'slip'; appointment: AppointmentView }
  | { kind: 'noSlots'; departmentId: string };

function HowItWorks() {
  const { t } = useTranslation('kiosk');
  const items = [
    { icon: MessageSquareText, text: t('walkIn.how.speak') },
    { icon: ListChecks, text: t('walkIn.how.questions') },
    { icon: UserRoundPen, text: t('walkIn.how.details') },
    { icon: Ticket, text: t('walkIn.how.token') },
  ];
  return (
    <section aria-labelledby="kiosk-how-title" className="space-y-4 rounded-3xl border bg-surface p-6 shadow-sm">
      <h2 id="kiosk-how-title" className="text-lg font-bold text-fg">
        {t('walkIn.how.title')}
      </h2>
      <ol className="space-y-4">
        {items.map(({ icon: Icon, text }, i) => (
          <li key={text} className="flex items-start gap-4 text-base text-fg">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-ink">
              <Icon aria-hidden className="h-6 w-6" />
              <span className="sr-only">{i + 1}.</span>
            </span>
            <span className="pt-2">{text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function NoSlotsScreen({ departmentName, onDone }: { departmentName: string; onDone: () => void }) {
  const { t } = useTranslation(['kiosk', 'common']);
  return (
    <section
      aria-labelledby="kiosk-noslots-title"
      className="mx-auto max-w-4xl space-y-4 rounded-3xl border-2 border-warning/40 bg-surface p-5 text-center shadow-sm"
    >
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-warning-soft text-warning-ink">
        <HandHelping aria-hidden className="h-9 w-9" />
      </span>
      <ScreenTitle id="kiosk-noslots-title">{t('noSlots.title', { department: departmentName })}</ScreenTitle>
      <p className="text-balance text-lg text-fg">{t('noSlots.body')}</p>
      <Notice icon={MapPin} className="text-left">
        <p>{t('noSlots.where')}</p>
      </Notice>
      <Button size="lg" onClick={onDone} className="min-w-48">
        {t('common:actions.done')}
      </Button>
    </section>
  );
}

export function WalkInFlow({
  hospital,
  onHome,
  onReset,
}: {
  hospital: Hospital | undefined;
  onHome: () => void;
  onReset: () => void;
}) {
  const { t } = useTranslation(['kiosk', 'common']);
  const { lang, l } = useLocale();
  const settings = useAgentSettings();
  const rules = useTriageRules();
  const departments = useDepartments();
  const register = useRegisterWalkIn();
  const issue = useIssueWalkIn();
  const escalate = useCreateEscalation();
  const [step, setStep] = useState<Step>({ kind: 'intake' });
  const [issueError, setIssueError] = useState<unknown>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);

  // "Get a token" on the triage result is handled here; the orchestrator never books at the kiosk.
  const onCommand = useCallback((command: ChatCommand) => {
    if (command.type !== 'book') return false;
    setStep({ kind: 'details' });
    return true;
  }, []);
  const assistant = useAssistant({ channel: 'kiosk', lang, onCommand });
  const assistantOn = settings.data ? settings.data.orchestrator && settings.data.triage : false;
  const status = assistant.status;

  const recommendedId = pickedId ?? (assistantOn && status.outcome === 'recommended' ? status.departmentId : null);
  const department = recommendedId ? departments.data?.find((d) => d.id === recommendedId) : undefined;
  const reason = assistantOn && !pickedId ? (status.reason ?? undefined) : undefined;

  const pick = (departmentId: string) => {
    setPickedId(departmentId);
    setStep({ kind: 'details' });
  };

  const submit = (details: WalkInDetails) => {
    if (!hospital || !recommendedId) return;
    const triageId = assistantOn && !pickedId ? (status.triageId ?? undefined) : undefined;
    const values: PatientFormValues = {
      name: details.name,
      age: details.age,
      gender: details.gender,
      phone: details.phone,
      address: {
        line1: t('details.addressLine'),
        area: hospital.address.area,
        city: hospital.address.city,
        pincode: hospital.address.pincode,
      },
      abhaNumber: undefined,
      preferredLang: lang,
      relation: 'self',
      conditions: '',
    };
    setIssueError(null);
    register.mutate(
      { values },
      {
        onSuccess: (patient) =>
          issue.mutate(
            {
              patientId: patient.id,
              departmentId: recommendedId,
              source: 'kiosk',
              ...(triageId ? { triageId } : {}),
              ...(reason ? { reason } : {}),
            },
            {
              onSuccess: (appointment) => setStep({ kind: 'slip', appointment }),
              onError: (error) => {
                if (errorCodeOf(error) !== 'NO_SLOTS') {
                  setIssueError(error);
                  return;
                }
                // Hand the patient over to the front desk, with what they told us.
                const departmentEn = departments.data?.find((d) => d.id === recommendedId)?.name.en ?? recommendedId;
                escalate.mutate({
                  reason: 'unclear_routing',
                  channel: 'kiosk',
                  phone: values.phone,
                  patientId: patient.id,
                  ...(triageId ? { triageId } : {}),
                  summary: t('noSlots.summary', {
                    lng: 'en',
                    department: departmentEn,
                    name: values.name,
                    said: reason ?? '—',
                  }).slice(0, 500),
                });
                setStep({ kind: 'noSlots', departmentId: recommendedId });
              },
            },
          ),
      },
    );
  };

  if (step.kind === 'slip') {
    return (
      <TokenSlip
        appointment={step.appointment}
        department={departments.data?.find((d) => d.id === step.appointment.departmentId)}
        hospital={hospital}
        onDone={onReset}
      />
    );
  }

  if (step.kind === 'noSlots') {
    const name = l(departments.data?.find((d) => d.id === step.departmentId)?.name) || step.departmentId;
    return <NoSlotsScreen departmentName={name} onDone={onReset} />;
  }

  if (step.kind === 'details') {
    return (
      <DetailsWizard
        department={department}
        initialAge={status.age ?? undefined}
        busy={register.isPending || issue.isPending}
        error={
          issueError ? (
            <Notice tone="warning" role="alert" icon={TriangleAlert}>
              <p className="font-semibold">{t('details.failed')}</p>
              <p>{t(`common:errors.${errorCodeOf(issueError)}`)}</p>
            </Notice>
          ) : null
        }
        onBack={() => {
          setPickedId(null);
          setStep({ kind: 'intake' });
        }}
        onSubmit={submit}
      />
    );
  }

  if (settings.isPending) return <SkeletonCard />;

  if (!assistantOn) {
    return (
      <section aria-labelledby="kiosk-walkin-title" className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <ScreenTitle id="kiosk-walkin-title">{t('walkIn.pickTitle')}</ScreenTitle>
            <p className="text-base text-fg-muted">{t('walkIn.pickHint')}</p>
          </div>
          <BackButton onClick={onHome} />
        </div>
        <DepartmentPicker size="lg" onPick={pick} />
      </section>
    );
  }

  return (
    <section aria-labelledby="kiosk-walkin-title" className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <ScreenTitle id="kiosk-walkin-title">{t('walkIn.title')}</ScreenTitle>
          <p className="text-base text-fg-muted">{t('walkIn.hint')}</p>
        </div>
        <BackButton onClick={onHome} />
      </div>
      <Disclaimer size="lg" />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="flex h-[min(60dvh,46rem)] min-h-[24rem] flex-col rounded-3xl border bg-surface px-5 pb-5 shadow-sm">
          <AssistantThread
            assistant={assistant}
            lang={lang}
            size="lg"
            hospitalPhone={hospital?.phones.main}
            onPickDepartment={pick}
          />
        </div>
        <div className="space-y-4">
          {department ? (
            <section className="space-y-3 rounded-3xl border-2 border-primary/40 bg-surface p-5 shadow-sm">
              <p className="text-lg font-semibold text-fg">
                {t('walkIn.readyForToken', { department: l(department.name) })}
              </p>
              <Button size="lg" block icon={Ticket} onClick={() => setStep({ kind: 'details' })}>
                {t('walkIn.getToken')}
              </Button>
            </section>
          ) : status.outcome === 'escalated' ? (
            <>
              <EscalatedNotice reason="asked_for_human" size="lg" />
              <Notice icon={MapPin} role="status">
                <p className="font-semibold">{t('escalated.visitHelpDesk')}</p>
              </Notice>
              <Button size="lg" block onClick={onReset}>
                {t('common:actions.done')}
              </Button>
            </>
          ) : (
            <HowItWorks />
          )}
        </div>
      </div>

      {status.outcome === 'emergency' && (
        <EmergencyScreen
          hospital={hospital}
          redFlag={rules.data?.redFlags.find((f) => f.id === status.redFlagId)}
          redFlagId={status.redFlagId}
          lang={lang}
          size="lg"
          footer={<EmergencyDoneButton onClick={onReset} />}
        />
      )}
    </section>
  );
}
