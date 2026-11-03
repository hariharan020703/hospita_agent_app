// AI pre-visit summary (medical records agent): the triage conversation plus the documents the patient uploaded
// and checked, each item linked to its source. Patient-reported and document-derived; never a diagnosis.
import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ClipboardList,
  Clock,
  FileText,
  Info,
  MessageSquareText,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Sparkles,
  TriangleAlert,
  UserRound,
} from 'lucide-react';
import { Badge, EmptyState, ErrorState, SkeletonCard, type BadgeTone } from '@/components/ui';
import { usePatient } from '@/hooks/queries/directory';
import { usePreVisitSummary } from '@/hooks/queries/agents';
import { now } from '@/lib/clock';
import { ageFromBirthYear } from '@/lib/time';
import type { AppointmentView, PreVisitSummary, SummarySource, Urgency } from '@/types';
import { SourceViewer } from './SourceViewer';

const SAFETY: Record<NonNullable<PreVisitSummary['safetyScreen']>, { tone: BadgeTone; icon: typeof ShieldCheck }> = {
  passed: { tone: 'success', icon: ShieldCheck },
  not_asked: { tone: 'neutral', icon: ShieldQuestion },
  // A reported warning sign is an emergency signal, so it is the one place this card uses red.
  failed: { tone: 'danger', icon: ShieldAlert },
};
const URGENCY_TONE: Record<Urgency, BadgeTone> = { routine: 'info', soon: 'warning', emergency: 'danger' };

function SourceLink({ source, onOpen }: { source: SummarySource; onOpen: (source: SummarySource) => void }) {
  const { t } = useTranslation('doctor');
  if (source.kind === 'profile') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-fg-subtle">
        <UserRound aria-hidden className="h-3 w-3" />
        {t('summary.sources.profile')}
      </span>
    );
  }
  const Icon = source.kind === 'record' ? FileText : MessageSquareText;
  const label = t(`summary.sources.${source.kind}`);
  return (
    <button
      type="button"
      onClick={() => onOpen(source)}
      aria-label={t('summary.viewSource', { source: label })}
      className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-primary-ink hover:bg-primary-soft"
    >
      <Icon aria-hidden className="h-3 w-3" />
      {label}
    </button>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-fg-muted">{title}</h4>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Row({
  children,
  source,
  onOpen,
}: {
  children: ReactNode;
  source: SummarySource;
  onOpen: (s: SummarySource) => void;
}) {
  return (
    <li className="flex items-start justify-between gap-3 py-1.5">
      <div className="min-w-0 text-fg">{children}</div>
      <SourceLink source={source} onOpen={onOpen} />
    </li>
  );
}

