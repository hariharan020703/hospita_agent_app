// Where a pre-visit summary item came from: the patient's conversation with the assistant (the line highlighted)
// or the uploaded document (the image beside what was read from it).
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, UserRound } from 'lucide-react';
import { Drawer, ErrorState, Modal, SkeletonCard } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useRecord } from '@/hooks/queries/agents';
import { useTriageSession } from '@/hooks/queries/clinical';
import { DocumentImage, RecordFacts } from '@/features/patient/components/records';
import type { SummarySource } from '@/types';

function Conversation({ triageId, line }: { triageId: string; line: number | undefined }) {
  const { t } = useTranslation('doctor');
  const session = useTriageSession(triageId);
  const highlighted = useRef<HTMLLIElement>(null);
  useEffect(() => highlighted.current?.scrollIntoView({ block: 'center' }), [session.data]);
  if (session.isPending) return <SkeletonCard />;
  if (session.isError) return <ErrorState error={session.error} onRetry={() => void session.refetch()} />;
  return (
    <ol className="space-y-3" lang={session.data.lang}>
      {session.data.messages.map((m, i) => {
        const patient = m.from === 'patient';
        return (
          <li
            key={i}
            ref={i === line ? highlighted : undefined}
            className={cn(
              'flex items-start gap-2 rounded-xl p-2',
              i === line && 'bg-warning-soft ring-2 ring-warning/40',
            )}
          >
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-sunken text-fg-muted">
              {patient ? <UserRound aria-hidden className="h-4 w-4" /> : <Bot aria-hidden className="h-4 w-4" />}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-fg-muted">
                {patient ? t('summary.speaker.patient') : t('summary.speaker.assistant')}
                {m.voice ? ` · ${t('summary.speaker.voice')}` : ''}
              </p>
              <p className={cn('text-fg', patient && 'font-medium')}>{m.text}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Document({ recordId }: { recordId: string }) {
  const record = useRecord(recordId);
  if (record.isPending) return <SkeletonCard />;
  if (record.isError) return <ErrorState error={record.error} onRetry={() => void record.refetch()} />;
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
      <DocumentImage record={record.data} />
      <RecordFacts record={record.data} />
    </div>
  );
}

export function SourceViewer({ source, onClose }: { source: SummarySource | null; onClose: () => void }) {
  const { t } = useTranslation('doctor');
  return (
    <>
      <Drawer
        open={source?.kind === 'conversation'}
        onClose={onClose}
        title={t('summary.transcriptTitle')}
        description={t('summary.transcriptBody')}
      >
        {source?.kind === 'conversation' && <Conversation triageId={source.triageId} line={source.line} />}
      </Drawer>
      <Modal open={source?.kind === 'record'} onClose={onClose} size="xl" title={t('summary.documentTitle')}>
        {source?.kind === 'record' && <Document recordId={source.recordId} />}
      </Modal>
    </>
  );
}
