// One AI escalation: why the assistant handed over, how to reach the patient, and what they said in their own words.
import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  HelpCircle,
  Monitor,
  Phone,
  ShieldQuestion,
  Smartphone,
  UserPlus,
  UserRound,
  Building2,
  type LucideIcon,
} from 'lucide-react';
import { Badge, Button, buttonClasses, Field, Modal, Textarea, type BadgeTone } from '@/components/ui';
import { useSession } from '@/features/auth/session';
import { useResolveEscalation } from '@/hooks/queries/clinical';
import { usePatient } from '@/hooks/queries/directory';
import { formatPhone } from '@/lib/format';
import type { Channel, Escalation, EscalationReason } from '@/types';
import { langOfText } from '../deskUtils';
import { useRelativeTime } from '../useRelativeTime';

const REASON: Record<EscalationReason, { tone: BadgeTone; icon: LucideIcon }> = {
  unclear_routing: { tone: 'info', icon: HelpCircle },
  asked_for_human: { tone: 'primary', icon: UserRound },
  safety_unclear: { tone: 'warning', icon: ShieldQuestion },
};

const CHANNEL_ICON: Record<Channel, LucideIcon> = { app: Smartphone, kiosk: Monitor, desk: Building2 };

const QUICK_NOTES = ['calledBack', 'booked', 'walkIn'] as const;

export function EscalationCard({ escalation: e, onResolve }: { escalation: Escalation; onResolve: () => void }) {
  const { t } = useTranslation(['desk', 'common']);
  const relativeTime = useRelativeTime();
  const headingId = useId();
  const patient = usePatient(e.patientId);
  const phone = e.phone ?? patient.data?.phone;
  const { tone, icon } = REASON[e.reason];

  const name = !e.patientId ? (
    t('escalations.unregistered')
  ) : patient.isPending ? (
    <>
      <span aria-hidden className="inline-block h-4 w-40 animate-pulse rounded bg-surface-sunken align-middle" />
      <span className="sr-only">{t('escalations.loadingPatient')}</span>
    </>
  ) : patient.isError ? (
    t('escalations.patientUnavailable')
  ) : (
    patient.data.name
  );

  return (
    <article aria-labelledby={headingId} className="space-y-3 rounded-xl border bg-surface p-4 shadow-xs sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={tone} icon={icon} size="md">
          {t(`escalations.reason.${e.reason}`)}
        </Badge>
        <Badge icon={CHANNEL_ICON[e.channel]}>
          {t('escalations.channelLabel', { channel: t(`channel.${e.channel}`) })}
        </Badge>
        <time dateTime={e.createdAt} className="ml-auto text-sm text-fg-muted">
          {relativeTime(e.createdAt)}
        </time>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id={headingId} className="break-words text-base font-semibold text-fg">
          {name}
        </h3>
        {phone ? (
          <a
            href={`tel:+91${phone}`}
            aria-label={t('escalations.call', { phone: formatPhone(phone) })}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg font-semibold text-primary-ink tabular underline-offset-2 hover:underline"
          >
            <Phone aria-hidden className="h-4 w-4" />
            {formatPhone(phone)}
          </a>
        ) : (
          <span className="text-sm text-fg-subtle">{t('escalations.noPhone')}</span>
        )}
      </div>

      <figure>
        <figcaption className="text-xs font-semibold text-fg-muted">{t('escalations.inTheirWords')}</figcaption>
        <blockquote
          lang={langOfText(e.summary)}
          className="mt-1 whitespace-pre-line break-words rounded-lg border-l-4 border-primary/40 bg-surface-muted px-3 py-2 text-fg"
        >
          {e.summary}
        </blockquote>
      </figure>

      {e.status === 'resolved' ? (
        <div className="rounded-lg bg-success-soft px-3 py-2 text-sm">
          <p className="flex flex-wrap items-center gap-x-2 font-semibold text-success-ink">
            <CheckCircle2 aria-hidden className="h-4 w-4 shrink-0" />
            {e.resolvedAt
              ? t('escalations.resolvedAt', { time: relativeTime(e.resolvedAt) })
              : t('escalations.resolution')}
          </p>
          {e.resolution && (
            <p lang={langOfText(e.resolution)} className="mt-1 break-words text-fg">
              {e.resolution}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={CheckCircle2} onClick={onResolve} aria-describedby={headingId}>
            {t('escalations.resolve')}
          </Button>
          <Link
            to={phone ? `/desk/walk-in?phone=${encodeURIComponent(phone)}` : '/desk/walk-in'}
            className={buttonClasses('outline', 'sm')}
            aria-describedby={headingId}
          >
            <UserPlus aria-hidden className="h-4 w-4" />
            {t('escalations.registerWalkIn')}
          </Link>
        </div>
      )}
    </article>
  );
}

export function ResolveDialog({ escalation, onClose }: { escalation: Escalation; onClose: () => void }) {
  const { t } = useTranslation(['desk', 'common']);
  const session = useSession();
  const resolve = useResolveEscalation();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | undefined>();

  const submit = () => {
    const resolution = note.trim();
    if (!resolution) {
      setError('required');
      return;
    }
    if (!session) return;
    resolve.mutate({ id: escalation.id, resolution, userId: session.userId }, { onSuccess: onClose });
  };

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!resolve.isPending}
      title={t('escalations.resolveTitle')}
      description={t('escalations.resolveBody')}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={resolve.isPending}>
            {t('common:actions.cancel')}
          </Button>
          <Button icon={CheckCircle2} loading={resolve.isPending} disabled={!session} onClick={submit}>
            {t('escalations.resolveConfirm')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <blockquote
          lang={langOfText(escalation.summary)}
          className="break-words rounded-lg border-l-4 border-primary/40 bg-surface-muted px-3 py-2 text-sm text-fg"
        >
          {escalation.summary}
        </blockquote>
        <Field label={t('escalations.resolutionLabel')} hint={t('escalations.resolutionHint')} error={error} required>
          {(c) => (
            <Textarea
              {...c}
              value={note}
              rows={4}
              maxLength={300}
              onChange={(event) => {
                setNote(event.target.value);
                if (error) setError(undefined);
              }}
            />
          )}
        </Field>
        <div className="space-y-2">
          <p className="text-sm font-medium text-fg">{t('escalations.quickNotes')}</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_NOTES.map((key) => (
              <Button
                key={key}
                size="sm"
                variant="outline"
                className="h-auto whitespace-normal py-1.5 text-left"
                onClick={() => {
                  setNote(t(`escalations.quick.${key}`));
                  setError(undefined);
                }}
              >
                {t(`escalations.quick.${key}`)}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
