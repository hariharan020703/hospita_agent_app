// The patient in the room now: who, token, when called, why they came, plus note, complete and follow-up. With the
// consultation scribe on, the note is drafted from the conversation and signed; otherwise the doctor types it.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarPlus, CheckCircle2, FileText, Save, Sparkles, Stethoscope } from 'lucide-react';
import {
  Button,
  buttonClasses,
  Card,
  CardBody,
  CardHeader,
  Drawer,
  EmptyState,
  Field,
  Textarea,
  toast,
} from '@/components/ui';
import { useAgentActive } from '@/hooks/queries/agents';
import { useVisitActions } from '@/hooks/queries/appointments';
import { useLocale } from '@/hooks/useLocale';
import { formatTime } from '@/lib/format';
import type { AppointmentView } from '@/types';
import { clockTime } from '../utils';
import { FollowUpDialog } from './FollowUpDialog';
import { PreVisitSummaryPanel } from './PreVisitSummary';
import { ScribePanel } from './ScribePanel';

const NOTE_MAX = 1000;

function ConsultationActions({ appointment, today }: { appointment: AppointmentView; today: string }) {
  const { t } = useTranslation(['doctor', 'common']);
  const { complete, addNote } = useVisitActions();
  const scribeOn = useAgentActive('scribe');
  const [note, setNote] = useState(appointment.note ?? '');
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const trimmed = note.trim();
  const noteSaved = trimmed === (appointment.note ?? '').trim();

  const markComplete = () =>
    complete.mutate(!scribeOn && trimmed ? { id: appointment.id, note: trimmed } : { id: appointment.id }, {
      onSuccess: () => toast.success(t('current.completed', { name: appointment.patientName })),
    });

  const saveNote = () =>
    addNote.mutate({ id: appointment.id, note: trimmed }, { onSuccess: () => toast.success(t('current.noteSaved')) });

  return (
    <div className="space-y-4">
      <dl className="text-sm">
        <dt className="text-fg-muted">{t('current.reason')}</dt>
        <dd className="mt-0.5 text-base text-fg">{appointment.reason || t('current.noReason')}</dd>
      </dl>
      {scribeOn ? (
        <ScribePanel appointment={appointment} />
      ) : (
        <Field label={t('current.note')} hint={t('current.noteHint')}>
          {(c) => (
            <Textarea {...c} value={note} rows={3} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)} />
          )}
        </Field>
      )}
      <div className="flex flex-wrap gap-2">
        <Button icon={CheckCircle2} loading={complete.isPending} disabled={addNote.isPending} onClick={markComplete}>
          {t('current.complete')}
        </Button>
        {!scribeOn && (
          <Button
            variant="outline"
            icon={Save}
            loading={addNote.isPending}
            disabled={!trimmed || noteSaved || complete.isPending}
            onClick={saveNote}
          >
            {t('current.saveNote')}
          </Button>
        )}
        <Button variant="outline" icon={CalendarPlus} onClick={() => setFollowUpOpen(true)}>
          {t('current.followUp')}
        </Button>
        <Link to={`/doctor/patients/${appointment.patientId}`} className={buttonClasses('ghost')}>
          <FileText aria-hidden className="h-4 w-4" />
          {t('current.record')}
        </Link>
      </div>
      {followUpOpen && (
        <FollowUpDialog appointment={appointment} today={today} onClose={() => setFollowUpOpen(false)} />
      )}
    </div>
  );
}

export function CurrentConsultationCard({ current, today }: { current: AppointmentView | null; today: string }) {
  const { t } = useTranslation(['doctor', 'common']);
  const { lang } = useLocale();
  const [summaryOpen, setSummaryOpen] = useState(false);
  return (
    <Card>
      <CardHeader
        title={t('current.title')}
        actions={
          current && (
            <Button size="sm" variant="outline" icon={Sparkles} onClick={() => setSummaryOpen(true)}>
              {t('current.summary')}
            </Button>
          )
        }
      />
      {current && (
        <Drawer
          open={summaryOpen}
          onClose={() => setSummaryOpen(false)}
          title={t('summary.drawerTitle', { name: current.patientName })}
          description={`${current.token} · ${current.reason ?? ''}`}
        >
          <PreVisitSummaryPanel key={current.id} appointment={current} />
        </Drawer>
      )}
      <CardBody className="space-y-4">
        <div aria-live="polite" aria-atomic="true">
          {current ? (
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-fg-muted">{t('current.patient')}</p>
                <p className="text-xl font-bold text-fg">{current.patientName}</p>
                {current.calledAt && (
                  <p className="mt-1 text-sm text-fg-muted">
                    {t('current.calledAt', { time: formatTime(clockTime(current.calledAt), lang) })}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-fg-muted">{t('common:token')}</p>
                <p className="text-3xl font-extrabold tracking-tight text-fg tabular">{current.token}</p>
              </div>
            </div>
          ) : (
            <EmptyState icon={Stethoscope} title={t('current.empty')} body={t('current.emptyBody')} className="py-6" />
          )}
        </div>
        {current && <ConsultationActions key={current.id} appointment={current} today={today} />}
      </CardBody>
    </Card>
  );
}
