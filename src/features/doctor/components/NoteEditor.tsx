// The scribe's draft note and prescription, editable. Every AI-filled value stays marked until the doctor edits or
// confirms it; "Sign & save" makes the note final and sends the prescription to the patient's care plan.
import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, CheckCircle2, FileSignature, Plus, RotateCcw, Save, Sparkles, Trash2 } from 'lucide-react';
import { Badge, Button, ConfirmDialog, IconButton, Input, Select, Textarea, toast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useDiscardNote, useSaveNoteDraft, useSignNote } from '@/hooks/queries/agents';
import {
  DOSE_SLOTS,
  FOOD_TIMINGS,
  NOTE_FIELDS,
  type ConsultationNote,
  type FoodTiming,
  type NoteField,
  type NoteFieldKey,
  type PrescriptionItem,
} from '@/types';
import { newId } from '@/lib/id';

function AiMark({ ai, reviewed, onConfirm }: { ai: boolean; reviewed: boolean; onConfirm: () => void }) {
  const { t } = useTranslation('doctor');
  if (!ai) return null;
  if (reviewed) {
    return (
      <Badge tone="success" icon={CheckCircle2}>
        {t('scribe.reviewed')}
      </Badge>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge tone="info" icon={Sparkles}>
        {t('scribe.aiDraft')}
      </Badge>
      <Button size="sm" variant="ghost" icon={Check} onClick={onConfirm}>
        {t('scribe.confirm')}
      </Button>
    </span>
  );
}

function FieldEditor({
  label,
  hint,
  field,
  rows,
  onChange,
  onConfirm,
}: {
  label: string;
  hint?: string;
  field: NoteField;
  rows: number;
  onChange: (value: string) => void;
  onConfirm: () => void;
}) {
  const id = useId();
  const pending = field.ai && !field.reviewed;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-fg">
          {label}
        </label>
        <AiMark ai={field.ai} reviewed={field.reviewed} onConfirm={onConfirm} />
      </div>
      {hint && <p className="text-xs text-fg-muted">{hint}</p>}
      <Textarea
        id={id}
        rows={rows}
        value={field.value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(pending && 'border-info/60 bg-info-soft/30')}
      />
    </div>
  );
}

const ROWS: Record<NoteFieldKey, number> = {
  chiefComplaint: 2,
  history: 3,
  examination: 2,
  assessment: 2,
  investigations: 3,
  advice: 4,
};

