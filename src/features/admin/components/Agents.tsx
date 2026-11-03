// Admin -> Agents building blocks: the agent icon, the pause/resume switch (with what pausing changes), the workflow
// diagram, the confidence spread and the activity feed from the frontend activity log.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, FileStack, HeartPulse, Mic, Stethoscope, Workflow, type LucideIcon } from 'lucide-react';
import {
  Badge,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  SkeletonList,
  Switch,
  toast,
  type BadgeTone,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatTime } from '@/lib/format';
import { useAgentActivity, useSetAgentActive } from '@/hooks/queries/agents';
import { useAgentText } from '@/hooks/useAgentText';
import { TrailView } from '@/features/assistant/TrailView';
import type { AgentActivity, AgentId, AgentOverview, HumanDecision } from '@/types';

const AGENT_ICONS: Record<AgentId, LucideIcon> = {
  orchestrator: Workflow,
  triage: Stethoscope,
  records: FileStack,
  scribe: Mic,
  care: HeartPulse,
};

const DECISION_TONE: Record<HumanDecision, BadgeTone> = {
  accepted: 'success',
  edited: 'info',
  dismissed: 'warning',
  pending: 'primary',
  none: 'neutral',
};

const clock = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export function AgentIcon({ id, className }: { id: AgentId; className?: string }) {
  const Icon = AGENT_ICONS[id];
  return (
    <span
      className={cn(
        'grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-ink',
        className,
      )}
    >
      <Icon aria-hidden className="h-6 w-6" />
    </span>
  );
}

/** Pausing asks first and says what changes for patients and staff; switching back on is immediate. */
export function AgentToggle({ agent }: { agent: AgentOverview }) {
  const { t } = useTranslation('admin');
  const setActive = useSetAgentActive();
  const [confirming, setConfirming] = useState(false);
  const id = agent.definition.id;
  const name = t(`agents.names.${id}`);
  const apply = (active: boolean) =>
    setActive.mutate(
      { id, active },
      {
        onSuccess: () => {
          setConfirming(false);
          toast.success(active ? t('agents.resumed', { name }) : t('agents.pausedToast', { name }));
        },
      },
    );
  return (
    <>
      <Switch
        checked={agent.active}
        disabled={setActive.isPending}
        onChange={(on) => (on ? apply(true) : setConfirming(true))}
        label={agent.active ? t('agents.status.active') : t('agents.status.paused')}
      />
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => apply(false)}
        tone="danger"
        loading={setActive.isPending}
        title={t('agents.pauseTitle', { name })}
        body={t(`agents.pauseBody.${id}`)}
        confirmLabel={t('agents.pauseConfirm')}
      />
    </>
  );
}

export function WorkflowDiagram({ agent }: { agent: AgentOverview }) {
  const { t } = useTranslation('admin');
  const name = t(`agents.names.${agent.definition.id}`);
  return (
    <ol className="flex flex-wrap items-stretch gap-2" aria-label={t('agents.workflow.title')}>
      {agent.definition.workflow.map((stepId, i) => {
        const key = stepId as 'input';
        const highlight = stepId === 'agent' || stepId === 'route';
        return (
          <li key={stepId} className="flex items-center gap-2">
            {i > 0 && <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-fg-subtle" />}
            <div
              className={cn(
                'min-w-[8.5rem] max-w-[11rem] rounded-xl border px-3 py-2',
                highlight ? 'border-primary/50 bg-primary-soft/40' : 'bg-surface',
                stepId === 'human' && 'border-success/50 bg-success-soft/40',
              )}
            >
              <p className="text-sm font-semibold text-fg">
                {stepId === 'agent' ? name : t(`agents.workflow.steps.${key}`)}
              </p>
              <p className="text-xs text-fg-muted">{t(`agents.workflow.details.${key}`)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function ConfidenceBars({ buckets }: { buckets: readonly number[] }) {
  const { t } = useTranslation('admin');
  const max = Math.max(1, ...buckets);
  const total = buckets.reduce((sum, n) => sum + n, 0);
  if (total === 0) return <p className="text-sm text-fg-muted">{t('agents.confidence.empty')}</p>;
  return (
    <ul className="space-y-2">
      {buckets.map((count, i) => {
        const from = 40 + i * 10;
        const to = i === buckets.length - 1 ? 100 : from + 9;
        return (
          <li key={from} className="flex items-center gap-3 text-sm">
            <span className="w-20 shrink-0 text-fg-muted tabular">{t('agents.confidence.bucket', { from, to })}</span>
            <span aria-hidden className="h-3 flex-1 overflow-hidden rounded-full bg-surface-sunken">
              <span
                className={cn('block h-full rounded-full', from < 70 ? 'bg-warning' : 'bg-primary')}
                style={{ width: `${(count / max) * 100}%` }}
              />
            </span>
            <span className="w-24 shrink-0 text-right text-fg tabular">{t('agents.confidence.count', { count })}</span>
          </li>
        );
      })}
    </ul>
  );
}

function ActivityRow({ activity, showAgent }: { activity: AgentActivity; showAgent: boolean }) {
  const { t } = useTranslation('admin');
  const render = useAgentText();
  return (
    <li className="space-y-1.5 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-mono text-fg-muted tabular">{formatTime(clock(activity.at), 'en')}</span>
        {showAgent && <Badge tone="primary">{t(`agents.names.${activity.agentId}`)}</Badge>}
        <span className="text-fg-muted">{t(`agents.actor.${activity.actor}`)}</span>
        {activity.confidence !== undefined && (
          <Badge tone={activity.confidence < 70 ? 'warning' : 'neutral'}>
            {t('agents.activity.confidence', { value: activity.confidence })}
          </Badge>
        )}
        {activity.decision !== 'none' && (
          <Badge tone={DECISION_TONE[activity.decision]}>{t(`agents.decisions.${activity.decision}`)}</Badge>
        )}
      </div>
      <p className="text-fg">{render(activity.summary)}</p>
      {activity.steps.length > 0 && <TrailView steps={activity.steps} />}
    </li>
  );
}

export function ActivityFeed({ agentId, limit = 30 }: { agentId?: AgentId; limit?: number }) {
  const { t } = useTranslation('admin');
  const activity = useAgentActivity({ ...(agentId ? { agentId } : {}), limit });
  if (activity.isPending) return <SkeletonList rows={5} />;
  if (activity.isError) return <ErrorState error={activity.error} onRetry={() => void activity.refetch()} />;
  if (activity.data.length === 0) return <EmptyState icon={Workflow} title={t('agents.activity.empty')} />;
  return (
    <ul className="divide-y" aria-live="polite">
      {activity.data.map((a) => (
        <ActivityRow key={a.id} activity={a} showAgent={!agentId} />
      ))}
    </ul>
  );
}
