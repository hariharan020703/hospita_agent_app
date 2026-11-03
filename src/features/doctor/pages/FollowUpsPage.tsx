// Patient follow-ups (care companion, doctor side): urgent warning-sign alerts from check-ins, questions the
// companion could not answer from the prescription, and check-in updates. The doctor replies or acknowledges.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCheck, HeartPulse, MessageCircleQuestion, SendHorizontal, Siren } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  SkeletonList,
  Tabs,
  Textarea,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { now } from '@/lib/clock';
import { formatRelativeMinutes } from '@/lib/format';
import {
  useAcknowledgeQuery,
  useAgentActive,
  useCarePlan,
  useDoctorFollowUps,
  useReplyQuery,
} from '@/hooks/queries/agents';
import { usePatient } from '@/hooks/queries/directory';
import { useAgentText } from '@/hooks/useAgentText';
import type { DoctorQuery } from '@/types';
import { useDoctorContext } from '../useDoctorContext';

function QueryCard({ query, userId }: { query: DoctorQuery; userId: string }) {
  const { t } = useTranslation('doctor');
  const render = useAgentText();
  const patient = usePatient(query.patientId);
  const plan = useCarePlan(query.planId);
  const reply = useReplyQuery();
  const acknowledge = useAcknowledgeQuery();
  const [text, setText] = useState('');
  const open = query.status === 'open';
  const minutes = (new Date(query.createdAt).getTime() - now().getTime()) / 60_000;

  return (
    <Card className={cn(open && query.urgent && 'border-2 border-danger/50')}>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {query.kind === 'alert' ? (
              <Badge tone={query.urgent ? 'danger' : 'warning'} icon={query.urgent ? Siren : HeartPulse} size="md">
                {query.urgent ? t('followUps.urgentAlert') : t('followUps.update')}
              </Badge>
            ) : (
              <Badge tone="info" icon={MessageCircleQuestion} size="md">
                {t('followUps.question')}
              </Badge>
            )}
            <Link
              to={`/doctor/patients/${query.patientId}`}
              className="font-semibold text-fg hover:text-primary-ink hover:underline"
            >
              {patient.data?.name ?? '…'}
            </Link>
          </div>
          <span className="text-sm text-fg-muted">{formatRelativeMinutes(minutes, 'en')}</span>
        </div>

        <div>
          <p className="text-sm text-fg-muted">{t('followUps.patientSaid')}</p>
          <blockquote lang={patient.data?.preferredLang} className="mt-1 border-l-4 border-primary/40 pl-3 text-fg">
            {query.text}
          </blockquote>
        </div>
        <p className="text-sm text-fg">
          <span className="font-semibold">{t('followUps.why')} </span>
          {render(query.reason)}
        </p>
        {plan.data && (
          <p className="text-sm text-fg-muted">
            {t('followUps.onPlan', {
              medicines: plan.data.medicines.map((m) => `${m.name} ${m.dose}`).join(', ') || '—',
            })}
          </p>
        )}

        {query.reply && (
          <div className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success-ink">
            <span className="font-semibold">{t('followUps.yourReply')} </span>
            {query.reply}
          </div>
        )}
        {query.status === 'acknowledged' && !query.reply && (
          <p className="text-sm text-success-ink">{t('followUps.acknowledgedNote')}</p>
        )}

        {open && (
          <div className="space-y-2 border-t pt-3">
            <Field label={t('followUps.replyLabel')} hint={t('followUps.replyHint')}>
              {(c) => (
                <Textarea {...c} rows={2} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} />
              )}
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button
                icon={SendHorizontal}
                disabled={!text.trim()}
                loading={reply.isPending}
                onClick={() => reply.mutate({ id: query.id, text, userId }, { onSuccess: () => setText('') })}
              >
                {t('followUps.send')}
              </Button>
              {query.kind === 'alert' && (
                <Button
                  variant="outline"
                  icon={CheckCheck}
                  loading={acknowledge.isPending}
                  onClick={() => acknowledge.mutate(query.id)}
                >
                  {t('followUps.acknowledge')}
                </Button>
              )}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export default function FollowUpsPage() {
  const { t } = useTranslation('doctor');
  const { doctorId, session } = useDoctorContext();
  const active = useAgentActive('care');
  const queries = useDoctorFollowUps(active ? doctorId : undefined);
  const [tab, setTab] = useState<'open' | 'done'>('open');
  const openList = queries.data?.filter((q) => q.status === 'open') ?? [];
  const doneList = queries.data?.filter((q) => q.status !== 'open') ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title={t('followUps.title')} description={t('followUps.subtitle')} />
      {active === false ? (
        <EmptyState icon={HeartPulse} title={t('followUps.paused')} body={t('followUps.pausedBody')} />
      ) : queries.isPending ? (
        <SkeletonList rows={3} rowClassName="h-32" />
      ) : queries.isError ? (
        <ErrorState error={queries.error} onRetry={() => void queries.refetch()} />
      ) : (
        <Tabs
          label={t('followUps.title')}
          tabs={[
            { id: 'open', label: t('followUps.tabs.open'), count: openList.length },
            { id: 'done', label: t('followUps.tabs.done'), count: doneList.length },
          ]}
          value={tab}
          onChange={setTab}
        >
          {(current) => {
            const list = current === 'open' ? openList : doneList;
            if (list.length === 0) {
              return (
                <EmptyState
                  icon={HeartPulse}
                  title={current === 'open' ? t('followUps.emptyOpen') : t('followUps.emptyDone')}
                  body={current === 'open' ? t('followUps.emptyOpenBody') : undefined}
                />
              );
            }
            return (
              <ul className="space-y-4">
                {list.map((q) => (
                  <li key={q.id}>
                    <QueryCard query={q} userId={session?.userId ?? ''} />
                  </li>
                ))}
              </ul>
            );
          }}
        </Tabs>
      )}
    </div>
  );
}

/** Today page banner: urgent alerts waiting, one tap from the follow-ups list. */
export function UrgentFollowUps({ doctorId }: { doctorId: string }) {
  const { t } = useTranslation('doctor');
  const active = useAgentActive('care');
  const queries = useDoctorFollowUps(active ? doctorId : undefined);
  const urgent = queries.data?.filter((q) => q.status === 'open' && q.urgent).length ?? 0;
  if (!urgent) return null;
  return (
    <Link
      to="/doctor/follow-ups"
      role="alert"
      className="flex items-center gap-3 rounded-xl bg-danger px-4 py-3 font-semibold text-white hover:bg-danger-hover"
    >
      <Siren aria-hidden className="h-5 w-5 shrink-0" />
      {t('followUps.banner', { count: urgent })}
    </Link>
  );
}