export function NoteEditor({
  note,
  patientName,
  userId,
  onRestart,
}: {
  note: ConsultationNote;
  patientName: string;
  userId: string;
  onRestart: () => void;
}) {
  const { t } = useTranslation(['doctor', 'common']);
  const [draft, setDraft] = useState<ConsultationNote>(note);
  const [confirmSign, setConfirmSign] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const edited = useRef(new Set<string>());
  const save = useSaveNoteDraft();
  const sign = useSignNote();
  const discard = useDiscardNote();
  const followUpId = useId();

  /** Editing a value the scribe drafted counts once towards the edit rate; any edit marks it reviewed. */
  const touch = (key: string, ai: boolean) => {
    if (ai) edited.current.add(key);
  };
  const withEdits = (n: ConsultationNote): ConsultationNote => ({
    ...n,
    editedCount: note.editedCount + edited.current.size,
  });

  const setField = (k: NoteFieldKey, value: string) => {
    touch(k, draft.fields[k].ai);
    setDraft((d) => ({ ...d, fields: { ...d.fields, [k]: { ...d.fields[k], value, reviewed: true } } }));
  };
  const confirmField = (k: NoteFieldKey) =>
    setDraft((d) => ({ ...d, fields: { ...d.fields, [k]: { ...d.fields[k], reviewed: true } } }));
  const setRx = (id: string, patch: Partial<PrescriptionItem>) => {
    const item = draft.prescription.find((p) => p.id === id);
    if (item) touch(`rx:${id}`, item.ai);
    setDraft((d) => ({
      ...d,
      prescription: d.prescription.map((p) => (p.id === id ? { ...p, ...patch, reviewed: true } : p)),
    }));
  };

  const unreviewed =
    NOTE_FIELDS.filter((k) => draft.fields[k].ai && !draft.fields[k].reviewed).length +
    (draft.followUpDate.ai && !draft.followUpDate.reviewed ? 1 : 0) +
    draft.prescription.filter((p) => p.ai && !p.reviewed).length;

  const doSign = () =>
    sign.mutate(
      { note: withEdits(draft), userId },
      {
        onSuccess: ({ plan }) => {
          setConfirmSign(false);
          toast.success(plan ? t('scribe.signedWithPlan', { name: patientName }) : t('scribe.signed'));
        },
      },
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm text-fg-muted">
          <Sparkles aria-hidden className="h-4 w-4 text-primary" />
          {unreviewed > 0 ? t('scribe.toReview', { count: unreviewed }) : t('scribe.allReviewed')}
        </p>
        <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setConfirmDiscard(true)}>
          {t('scribe.restart')}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {NOTE_FIELDS.map((k) => (
          <FieldEditor
            key={k}
            label={t(`scribe.fields.${k}`)}
            {...(k === 'assessment' ? { hint: t('scribe.assessmentHint') } : {})}
            field={draft.fields[k]}
            rows={ROWS[k]}
            onChange={(v) => setField(k, v)}
            onConfirm={() => confirmField(k)}
          />
        ))}
      </div>

      <section aria-labelledby={`${note.id}-rx`} className="space-y-3">
        <h4 id={`${note.id}-rx`} className="text-sm font-semibold text-fg">
          {t('scribe.prescription')}
        </h4>
        {draft.prescription.length === 0 && <p className="text-sm text-fg-muted">{t('scribe.noMedicines')}</p>}
        <ul className="space-y-2">
          {draft.prescription.map((p) => (
            <li
              key={p.id}
              className={cn(
                'space-y-3 rounded-xl border p-3',
                p.ai && !p.reviewed ? 'border-info/60 bg-info-soft/30' : 'bg-surface',
              )}
            >
              <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_6rem]">
                <Input
                  aria-label={t('scribe.rx.medicine')}
                  placeholder={t('scribe.rx.medicine')}
                  value={p.medicine}
                  onChange={(e) => setRx(p.id, { medicine: e.target.value })}
                />
                <Input
                  aria-label={t('scribe.rx.dose')}
                  placeholder={t('scribe.rx.dose')}
                  value={p.dose}
                  onChange={(e) => setRx(p.id, { dose: e.target.value })}
                />
                <Select
                  aria-label={t('scribe.rx.food')}
                  value={p.food}
                  options={FOOD_TIMINGS.map((f) => ({ value: f, label: t(`scribe.food.${f}`) }))}
                  onChange={(e) => setRx(p.id, { food: e.target.value as FoodTiming })}
                />
                <Input
                  type="number"
                  min={1}
                  max={365}
                  aria-label={t('scribe.rx.days')}
                  value={p.days}
                  onChange={(e) => setRx(p.id, { days: Math.max(1, Math.min(365, Number(e.target.value) || 1)) })}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <fieldset className="flex flex-wrap items-center gap-3">
                  <legend className="sr-only">{t('scribe.rx.when')}</legend>
                  {DOSE_SLOTS.map((slot) => (
                    <label key={slot} className="inline-flex items-center gap-1.5 text-sm text-fg">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[rgb(var(--color-primary))]"
                        checked={p.slots.includes(slot)}
                        onChange={(e) =>
                          setRx(p.id, {
                            slots: e.target.checked
                              ? DOSE_SLOTS.filter((s) => s === slot || p.slots.includes(s))
                              : p.slots.filter((s) => s !== slot),
                          })
                        }
                      />
                      {t(`scribe.slot.${slot}`)}
                    </label>
                  ))}
                  <span className="text-xs text-fg-subtle">{t('scribe.rx.daysValue', { count: p.days })}</span>
                </fieldset>
                <span className="flex items-center gap-1">
                  <AiMark
                    ai={p.ai}
                    reviewed={p.reviewed}
                    onConfirm={() =>
                      setDraft((d) => ({
                        ...d,
                        prescription: d.prescription.map((x) => (x.id === p.id ? { ...x, reviewed: true } : x)),
                      }))
                    }
                  />
                  <IconButton
                    icon={Trash2}
                    size="sm"
                    label={t('scribe.rx.remove', { name: p.medicine || '—' })}
                    onClick={() => {
                      touch(`rx:${p.id}`, p.ai);
                      setDraft((d) => ({ ...d, prescription: d.prescription.filter((x) => x.id !== p.id) }));
                    }}
                  />
                </span>
              </div>
            </li>
          ))}
        </ul>
        <Button
          size="sm"
          variant="outline"
          icon={Plus}
          onClick={() =>
            setDraft((d) => ({
              ...d,
              prescription: [
                ...d.prescription,
                {
                  id: newId('rx'),
                  medicine: '',
                  dose: '',
                  slots: ['morning'],
                  food: 'after',
                  days: 5,
                  ai: false,
                  reviewed: true,
                },
              ],
            }))
          }
        >
          {t('scribe.rx.add')}
        </Button>
      </section>

      <div className="max-w-xs space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor={followUpId} className="text-sm font-semibold text-fg">
            {t('scribe.fields.followUp')}
          </label>
          <AiMark
            ai={draft.followUpDate.ai}
            reviewed={draft.followUpDate.reviewed}
            onConfirm={() => setDraft((d) => ({ ...d, followUpDate: { ...d.followUpDate, reviewed: true } }))}
          />
        </div>
        <Input
          id={followUpId}
          type="date"
          value={draft.followUpDate.value}
          onChange={(e) => {
            touch('followUp', draft.followUpDate.ai);
            setDraft((d) => ({ ...d, followUpDate: { ...d.followUpDate, value: e.target.value, reviewed: true } }));
          }}
        />
      </div>

      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button icon={FileSignature} onClick={() => setConfirmSign(true)}>
          {t('scribe.sign')}
        </Button>
        <Button variant="outline" icon={Save} loading={save.isPending} onClick={() => save.mutate(withEdits(draft))}>
          {t('scribe.saveDraft')}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmSign}
        onClose={() => setConfirmSign(false)}
        onConfirm={doSign}
        loading={sign.isPending}
        title={t('scribe.signTitle')}
        body={unreviewed > 0 ? t('scribe.signBodyUnreviewed', { count: unreviewed }) : t('scribe.signBody')}
        confirmLabel={t('scribe.sign')}
      />
      <ConfirmDialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        onConfirm={() =>
          discard.mutate(note.id, {
            onSuccess: () => {
              setConfirmDiscard(false);
              onRestart();
            },
          })
        }
        tone="danger"
        loading={discard.isPending}
        title={t('scribe.restartTitle')}
        body={t('scribe.restartBody')}
        confirmLabel={t('scribe.restartConfirm')}
      />
    </div>
  );
}