export function PreVisitSummaryPanel({ appointment }: { appointment: AppointmentView }) {
  // The source viewer shows documents with the patient app's record view, so its texts load with the panel.
  const { t } = useTranslation(['doctor', 'common', 'patient', 'triage']);
  const titleId = useId();
  const summary = usePreVisitSummary(appointment.id);
  const patient = usePatient(appointment.patientId);
  const [source, setSource] = useState<SummarySource | null>(null);

  if (summary.isPending) return <SkeletonCard />;
  if (summary.isError) return <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />;
  const s = summary.data;
  if (!s.triageId && s.recordCount === 0) {
    return <EmptyState icon={ClipboardList} title={t('summary.none')} body={t('summary.noneBody')} className="py-6" />;
  }

  const age = patient.data ? ageFromBirthYear(patient.data.birthYear, now()) : null;
  const preferredLang = patient.data?.preferredLang ?? s.lang;
  const safety = s.safetyScreen ? SAFETY[s.safetyScreen] : null;

  return (
    <section aria-labelledby={titleId} className="space-y-4 rounded-xl border bg-surface-muted p-4">
      <div className="space-y-2">
        <h3 id={titleId} className="flex items-center gap-2 text-base font-semibold text-fg">
          <Sparkles aria-hidden className="h-4 w-4 text-primary" />
          {t('summary.title')}
        </h3>
        <p className="flex items-start gap-2 rounded-lg bg-info-soft px-3 py-2 text-sm text-info-ink">
          <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <span className="font-semibold">{t('summary.aiLabel')}.</span> {t('summary.disclaimer')}
          </span>
        </p>
        {!s.recordsIncluded && (
          <p className="flex items-center gap-2 text-sm text-warning-ink">
            <TriangleAlert aria-hidden className="h-4 w-4" />
            {t('summary.recordsPaused')}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {s.urgency && (
          <Badge tone={URGENCY_TONE[s.urgency]} icon={Clock} size="md">
            {t(`summary.urgencyValue.${s.urgency}`)}
          </Badge>
        )}
        {s.confidence !== null && <Badge size="md">{t('summary.confidenceValue', { value: s.confidence })}</Badge>}
        {safety && s.safetyScreen && (
          <Badge tone={safety.tone} icon={safety.icon} size="md">
            {t(`summary.safety.${s.safetyScreen}`)}
          </Badge>
        )}
        <Badge size="md">{t('summary.documents', { count: s.recordCount })}</Badge>
        <Badge size="md">
          <span lang={preferredLang}>{t(`common:language.${preferredLang}`)}</span>
        </Badge>
      </div>

      {s.chiefComplaint && (
        <div>
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-fg-muted">{t('summary.chiefComplaint')}</h4>
            <SourceLink source={s.chiefComplaint.source} onOpen={setSource} />
          </div>
          <blockquote lang={s.lang} className="mt-1 border-l-4 border-primary/50 pl-3 text-lg font-semibold text-fg">
            {s.chiefComplaint.value}
          </blockquote>
        </div>
      )}

      <dl className="grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-sm text-fg-muted">{t('summary.duration')}</dt>
          <dd className="mt-0.5 flex items-center gap-2 text-fg">
            {s.duration ? (
              <>
                <span lang={s.lang}>{s.duration.value}</span>
                <SourceLink source={s.duration.source} onOpen={setSource} />
              </>
            ) : (
              t('summary.notReported')
            )}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-fg-muted">{t('summary.severity')}</dt>
          <dd className="mt-0.5 text-fg">
            {s.severity ? (
              <span className="flex items-center gap-3">
                <span className="font-semibold tabular">{t('summary.severityValue', { value: s.severity.value })}</span>
                <span aria-hidden className="h-2 w-full max-w-[7rem] overflow-hidden rounded-full bg-surface-sunken">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${s.severity.value * 10}%` }}
                  />
                </span>
              </span>
            ) : (
              t('summary.notReported')
            )}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-fg-muted">{t('summary.age')}</dt>
          <dd className="mt-0.5 text-fg">
            {age !== null ? t('summary.ageValue', { count: age }) : t('summary.notReported')}
          </dd>
        </div>
      </dl>

      {s.associated.length > 0 && (
        <Section title={t('summary.associated')}>
          <ul className="divide-y">
            {s.associated.map((a, i) => (
              <Row key={i} source={a.source} onOpen={setSource}>
                <span className="block text-sm text-fg-muted">{a.value.question.en}</span>
                <span lang={s.lang} className="font-medium">
                  {a.value.answer}
                </span>
              </Row>
            ))}
          </ul>
        </Section>
      )}

      <Section title={t('summary.conditions')}>
        {s.conditions.length === 0 ? (
          <p className="text-fg">{t('summary.noneReported')}</p>
        ) : (
          <ul className="divide-y">
            {s.conditions.map((c, i) => (
              <Row key={i} source={c.source} onOpen={setSource}>
                {c.value}
              </Row>
            ))}
          </ul>
        )}
      </Section>

      {s.recordsIncluded && (
        <>
          <Section title={t('summary.medicines')}>
            {s.medicines.length === 0 ? (
              <p className="text-sm text-fg-muted">{t('summary.noMedicines')}</p>
            ) : (
              <ul className="divide-y">
                {s.medicines.map((m, i) => (
                  <Row key={i} source={m.source} onOpen={setSource}>
                    <span className="font-semibold">{m.value.name}</span> {m.value.dose}
                    <span className="block text-sm text-fg-muted">{m.value.frequency}</span>
                  </Row>
                ))}
              </ul>
            )}
          </Section>
          <Section title={t('summary.results')}>
            {s.results.length === 0 ? (
              <p className="text-sm text-fg-muted">{t('summary.noResults')}</p>
            ) : (
              <ul className="divide-y">
                {s.results.map((r, i) => {
                  const out = r.value.flag === 'high' || r.value.flag === 'low';
                  return (
                    <Row key={i} source={r.source} onOpen={setSource}>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{r.value.name}</span>
                        <span className={out ? 'font-bold text-warning-ink tabular' : 'tabular'}>
                          {r.value.value} {r.value.unit}
                        </span>
                        <span className="text-sm text-fg-muted">({r.value.range})</span>
                        {out && (
                          <Badge tone="warning">
                            {r.value.flag === 'high' ? t('summary.flag.high') : t('summary.flag.low')}
                          </Badge>
                        )}
                      </span>
                    </Row>
                  );
                })}
              </ul>
            )}
          </Section>
          {s.diagnosesMentioned.length > 0 && (
            <Section title={t('summary.diagnoses')}>
              <ul className="divide-y">
                {s.diagnosesMentioned.map((d, i) => (
                  <Row key={i} source={d.source} onOpen={setSource}>
                    {d.value}
                  </Row>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}

      <SourceViewer source={source} onClose={() => setSource(null)} />
    </section>
  );
}
