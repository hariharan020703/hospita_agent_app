// Care companion, patient side: today's medicine checklist, the plan itself (in Tamil or English), and the chat that
// answers only from the plan. Urgent replies show call buttons; an emergency covers the screen.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpenCheck,
  Bot,
  Mic,
  MicOff,
  Phone,
  SendHorizontal,
  Siren,
  Stethoscope,
  TriangleAlert,
  UserRound,
} from 'lucide-react';
import { Badge, Button, Checkbox, Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { useAgentText } from '@/hooks/useAgentText';
import { useLocale } from '@/hooks/useLocale';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { TrailView } from '@/features/assistant/TrailView';
import { errorCodeOf } from '@/services';
import { DOSE_SLOTS, type CareLine, type CareMessage, type CarePlan, type DoseSlot, type Hospital } from '@/types';

const dial = (number: string) => `tel:${number.replace(/\s+/g, '')}`;

/** A line of the doctor's words in the reader's language; lines without an approved Tamil version stay English. */
export function useCareLine() {
  const { lang } = useLocale();
  return (line: CareLine) => ({
    text: lang === 'ta' && line.ta ? line.ta : line.en,
    original: lang === 'ta' && !line.ta,
  });
}

export function MedicineChecklist({
  plan,
  today,
  onToggle,
  busy,
}: {
  plan: CarePlan;
  today: string;
  onToggle: (medicineId: string, slot: DoseSlot, taken: boolean) => void;
  busy: boolean;
}) {
  const { t } = useTranslation('patient');
  const active = plan.medicines.filter((m) => m.startDate <= today && m.endDate >= today);
  const taken = (medicineId: string, slot: DoseSlot) =>
    plan.doses.some((d) => d.medicineId === medicineId && d.slot === slot && d.date === today);
  const total = active.reduce((n, m) => n + m.slots.length, 0);
  const done = active.reduce((n, m) => n + m.slots.filter((s) => taken(m.id, s)).length, 0);
  if (active.length === 0) return <p className="text-sm text-fg-muted">{t('care.checklist.none')}</p>;
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-fg-muted" aria-live="polite">
        {t('care.checklist.progress', { done, total })}
      </p>
      {DOSE_SLOTS.map((slot) => {
        const meds = active.filter((m) => m.slots.includes(slot));
        if (meds.length === 0) return null;
        return (
          <div key={slot} className="space-y-2">
            <h3 className="text-sm font-bold uppercase tracking-wide text-primary-ink">{t(`care.slot.${slot}`)}</h3>
            <ul className="space-y-2">
              {meds.map((m) => (
                <li key={m.id} className="rounded-xl border bg-surface p-3">
                  <Checkbox
                    checked={taken(m.id, slot)}
                    disabled={busy}
                    onChange={(e) => onToggle(m.id, slot, e.target.checked)}
                    label={`${m.name} ${m.dose}`}
                    description={`${t(`care.food.${m.food}`)} · ${
                      taken(m.id, slot) ? t('care.checklist.taken') : t('care.checklist.notYet')
                    }`}
                  />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export function PlanDetails({ plan, doctorName }: { plan: CarePlan; doctorName: string }) {
  const { t } = useTranslation('patient');
  const { lang } = useLocale();
  const lineOf = useCareLine();
  return (
    <div className="space-y-6">
      <section aria-labelledby="plan-medicines" className="space-y-2">
        <h2 id="plan-medicines" className="font-semibold text-fg">
          {t('care.plan.medicines')}
        </h2>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-muted text-fg-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {t('care.plan.medicine')}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {t('care.plan.when')}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {t('care.plan.food')}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {t('care.plan.until')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {plan.medicines.map((m) => (
                <tr key={m.id}>
                  <td className="px-3 py-2 font-medium text-fg">
                    {m.name} {m.dose}
                  </td>
                  <td className="px-3 py-2 text-fg">{m.slots.map((s) => t(`care.slot.${s}`)).join(', ')}</td>
                  <td className="px-3 py-2 text-fg">{t(`care.food.${m.food}`)}</td>
                  <td className="px-3 py-2 text-fg">
                    {t('care.plan.untilValue', { date: formatDate(m.endDate, lang), count: m.days })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {plan.advice.length > 0 && (
        <section aria-labelledby="plan-advice" className="space-y-2">
          <h2 id="plan-advice" className="font-semibold text-fg">
            {t('care.plan.advice', { doctor: doctorName })}
          </h2>
          <ul className="space-y-2">
            {plan.advice.map((line, i) => {
              const { text, original } = lineOf(line);
              return (
                <li key={i} className="rounded-lg bg-surface-muted px-3 py-2 text-fg">
                  <span lang={original ? 'en' : lang}>{text}</span>
                  {original && <span className="ml-2 text-xs text-fg-subtle">({t('care.plan.doctorsWords')})</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {plan.tests.length > 0 && (
        <section aria-labelledby="plan-tests" className="space-y-2">
          <h2 id="plan-tests" className="font-semibold text-fg">
            {t('care.plan.tests')}
          </h2>
          <ul className="list-inside list-disc space-y-1 text-fg">
            {plan.tests.map((line, i) => {
              const { text, original } = lineOf(line);
              return (
                <li key={i} lang={original ? 'en' : lang}>
                  {text}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

/** What "Listen" reads aloud: the whole plan in the reader's language. */
export function usePlanSpeech() {
  const { t } = useTranslation('patient');
  const lineOf = useCareLine();
  const { lang } = useLocale();
  return (plan: CarePlan, doctorName: string) =>
    [
      t('care.speech.intro', { doctor: doctorName }),
      ...DOSE_SLOTS.flatMap((slot) => {
        const meds = plan.medicines.filter((m) => m.slots.includes(slot));
        return meds.length
          ? [
              t('care.speech.slot', {
                slot: t(`care.slot.${slot}`),
                medicines: meds.map((m) => `${m.name} ${m.dose}, ${t(`care.food.${m.food}`)}`).join('; '),
              }),
            ]
          : [];
      }),
      ...(plan.advice.length
        ? [t('care.plan.advice', { doctor: doctorName }), ...plan.advice.map((l) => lineOf(l).text)]
        : []),
      ...(plan.tests.length ? [t('care.plan.tests'), ...plan.tests.map((l) => lineOf(l).text)] : []),
      ...(plan.followUpDate ? [t('care.speech.followUp', { date: formatDate(plan.followUpDate, lang, 'long') })] : []),
    ].join('. ');
}

function SourcesLine({ message, plan }: { message: CareMessage; plan: CarePlan }) {
  const { t } = useTranslation(['patient', 'triage']);
  if (!message.sources?.length) return null;
  const parts = [
    ...new Set(
      message.sources.map((s) =>
        s.kind === 'medicine'
          ? (plan.medicines.find((m) => m.id === s.medicineId)?.name ?? t('triage:carePart.medicine'))
          : s.kind === 'advice'
            ? t('triage:carePart.advice')
            : s.kind === 'test'
              ? t('triage:carePart.test')
              : t('triage:carePart.followUp'),
      ),
    ),
  ];
  return (
    <p className="flex items-center gap-1.5 text-xs text-fg-subtle">
      <BookOpenCheck aria-hidden className="h-3.5 w-3.5" />
      {t('care.chat.usedPlan', { parts: parts.join(' · ') })}
    </p>
  );
}

export function UrgentCard({ hospital, emergency }: { hospital: Hospital | undefined; emergency: boolean }) {
  const { t } = useTranslation('patient');
  return (
    <div className="space-y-3 rounded-2xl bg-danger p-4 text-white">
      <p className="flex items-center gap-2 font-bold">
        <Siren aria-hidden className="h-5 w-5" />
        {emergency ? t('care.urgent.emergencyTitle') : t('care.urgent.title')}
      </p>
      <div className="flex flex-wrap gap-2">
        <a
          href={dial(hospital?.phones.ambulance ?? '108')}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 font-bold text-danger-hover"
        >
          <Phone aria-hidden className="h-4 w-4" />
          {t('care.urgent.call108')}
        </a>
        {hospital && (
          <a
            href={dial(hospital.phones.emergency)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-white/80 px-4 font-semibold"
          >
            <Phone aria-hidden className="h-4 w-4" />
            {t('care.urgent.callHospital')}
          </a>
        )}
      </div>
    </div>
  );
}

export function CareChat({
  plan,
  messages,
  busy,
  error,
  onSend,
  onRetry,
  hospital,
}: {
  plan: CarePlan;
  messages: CareMessage[];
  busy: boolean;
  error: unknown;
  onSend: (text: string) => void;
  onRetry: () => void;
  hospital: Hospital | undefined;
}) {
  const { t } = useTranslation(['patient', 'triage', 'common']);
  const { lang } = useLocale();
  const render = useAgentText();
  const [draft, setDraft] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const speech = useSpeechRecognition(lang, (text) => onSend(text));
  const pendingCheckIn = plan.checkIns.some((c) => !c.reply);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, busy]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim() || busy) return;
    onSend(draft.trim());
    setDraft('');
  };

  const chips = pendingCheckIn
    ? (['better', 'same', 'breathless'] as const).map((k) => t(`care.chat.checkInReplies.${k}`))
    : (['missed', 'food', 'nextVisit'] as const).map((k) => t(`care.chat.suggestions.${k}`));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-label={t('care.chat.title')}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4 scrollbar-thin"
      >
        {messages.map((m) => {
          if (m.from === 'patient') {
            return (
              <div key={m.id} className="flex flex-row-reverse items-end gap-2">
                <span
                  aria-hidden
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-sunken text-fg-muted"
                >
                  <UserRound className="h-4 w-4" />
                </span>
                <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-fg">{m.text}</p>
              </div>
            );
          }
          const doctor = m.from === 'doctor';
          return (
            <div key={m.id} className="flex items-start gap-2">
              <span
                aria-hidden
                className={cn(
                  'grid h-8 w-8 shrink-0 place-items-center rounded-full',
                  doctor ? 'bg-success-soft text-success-ink' : 'bg-primary-soft text-primary-ink',
                )}
              >
                {doctor ? <Stethoscope className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </span>
              <div className="min-w-0 max-w-[88%] flex-1 space-y-2">
                {doctor && <Badge tone="success">{t('care.chat.fromDoctor')}</Badge>}
                {m.kind === 'check_in' && <Badge tone="primary">{t('care.chat.checkIn')}</Badge>}
                <div className="space-y-1.5 rounded-2xl rounded-tl-md border bg-surface px-4 py-2.5 leading-relaxed text-fg">
                  {m.text && <p>{m.text}</p>}
                  {m.say?.map((s, i) => (
                    <p
                      key={i}
                      className={cn(s.key === 'triage:care.quote' && 'border-l-4 border-primary/40 pl-3 italic')}
                    >
                      {render(s)}
                    </p>
                  ))}
                </div>
                {(m.kind === 'urgent' || m.kind === 'emergency') && (
                  <UrgentCard hospital={hospital} emergency={m.kind === 'emergency'} />
                )}
                {(m.kind === 'asked_doctor' || m.kind === 'refused') && (
                  <Badge tone="info" icon={Stethoscope}>
                    {t('care.chat.sentToDoctor')}
                  </Badge>
                )}
                <SourcesLine message={m} plan={plan} />
                {m.trail && <TrailView steps={m.trail} />}
              </div>
            </div>
          );
        })}
        {busy && (
          <p className="flex items-center gap-2 text-sm text-fg-subtle">
            <Spinner />
            {t('triage:chat.typing')}
          </p>
        )}
        {error !== null && !busy && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning-ink"
          >
            <TriangleAlert aria-hidden className="h-4 w-4 shrink-0" />
            <span className="flex-1">{t(`common:errors.${errorCodeOf(error)}`)}</span>
            <Button size="sm" variant="outline" onClick={onRetry}>
              {t('common:actions.retry')}
            </Button>
          </div>
        )}
      </div>
      <div className="space-y-2 border-t pt-3">
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <Button key={c} size="sm" variant="outline" disabled={busy} onClick={() => onSend(c)}>
              {c}
            </Button>
          ))}
        </div>
        {speech.listening ? (
          <div className="flex items-center gap-3 rounded-xl bg-primary-soft p-3 text-primary-ink" role="status">
            <Mic aria-hidden className="h-5 w-5 animate-pulse" />
            <span className="flex-1 font-semibold">{speech.interim || t('triage:chat.listening')}</span>
            <Button variant="outline" size="sm" icon={MicOff} onClick={speech.stop}>
              {t('triage:chat.micStop')}
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex items-center gap-2">
            {speech.supported && (
              <button
                type="button"
                onClick={speech.start}
                disabled={busy}
                aria-label={t('triage:chat.mic')}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-fg hover:bg-primary-hover disabled:opacity-50"
              >
                <Mic aria-hidden className="h-5 w-5" />
              </button>
            )}
            <label htmlFor="care-input" className="sr-only">
              {t('care.chat.placeholder')}
            </label>
            <input
              id="care-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t('care.chat.placeholder')}
              autoComplete="off"
              className="h-11 min-w-0 flex-1 rounded-full border border-border-strong bg-surface px-4 text-fg placeholder:text-fg-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="submit"
              aria-label={t('triage:chat.send')}
              disabled={!draft.trim() || busy}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border-strong bg-surface text-primary-ink hover:bg-primary-soft disabled:opacity-40"
            >
              <SendHorizontal aria-hidden className="h-5 w-5" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
