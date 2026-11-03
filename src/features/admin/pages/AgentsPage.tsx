// Admin -> Agents: the orchestrator and the four agents, each with what it does, where it runs, the human check,
// an on/off switch and today's numbers; plus the live activity feed. /admin/agents/:agentId shows one agent.
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ShieldCheck, Workflow } from 'lucide-react';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  PageHeader,
  Select,
  SkeletonCard,
  SkeletonList,
} from '@/components/ui';
import { formatTime } from '@/lib/format';
import { useAgentActivity, useAgentOverview } from '@/hooks/queries/agents';
import { AGENT_IDS, type AgentId, type AgentOverview, type HumanDecision } from '@/types';
import { ActivityFeed, AgentIcon, AgentToggle, ConfidenceBars, WorkflowDiagram } from '../components/Agents';

const clock = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

function Metrics({ agent }: { agent: AgentOverview }) {
  const { t } = useTranslation('admin');
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {agent.metrics.map((m) => (
        <div key={m.id} className="rounded-lg bg-surface-muted px-3 py-2">
          <dt className="text-xs text-fg-muted">{t(`agents.metrics.${m.id as 'conversations'}`)}</dt>
          <dd className="text-xl font-bold text-fg tabular">{m.value}</dd>
        </div>
      ))}
      <div className="rounded-lg bg-surface-muted px-3 py-2">
        <dt className="text-xs text-fg-muted">{t('agents.avgConfidence')}</dt>
        <dd className="text-xl font-bold text-fg tabular">
          {agent.averageConfidence !== null ? `${agent.averageConfidence}%` : t('agents.noData')}
        </dd>
      </div>
      <div className="rounded-lg bg-surface-muted px-3 py-2">
        <dt className="text-xs text-fg-muted">{t('agents.overrideRate')}</dt>
        <dd className="text-xl font-bold text-fg tabular">
          {agent.overrideRate !== null ? `${agent.overrideRate}%` : t('agents.noData')}
        </dd>
      </div>
    </dl>
  );
}

function AgentCard({ agent }: { agent: AgentOverview }) {
  const { t } = useTranslation('admin');
  const id = agent.definition.id;
  return (
    <Card className="flex flex-col">
      <CardBody className="flex flex-1 flex-col gap-4">
        <div className="flex items-start gap-3">
          <AgentIcon id={id} />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-fg">{t(`agents.names.${id}`)}</h2>
            <p className="text-sm text-fg-muted">
              {t('agents.runsIn')}: {agent.definition.surfaces.map((s) => t(`agents.surfaces.${s}`)).join(', ')}
            </p>
          </div>
          <Badge tone={agent.active ? 'success' : 'warning'}>
            {agent.active ? t('agents.status.active') : t('agents.status.paused')}
          </Badge>
        </div>
        <p className="text-sm text-fg">{t(`agents.defs.${id}.purpose`)}</p>
        <p className="flex items-start gap-2 rounded-lg bg-success-soft/50 px-3 py-2 text-sm text-fg">
          <ShieldCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <span>
            <span className="font-semibold">{t('agents.humanCheck')}: </span>
            {t(`agents.defs.${id}.humanCheck`)}
          </span>
        </p>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">{t('agents.today')}</h3>
          <Metrics agent={agent} />
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <AgentToggle agent={agent} />
          <Link
            to={`/admin/agents/${id}`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary-ink hover:underline"
          >
            {t('agents.details')}
            <ChevronRight aria-hidden className="h-4 w-4" />
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}

function Overview() {
  const { t } = useTranslation('admin');
  const overview = useAgentOverview();
  const [filter, setFilter] = useState<AgentId | ''>('');
  return (
    <div className="space-y-6">
      <PageHeader title={t('agents.title')} description={t('agents.subtitle')} />
      {overview.isPending ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : overview.isError ? (
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {overview.data.map((a) => (
            <AgentCard key={a.definition.id} agent={a} />
          ))}
        </div>
      )}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <span aria-hidden className="h-2.5 w-2.5 animate-pulse rounded-full bg-success" />
              {t('agents.live')}
            </span>
          }
          description={t('agents.liveBody')}
          actions={
            <Select
              aria-label={t('agents.filterLabel')}
              value={filter}
              placeholder={t('agents.filterAll')}
              options={AGENT_IDS.map((id) => ({ value: id, label: t(`agents.names.${id}`) }))}
              onChange={(e) => setFilter(e.target.value as AgentId | '')}
              className="w-56"
            />
          }
        />
        <ActivityFeed {...(filter ? { agentId: filter } : {})} limit={40} />
      </Card>
    </div>
  );
}

const DECISIONS: HumanDecision[] = ['accepted', 'edited', 'dismissed', 'pending'];

function Detail({ id }: { id: AgentId }) {
  const { t } = useTranslation('admin');
  const overview = useAgentOverview();
  const activity = useAgentActivity({ agentId: id, limit: 200 });
  const agent = overview.data?.find((a) => a.definition.id === id);
  const name = t(`agents.names.${id}`);
  const counts = DECISIONS.map((d) => ({ d, n: activity.data?.filter((a) => a.decision === d).length ?? 0 }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={name}
        description={t(`agents.defs.${id}.purpose`)}
        breadcrumbs={[{ label: t('agents.title'), to: '/admin/agents' }, { label: name }]}
        actions={agent && <AgentToggle agent={agent} />}
      />
      {overview.isPending ? (
        <SkeletonCard />
      ) : overview.isError ? (
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
      ) : !agent ? (
        <EmptyState icon={Workflow} title={t('agents.notFound')} />
      ) : (
        <>
          <Card>
            <CardHeader title={t('agents.workflow.title')} description={t(`agents.defs.${id}.humanCheck`)} />
            <CardBody>
              <WorkflowDiagram agent={agent} />
            </CardBody>
          </Card>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader
                title={t('agents.today')}
                description={
                  agent.lastActivityAt
                    ? t('agents.lastActive', { time: formatTime(clock(agent.lastActivityAt), 'en') })
                    : undefined
                }
              />
              <CardBody>
                <Metrics agent={agent} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title={t('agents.confidence.title')} description={t('agents.confidence.body')} />
              <CardBody>
                <ConfidenceBars buckets={agent.confidenceBuckets} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title={t('agents.decisions.title')} description={t('agents.decisions.body')} />
              <CardBody>
                {activity.isPending ? (
                  <SkeletonList rows={4} />
                ) : (
                  <dl className="space-y-2">
                    {counts.map(({ d, n }) => (
                      <div key={d} className="flex items-center justify-between text-sm">
                        <dt className="text-fg-muted">{t(`agents.decisions.${d}`)}</dt>
                        <dd className="font-semibold text-fg tabular">{n}</dd>
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-t pt-2 text-sm">
                      <dt className="font-semibold text-fg">{t('agents.overrideRate')}</dt>
                      <dd className="font-bold text-fg tabular">
                        {agent.overrideRate !== null ? `${agent.overrideRate}%` : t('agents.noData')}
                      </dd>
                    </div>
                  </dl>
                )}
              </CardBody>
            </Card>
          </div>
          <Card>
            <CardHeader title={t('agents.activity.title')} />
            <ActivityFeed agentId={id} limit={40} />
          </Card>
        </>
      )}
    </div>
  );
}

export default function AgentsPage() {
  const { t } = useTranslation('admin');
  const { agentId } = useParams();
  const id = AGENT_IDS.find((a) => a === agentId);
  if (agentId && !id) return <EmptyState icon={Workflow} title={t('agents.notFound')} />;
  return id ? <Detail id={id} /> : <Overview />;
}
