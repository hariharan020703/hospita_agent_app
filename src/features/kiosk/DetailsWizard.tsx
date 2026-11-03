// Walk-in patient details, one question per screen with large touch controls: name, age (keypad), gender, mobile
// number (keypad), then a review. Nothing needs a physical keyboard except the name, which uses the screen keyboard.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Pencil, Ticket, TriangleAlert } from 'lucide-react';
import { Button, Spinner } from '@/components/ui';
import { useLocale } from '@/hooks/useLocale';
import { cn } from '@/lib/cn';
import { formatPhone } from '@/lib/format';
import { GENDERS, type Department, type Gender } from '@/types';
import { NumericKeypad } from './Keypad';
import { BackButton, Notice, ScreenTitle } from './ui';

export interface WalkInDetails {
  name: string;
  age: number;
  gender: Gender;
  phone: string;
}

interface Draft {
  name: string;
  age: string;
  gender: Gender | null;
  phone: string;
}

const INPUT_STEPS = ['name', 'age', 'gender', 'phone'] as const;
type InputStep = (typeof INPUT_STEPS)[number];
type Step = InputStep | 'review';

const PHONE_PATTERN = /^[6-9]\d{9}$/;
const AGE_PATTERN = /^\d{1,3}$/;

const VALID: Record<InputStep, (d: Draft) => boolean> = {
  name: (d) => d.name.trim().length >= 2,
  age: (d) => AGE_PATTERN.test(d.age) && Number(d.age) <= 120,
  gender: (d) => d.gender !== null,
  phone: (d) => PHONE_PATTERN.test(d.phone),
};

const spell = (value: string) => value.split('').join(' ');

/** "98765 4····": typed digits plus placeholders, grouped like a phone number. */
function phoneDraftDisplay(phone: string): string {
  const padded = phone.padEnd(10, '·');
  return `${padded.slice(0, 5)} ${padded.slice(5)}`;
}

