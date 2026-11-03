// AI escalations: conversations the assistant handed to the desk (unclear routing, asked for a person, unclear safety answer).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Inbox, MessageSquareText } from 'lucide-react';
import { EmptyState, PageHeader, QueryBoundary, SkeletonList, Tabs } from '@/components/ui';
import { useEscalations } from '@/hooks/queries/clinical';
import type { Escalation } from '@/types';
import { EscalationCard, ResolveDialog } from '../components/EscalationCard';

type Status = Escalation['status'];

/** Open: oldest first so nobody waits too long. Resolved: most recently resolved first. */
function sortEscalations(list: readonly Escalation[], status: Status): Escalation[] {
  return [...list].sort((a, b) =>
    status === 'open'
      ? a.createdAt.localeCompare(b.createdAt)
      : (b.resolvedAt ?? b.createdAt).localeCompare(a.resolvedAt ?? a.createdAt),
  );
}

export default function EscalationsPage() {
  const { t } = useTranslation(['desk', 'common']);
  const [tab, setTab] = useState<Status>('open');
  const [resolving, setResolving] = useState<Escalation | null>(null);
  const open = useEscalations('open');
  const resolved = useEscalations('resolved');

  return (
    <div className="space-y-6">
      <PageHeader title={t('escalations.title')} description={t('escalations.description')} />

      <Tabs<Status>
        label={t('escalations.tabs')}
        tabs={[
          { id: 'open', label: t('escalations.open'), ...(open.data ? { count: open.data.length } : {}) },
          {
            id: 'resolved',
            label: t('escalations.resolved'),
            ...(resolved.data ? { count: resolved.data.length } : {}),
          },
        ]}
        value={tab}
        onChange={setTab}
      >
        {(active) => (
          <QueryBoundary
            query={active === 'open' ? open : resolved}
            loading={<SkeletonList rows={3} rowClassName="h-40" />}
            empty={
              active === 'open' ? (
                <EmptyState icon={Inbox} title={t('escalations.emptyOpen')} body={t('escalations.emptyOpenBody')} />
              ) : (
                <EmptyState
                  icon={MessageSquareText}
                  title={t('escalations.emptyResolved')}
                  body={t('escalations.emptyResolvedBody')}
                />
              )
            }
          >
            {(list) => (
              <div className="space-y-3">
                {active === 'open' && <p className="text-sm text-fg-muted">{t('escalations.openOrder')}</p>}
                <ul
                  className="space-y-3"
                  aria-label={active === 'open' ? t('escalations.open') : t('escalations.resolved')}
                >
                  {sortEscalations(list, active).map((escalation) => (
                    <li key={escalation.id}>
                      <EscalationCard escalation={escalation} onResolve={() => setResolving(escalation)} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </QueryBoundary>
        )}
      </Tabs>

      {resolving && <ResolveDialog escalation={resolving} onClose={() => setResolving(null)} />}
    </div>
  );
}
