// Consultation scribe on the current consultation: "Start listening" -> live transcript (Doctor / Patient, mixed
// Tamil and English) with a mic indicator, pause and stop -> draft note -> doctor edits -> Sign & save.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Loader2, Mic, Pause, Play, Square } from 'lucide-react';
import { Button, ErrorState, SkeletonCard } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatTime } from '@/lib/format';
import { useConsultationNote, useDraftNote, useScribeListen } from '@/hooks/queries/agents';
import { useSession } from '@/features/auth/session';
import type { AppointmentView, ConsultationNote, TranscriptLine } from '@/types';
import { useTranscriptStream } from '../useTranscriptStream';
import { clockTime } from '../utils';
import { NoteEditor } from './NoteEditor';

function Line({ line, typing }: { line: TranscriptLine; typing?: boolean }) {
  const { t } = useTranslation('doctor');
  const doctor = line.speaker === 'doctor';
  return (
    <li className="flex gap-3">
      <span
        className={cn(
          'w-16 shrink-0 pt-0.5 text-xs font-bold uppercase tracking-wide',
          doctor ? 'text-primary-ink' : 'text-fg-muted',
        )}
      >
        {t(`scribe.speaker.${line.speaker}`)}
      </span>
      <span className="min-w-0 text-fg" lang="ta">
        {line.text}
        {typing && <span aria-hidden className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-fg align-middle" />}
      </span>
    </li>
  );
}

function SignedNote({ note }: { note: ConsultationNote }) {
  const { t } = useTranslation('doctor');
  return (
    <div className="space-y-3 rounded-xl border border-success/40 bg-success-soft/40 p-4">
      <p className="flex items-center gap-2 font-semibold text-success-ink">
        <CheckCircle2 aria-hidden className="h-5 w-5" />
        {t('scribe.signedAt', { time: note.signedAt ? formatTime(clockTime(note.signedAt), 'en') : '' })}
      </p>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-fg-muted">{t('scribe.fields.assessment')}</dt>
          <dd className="text-fg">{note.fields.assessment.value || '—'}</dd>
        </div>
        <div>
          <dt className="text-fg-muted">{t('scribe.prescription')}</dt>
          <dd className="text-fg">
            {note.prescription.length
              ? note.prescription.map((p) => `${p.medicine} ${p.dose}`).join(', ')
              : t('scribe.noMedicines')}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function ScribePanel({ appointment }: { appointment: AppointmentView }) {
  const { t } = useTranslation('doctor');
  const session = useSession();
  const note = useConsultationNote(appointment.id);
  const listen = useScribeListen();
  const draft = useDraftNote();
  const [lines, setLines] = useState<TranscriptLine[] | null>(null);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const stream = useTranscriptStream(lines, paused);
  const logRef = useRef<HTMLOListElement>(null);
  const listening = lines !== null;

  useEffect(() => {
    if (!listening || paused) return;
    const timer = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [listening, paused]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [stream.lines.length, stream.partial?.text]);

  const start = () =>
    listen.mutate(appointment.id, {
      onSuccess: (heard) => {
        setSeconds(0);
        setPaused(false);
        setLines(heard.lines);
      },
    });

  const stop = () => {
    const heard = stream.heard;
    setPaused(true);
    draft.mutate(
      { appointmentId: appointment.id, heard },
      {
        onSuccess: () => setLines(null),
        onError: () => setPaused(false),
      },
    );
  };

  if (note.isPending) return <SkeletonCard />;
  if (note.isError) return <ErrorState error={note.error} onRetry={() => void note.refetch()} />;

  if (!listening && note.data?.status === 'signed') return <SignedNote note={note.data} />;

  if (!listening && note.data?.status === 'draft') {
    return (
      <NoteEditor
        key={`${note.data.id}:${note.data.updatedAt}`}
        note={note.data}
        patientName={appointment.patientName}
        userId={session?.userId ?? ''}
        onRestart={() => setLines(null)}
      />
    );
  }

  if (!listening) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed p-4">
        <p className="max-w-prose text-sm text-fg-muted">{t('scribe.intro')}</p>
        <Button icon={Mic} loading={listen.isPending} onClick={start}>
          {t('scribe.start')}
        </Button>
      </div>
    );
  }

  const minutes = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  return (
    <section aria-label={t('scribe.liveTitle')} className="space-y-3 rounded-xl border bg-surface-muted p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-3 font-semibold text-fg" role="status">
          {draft.isPending ? (
            <>
              <Loader2 aria-hidden className="h-5 w-5 animate-spin text-primary" />
              {t('scribe.drafting')}
            </>
          ) : (
            <>
              <span className="relative grid h-8 w-8 place-items-center">
                {!paused && (
                  <span aria-hidden className="absolute inset-0 animate-pulse-ring rounded-full bg-danger/40" />
                )}
                <Mic aria-hidden className={cn('relative h-5 w-5', paused ? 'text-fg-muted' : 'text-danger')} />
              </span>
              {paused ? t('scribe.paused') : stream.finished ? t('scribe.ended') : t('scribe.listening')}
              <span className="font-mono text-sm text-fg-muted tabular">{minutes}</span>
            </>
          )}
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={paused ? Play : Pause}
            disabled={draft.isPending || stream.finished}
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? t('scribe.resume') : t('scribe.pause')}
          </Button>
          <Button size="sm" icon={Square} loading={draft.isPending} onClick={stop}>
            {t('scribe.stop')}
          </Button>
        </div>
      </div>
      <ol
        ref={logRef}
        aria-live="polite"
        className="max-h-72 space-y-2 overflow-y-auto rounded-lg bg-surface p-3 text-sm scrollbar-thin"
      >
        {stream.lines.length === 0 && !stream.partial && <li className="text-fg-subtle">{t('scribe.waiting')}</li>}
        {stream.lines.map((l, i) => (
          <Line key={i} line={l} />
        ))}
        {stream.partial && <Line line={stream.partial} typing={!paused} />}
      </ol>
      <p className="text-xs text-fg-subtle">{t('scribe.consentNote')}</p>
    </section>
  );
}
