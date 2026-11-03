// Medical records agent, patient side: the processing view while a document is read, the editable result the
// patient checks (confidence per field, hard-to-read fields highlighted), and saved documents.
import { useEffect, useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, FileText, Loader2, Plus, Save, Sparkles, Trash2, TriangleAlert } from 'lucide-react';
import { Badge, Button, Card, CardBody, ConfirmDialog, IconButton, Input, Select } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { useLocale } from '@/hooks/useLocale';
import { LOW_FIELD_CONFIDENCE, rangeFlag } from '@/features/records/ranges';
import { RECORD_KINDS, type Extraction, type ExtractedText, type MedicalRecord, type RecordKind } from '@/types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function DocumentImage({
  record,
  className,
}: {
  record: Pick<MedicalRecord, 'imageUrl' | 'fileName' | 'fileType'>;
  className?: string;
}) {
  const { t } = useTranslation('patient');
  if (!record.imageUrl) {
    return (
      <div
        className={cn(
          'grid aspect-[3/4] place-items-center rounded-xl border bg-surface-muted p-6 text-center',
          className,
        )}
      >
        <div className="space-y-2 text-fg-muted">
          <FileText aria-hidden className="mx-auto h-10 w-10" />
          <p className="text-sm font-semibold">
            {record.fileType === 'pdf' ? t('records.processing.pdf') : record.fileName}
          </p>
          <p className="break-all text-xs">{record.fileName}</p>
        </div>
      </div>
    );
  }
  return (
    <img
      src={record.imageUrl}
      alt={t('records.view.imageAlt', { name: record.fileName })}
      className={cn('w-full rounded-xl border bg-surface-muted object-contain', className)}
    />
  );
}

const STEPS = ['reading', 'medicines', 'tests'] as const;