export function DetailsWizard({
  department,
  initialAge,
  busy,
  error,
  onBack,
  onSubmit,
}: {
  department: Department | undefined;
  initialAge: number | undefined;
  busy: boolean;
  /** Inline error from creating the token (already rendered). */
  error: ReactNode;
  onBack: () => void;
  onSubmit: (details: WalkInDetails) => void;
}) {
  const { t } = useTranslation(['kiosk', 'common']);
  const { l } = useLocale();
  const [draft, setDraft] = useState<Draft>({
    name: '',
    age: initialAge === undefined ? '' : String(initialAge),
    gender: null,
    phone: '',
  });
  const [step, setStep] = useState<Step>('name');
  const [showError, setShowError] = useState(false);
  const [fromReview, setFromReview] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Bring up the on-screen keyboard for the name.
    if (step === 'name') nameRef.current?.focus();
  }, [step]);

  const index = step === 'review' ? INPUT_STEPS.length : INPUT_STEPS.indexOf(step);

  const update = (patch: Partial<Draft> | ((d: Draft) => Partial<Draft>)) => {
    setShowError(false);
    setDraft((d) => ({ ...d, ...(typeof patch === 'function' ? patch(d) : patch) }));
  };

  const go = (target: Step) => {
    setShowError(false);
    setStep(target);
  };

  const next = () => {
    if (step === 'review') return;
    if (!VALID[step](draft)) {
      setShowError(true);
      return;
    }
    if (fromReview) {
      setFromReview(false);
      go('review');
      return;
    }
    go(INPUT_STEPS[index + 1] ?? 'review');
  };

  const back = () => {
    if (fromReview) {
      setFromReview(false);
      go('review');
      return;
    }
    if (step === 'name') {
      onBack();
      return;
    }
    go(step === 'review' ? 'phone' : (INPUT_STEPS[index - 1] ?? 'name'));
  };

  const edit = (target: InputStep) => {
    setFromReview(true);
    go(target);
  };

  const submit = () => {
    if (busy || !draft.gender || !INPUT_STEPS.every((k) => VALID[k](draft))) return;
    onSubmit({
      name: draft.name.trim().replace(/\s+/g, ' '),
      age: Number(draft.age),
      gender: draft.gender,
      phone: draft.phone,
    });
  };

  type KeypadField = 'age' | 'phone';
  const patchOf = (field: KeypadField, value: string): Partial<Draft> =>
    field === 'age' ? { age: value } : { phone: value };
  const typeDigit = (field: KeypadField, max: number) => (digit: string) =>
    update((d) => {
      const current = d[field];
      if (current.length >= max) return {};
      // A leading zero is replaced, so "0" then "7" gives an age of 7.
      return patchOf(field, field === 'age' && current === '0' ? digit : current + digit);
    });
  const backspace = (field: KeypadField) => () => update((d) => patchOf(field, d[field].slice(0, -1)));
  const clear = (field: KeypadField) => () => update(patchOf(field, ''));

  let body: ReactNode;
  switch (step) {
    case 'name':
      body = (
        <div className="max-w-3xl space-y-3">
          <input
            ref={nameRef}
            id="kiosk-name"
            value={draft.name}
            onChange={(e) => update({ name: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') next();
            }}
            maxLength={80}
            autoComplete="off"
            autoCapitalize="words"
            spellCheck={false}
            enterKeyHint="next"
            aria-labelledby="kiosk-details-title"
            aria-describedby="kiosk-name-hint"
            aria-invalid={showError || undefined}
            placeholder={t('details.name.placeholder')}
            className="h-14 w-full rounded-2xl border-2 border-border-strong bg-surface px-6 text-xl text-fg placeholder:text-fg-subtle focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/30"
          />
          <p id="kiosk-name-hint" className="text-base text-fg-muted">
            {t('details.name.hint')}
          </p>
        </div>
      );
      break;
    case 'age':
      body = (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <div className="space-y-3">
            <div
              aria-hidden
              className="flex min-h-20 items-baseline justify-center gap-3 rounded-3xl border-2 border-primary/40 bg-surface px-6 py-6"
            >
              <span className="text-5xl font-extrabold text-fg tabular">{draft.age || '–'}</span>
              <span className="text-lg text-fg-muted">{t('details.age.unit')}</span>
            </div>
            <p aria-live="polite" className="sr-only">
              {draft.age ? t('details.age.value', { count: Number(draft.age) }) : t('keypad.empty')}
            </p>
            <p className="text-base text-fg-muted">{t('details.age.hint')}</p>
          </div>
          <NumericKeypad
            label={t('details.age.keypad')}
            onDigit={typeDigit('age', 3)}
            onBackspace={backspace('age')}
            onClear={clear('age')}
            className="max-w-md"
          />
        </div>
      );
      break;
    case 'gender':
      body = (
        <div role="group" aria-labelledby="kiosk-details-title" className="grid gap-4 md:grid-cols-3">
          {GENDERS.map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={draft.gender === g}
              onClick={() => update({ gender: g })}
              className={cn(
                'min-h-20 rounded-3xl border-4 px-6 py-6 text-xl font-bold transition-colors',
                draft.gender === g
                  ? 'border-primary bg-primary text-primary-fg'
                  : 'border-border-strong bg-surface text-fg hover:border-primary hover:bg-primary-soft',
              )}
            >
              {t(`common:gender.${g}`)}
            </button>
          ))}
        </div>
      );
      break;
    case 'phone':
      body = (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <div className="space-y-3">
            <div
              aria-hidden
              className="flex min-h-20 items-center justify-center rounded-3xl border-2 border-primary/40 bg-surface px-6 py-6"
            >
              <span className="font-mono text-4xl font-bold tracking-wider text-fg tabular">
                {phoneDraftDisplay(draft.phone)}
              </span>
            </div>
            <p aria-live="polite" className="sr-only">
              {draft.phone ? spell(draft.phone) : t('keypad.empty')}
            </p>
            <p className="text-base text-fg-muted">{t('details.phone.hint')}</p>
          </div>
          <NumericKeypad
            label={t('details.phone.keypad')}
            onDigit={typeDigit('phone', 10)}
            onBackspace={backspace('phone')}
            onClear={clear('phone')}
            className="max-w-md"
          />
        </div>
      );
      break;
    case 'review': {
      const rows: { key: InputStep; label: string; value: string }[] = [
        { key: 'name', label: t('details.review.name'), value: draft.name.trim() },
        { key: 'age', label: t('details.review.age'), value: t('details.age.value', { count: Number(draft.age) }) },
        {
          key: 'gender',
          label: t('details.review.gender'),
          value: draft.gender ? t(`common:gender.${draft.gender}`) : '',
        },
        { key: 'phone', label: t('details.review.phone'), value: formatPhone(draft.phone) },
      ];
      body = (
        <dl className="divide-y rounded-3xl border-2 bg-surface">
          {rows.map(({ key, label, value }) => (
            <div key={key} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-6 py-4">
              <dt className="w-full text-base text-fg-muted sm:w-56">{label}</dt>
              <dd className="min-w-0 flex-1 break-words text-xl font-bold text-fg">{value}</dd>
              <dd>
                <Button
                  variant="outline"
                  size="lg"
                  icon={Pencil}
                  disabled={busy}
                  onClick={() => edit(key)}
                  aria-label={t('details.review.changeField', { field: label })}
                >
                  {t('details.review.change')}
                </Button>
              </dd>
            </div>
          ))}
        </dl>
      );
      break;
    }
  }

  const errorText = step === 'review' ? '' : t(`details.${step}.error`);

  return (
    <section aria-labelledby="kiosk-details-title" className="space-y-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-base text-fg-muted">
          <p>
            {step === 'review'
              ? t('details.reviewStep')
              : t('details.progress', { step: index + 1, total: INPUT_STEPS.length })}
          </p>
          {department && <p>{t('details.tokenFor', { department: l(department.name) })}</p>}
        </div>
        <div aria-hidden className="grid grid-cols-5 gap-2">
          {[...INPUT_STEPS, 'review'].map((s, i) => (
            <span key={s} className={cn('h-2.5 rounded-full', i <= index ? 'bg-primary' : 'bg-surface-sunken')} />
          ))}
        </div>
        <ScreenTitle key={step} id="kiosk-details-title" focusOnMount={step !== 'name'}>
          {t(`details.${step}.title`)}
        </ScreenTitle>
      </div>

      {body}

      {showError && errorText && (
        <Notice tone="warning" role="alert" icon={TriangleAlert}>
          <p>{errorText}</p>
        </Notice>
      )}
      {error}
      {busy && (
        <p role="status" className="flex items-center gap-3 text-base text-fg-muted">
          <Spinner className="h-6 w-6" />
          {t('details.working')}
        </p>
      )}

      <div className="flex flex-wrap justify-between gap-4">
        <BackButton onClick={back} />
        {step === 'review' ? (
          <Button size="lg" icon={Ticket} loading={busy} onClick={submit} className="min-w-64">
            {t('details.review.submit')}
          </Button>
        ) : (
          <Button size="lg" iconRight={ArrowRight} onClick={next} className="min-w-48">
            {t('details.next')}
          </Button>
        )}
      </div>
    </section>
  );
}