/** "Reading document…" -> "Extracting medicines…" -> "Extracting test values…" while the agent works. */
export function ProcessingView({ preview, done }: { preview: ReactNode; done: boolean }) {
  const { t } = useTranslation('patient');
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (done) return;
    const timer = window.setInterval(() => setActive((a) => Math.min(a + 1, STEPS.length - 1)), 950);
    return () => window.clearInterval(timer);
  }, [done]);
  return (
    <Card>
      <CardBody className="grid gap-6 md:grid-cols-[14rem_minmax(0,1fr)] md:items-center">
        <div className="mx-auto w-40 md:w-full">{preview}</div>
        <div className="space-y-4" role="status" aria-live="polite">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-fg">
            <Sparkles aria-hidden className="h-5 w-5 text-primary" />
            {t('records.processing.title')}
          </h2>
          <ol className="space-y-3">
            {STEPS.map((s, i) => {
              const finished = done || i < active;
              const running = !done && i === active;
              return (
                <li key={s} className={cn('flex items-center gap-3', !finished && !running && 'text-fg-subtle')}>
                  {finished ? (
                    <CheckCircle2 aria-hidden className="h-5 w-5 text-success" />
                  ) : running ? (
                    <Loader2 aria-hidden className="h-5 w-5 animate-spin text-primary" />
                  ) : (
                    <span aria-hidden className="h-5 w-5 rounded-full border-2 border-border-strong" />
                  )}
                  <span className={cn(running && 'font-semibold text-fg')}>{t(`records.processing.${s}`)}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </CardBody>
    </Card>
  );
}

function Confidence({ value }: { value: number }) {
  const { t } = useTranslation('patient');
  const low = value < LOW_FIELD_CONFIDENCE;
  return (
    <span className={cn('shrink-0 text-xs tabular', low ? 'font-semibold text-warning-ink' : 'text-fg-subtle')}>
      {low ? `${t('records.review.check')} · ` : ''}
      {t('records.review.confidence', { value })}
    </span>
  );
}

/** One extracted value: label, input and how sure the agent was. Low-confidence values get an amber outline. */
function ExtractedField({
  label,
  field,
  onChange,
  type = 'text',
  className,
}: {
  label: string;
  field: ExtractedText;
  onChange: (value: string) => void;
  type?: 'text' | 'date';
  className?: string;
}) {
  const id = useId();
  const low = field.confidence < LOW_FIELD_CONFIDENCE;
  return (
    <div className={cn('min-w-0 space-y-1', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-fg">
          {label}
        </label>
        <Confidence value={field.confidence} />
      </div>
      <Input
        id={id}
        type={type}
        value={type === 'date' && !ISO_DATE.test(field.value) ? '' : field.value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(low && 'border-warning ring-2 ring-warning/30')}
      />
    </div>
  );
}

const blank = (): ExtractedText => ({ value: '', confidence: 100 });

export function RecordReview({
  record,
  saving,
  onSave,
  onDiscard,
  discarding,
}: {
  record: MedicalRecord;
  saving: boolean;
  onSave: (values: Extraction) => void;
  onDiscard: () => void;
  discarding: boolean;
}) {
  const { t } = useTranslation(['patient', 'triage', 'common']);
  const [values, setValues] = useState<Extraction>(() => structuredClone(record));
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const set = (patch: Partial<Extraction>) => setValues((v) => ({ ...v, ...patch }));
  const text = (field: ExtractedText, value: string): ExtractedText => ({ ...field, value });

  const kindOptions = RECORD_KINDS.map((k) => ({ value: k, label: t(`triage:recordKinds.${k}`) }));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
      <div className="lg:sticky lg:top-24">
        <DocumentImage record={record} className="max-h-[70dvh]" />
      </div>
      <Card>
        <CardBody className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-fg">{t('records.review.title')}</h2>
            <p className="text-sm text-fg-muted">{t('records.review.body')}</p>
            <p className="flex items-start gap-2 rounded-lg bg-info-soft px-3 py-2 text-sm text-info-ink">
              <Sparkles aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
              {t('records.review.aiLabel')}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor={`${record.id}-kind`} className="text-sm font-medium text-fg">
                  {t('records.review.kind')}
                </label>
                <Confidence value={values.kind.confidence} />
              </div>
              <Select
                id={`${record.id}-kind`}
                value={values.kind.value}
                options={kindOptions}
                onChange={(e) => set({ kind: { ...values.kind, value: e.target.value as RecordKind } })}
              />
            </div>
            <ExtractedField
              label={t('records.review.date')}
              type="date"
              field={values.date}
              onChange={(v) => set({ date: text(values.date, v) })}
            />
            <ExtractedField
              label={t('records.review.doctor')}
              field={values.doctor}
              onChange={(v) => set({ doctor: text(values.doctor, v) })}
            />
            <ExtractedField
              label={t('records.review.hospital')}
              field={values.hospital}
              onChange={(v) => set({ hospital: text(values.hospital, v) })}
            />
          </div>

          <section aria-labelledby={`${record.id}-meds`} className="space-y-3">
            <h3 id={`${record.id}-meds`} className="font-semibold text-fg">
              {t('records.review.medicines')}
            </h3>
            {values.medicines.length === 0 && <p className="text-sm text-fg-muted">{t('records.review.none')}</p>}
            {values.medicines.map((m, i) => (
              <div key={i} className="flex items-end gap-2 rounded-xl border bg-surface-muted p-3">
                <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-3">
                  {(['name', 'dose', 'frequency'] as const).map((k) => (
                    <ExtractedField
                      key={k}
                      label={t(`records.review.${k === 'name' ? 'medicine' : k}`)}
                      field={m[k]}
                      onChange={(v) =>
                        set({ medicines: values.medicines.map((x, j) => (j === i ? { ...x, [k]: text(x[k], v) } : x)) })
                      }
                    />
                  ))}
                </div>
                <IconButton
                  icon={Trash2}
                  label={t('records.review.remove')}
                  onClick={() => set({ medicines: values.medicines.filter((_, j) => j !== i) })}
                />
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              icon={Plus}
              onClick={() =>
                set({ medicines: [...values.medicines, { name: blank(), dose: blank(), frequency: blank() }] })
              }
            >
              {t('records.review.addMedicine')}
            </Button>
          </section>

          <section aria-labelledby={`${record.id}-tests`} className="space-y-3">
            <h3 id={`${record.id}-tests`} className="font-semibold text-fg">
              {t('records.review.tests')}
            </h3>
            {values.tests.length === 0 && <p className="text-sm text-fg-muted">{t('records.review.none')}</p>}
            {values.tests.map((test, i) => {
              const flag = rangeFlag(test.value.value, test.range.value);
              const out = flag === 'high' || flag === 'low';
              return (
                <div
                  key={i}
                  className={cn(
                    'flex items-end gap-2 rounded-xl border bg-surface-muted p-3',
                    out && 'border-warning/60',
                  )}
                >
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="grid gap-3 sm:grid-cols-4">
                      {(['name', 'value', 'unit', 'range'] as const).map((k) => (
                        <ExtractedField
                          key={k}
                          label={t(`records.review.${k === 'name' ? 'test' : k}`)}
                          field={test[k]}
                          onChange={(v) =>
                            set({ tests: values.tests.map((x, j) => (j === i ? { ...x, [k]: text(x[k], v) } : x)) })
                          }
                        />
                      ))}
                    </div>
                    {out && (
                      <Badge tone="warning" icon={TriangleAlert}>
                        {t(`records.review.${flag}`)}
                      </Badge>
                    )}
                  </div>
                  <IconButton
                    icon={Trash2}
                    label={t('records.review.remove')}
                    onClick={() => set({ tests: values.tests.filter((_, j) => j !== i) })}
                  />
                </div>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              icon={Plus}
              onClick={() =>
                set({ tests: [...values.tests, { name: blank(), value: blank(), unit: blank(), range: blank() }] })
              }
            >
              {t('records.review.addTest')}
            </Button>
          </section>

          <section aria-labelledby={`${record.id}-dx`} className="space-y-3">
            <h3 id={`${record.id}-dx`} className="font-semibold text-fg">
              {t('records.review.diagnoses')}
            </h3>
            {values.diagnoses.length === 0 && <p className="text-sm text-fg-muted">{t('records.review.none')}</p>}
            {values.diagnoses.map((d, i) => (
              <div key={i} className="flex items-end gap-2">
                <ExtractedField
                  className="flex-1"
                  label={t('records.review.diagnosis')}
                  field={d}
                  onChange={(v) => set({ diagnoses: values.diagnoses.map((x, j) => (j === i ? text(x, v) : x)) })}
                />
                <IconButton
                  icon={Trash2}
                  label={t('records.review.remove')}
                  onClick={() => set({ diagnoses: values.diagnoses.filter((_, j) => j !== i) })}
                />
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              icon={Plus}
              onClick={() => set({ diagnoses: [...values.diagnoses, blank()] })}
            >
              {t('records.review.addDiagnosis')}
            </Button>
          </section>

          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button
              icon={Save}
              loading={saving}
              onClick={() =>
                onSave({
                  ...values,
                  medicines: values.medicines.filter((m) => m.name.value.trim()),
                  tests: values.tests.filter((x) => x.name.value.trim()),
                  diagnoses: values.diagnoses.filter((d) => d.value.trim()),
                })
              }
            >
              {t('records.review.save')}
            </Button>
            <Button variant="dangerOutline" icon={Trash2} disabled={saving} onClick={() => setConfirmDiscard(true)}>
              {t('records.review.discard')}
            </Button>
          </div>
        </CardBody>
      </Card>
      <ConfirmDialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        onConfirm={onDiscard}
        tone="danger"
        loading={discarding}
        title={t('records.review.discardTitle')}
        body={t('records.review.discardBody')}
        confirmLabel={t('records.review.discard')}
      />
    </div>
  );
}

/** Read-only view of a saved document. */
export function RecordFacts({ record }: { record: MedicalRecord }) {
  const { t } = useTranslation(['patient', 'triage']);
  const { lang } = useLocale();
  return (
    <div className="space-y-4 text-sm">
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-fg-muted">{t('records.review.kind')}</dt>
          <dd className="font-medium text-fg">{t(`triage:recordKinds.${record.kind.value}`)}</dd>
        </div>
        <div>
          <dt className="text-fg-muted">{t('records.review.date')}</dt>
          <dd className="font-medium text-fg">
            {ISO_DATE.test(record.date.value) ? formatDate(record.date.value, lang) : record.date.value || '—'}
          </dd>
        </div>
        <div>
          <dt className="text-fg-muted">{t('records.review.doctor')}</dt>
          <dd className="font-medium text-fg">{record.doctor.value || '—'}</dd>
        </div>
        <div>
          <dt className="text-fg-muted">{t('records.review.hospital')}</dt>
          <dd className="font-medium text-fg">{record.hospital.value || '—'}</dd>
        </div>
      </dl>
      {record.medicines.length > 0 && (
        <div>
          <h4 className="font-semibold text-fg">{t('records.review.medicines')}</h4>
          <ul className="mt-1 space-y-1">
            {record.medicines.map((m, i) => (
              <li key={i} className="text-fg">
                <span className="font-medium">{m.name.value}</span> {m.dose.value} · {m.frequency.value}
              </li>
            ))}
          </ul>
        </div>
      )}
      {record.tests.length > 0 && (
        <div>
          <h4 className="font-semibold text-fg">{t('records.review.tests')}</h4>
          <ul className="mt-1 space-y-1">
            {record.tests.map((x, i) => {
              const flag = rangeFlag(x.value.value, x.range.value);
              return (
                <li key={i} className="flex flex-wrap items-center gap-2 text-fg">
                  <span className="font-medium">{x.name.value}</span>
                  <span className="tabular">
                    {x.value.value} {x.unit.value}
                  </span>
                  <span className="text-fg-muted">({x.range.value})</span>
                  {(flag === 'high' || flag === 'low') && <Badge tone="warning">{t(`records.review.${flag}`)}</Badge>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {record.diagnoses.length > 0 && (
        <div>
          <h4 className="font-semibold text-fg">{t('records.review.diagnoses')}</h4>
          <p className="mt-1 text-fg">{record.diagnoses.map((d) => d.value).join(', ')}</p>
        </div>
      )}
    </div>
  );
}
