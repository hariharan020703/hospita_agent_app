// Doctor's status for today: available, on a short break, or running late. Patients' estimates follow it.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Coffee, DoorOpen, Timer } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  DoctorStatusPill,
  ErrorState,
  Field,
  Input,
  RadioGroup,
  SegmentedControl,
  SkeletonList,
  toast,
} from '@/components/ui';
import { useDoctorDay, useSetDoctorStatus } from '@/hooks/queries/queue';
import { useLocale } from '@/hooks/useLocale';
import { formatTime } from '@/lib/format';
import type { DoctorDay } from '@/types';

type Mode = 'available' | 'on_break' | 'running_late';
const BREAKS = ['10', '15', '30'] as const;
type BreakLength = (typeof BREAKS)[number];
const MIN_DELAY = 5;
const MAX_DELAY = 120;

function delayError(value: string): string | undefined {
  if (!/^\d+$/.test(value.trim())) return 'number';
  const mins = Number(value);
  if (mins < MIN_DELAY) return `min:${MIN_DELAY}`;
  if (mins > MAX_DELAY) return `max:${MAX_DELAY}`;
  return undefined;
}

function StatusControl({ doctorId, day }: { doctorId: string; day: DoctorDay }) {
  const { t } = useTranslation(['doctor', 'common']);
  const { lang } = useLocale();
  const setStatus = useSetDoctorStatus();
  const [mode, setMode] = useState<Mode>(day.status === 'off' ? 'available' : day.status);
  const [breakLength, setBreakLength] = useState<BreakLength>('15');
  const [delay, setDelay] = useState(String(day.delayMins > 0 ? day.delayMins : 15));
  const [submitted, setSubmitted] = useState(false);
  const error = mode === 'running_late' && submitted ? delayError(delay) : undefined;

  const submit = () => {
    setSubmitted(true);
    if (mode === 'running_late' && delayError(delay)) return;
    setStatus.mutate(
      {
        doctorId,
        status: mode,
        ...(mode === 'on_break' ? { breakMins: Number(breakLength) } : {}),
        ...(mode === 'running_late' ? { delayMins: Number(delay) } : {}),
      },
      { onSuccess: () => toast.success(t('status.updated')) },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-fg-muted">{t('status.current')}</span>
        <DoctorStatusPill status={day.status} delayMins={day.delayMins} size="md" />
        {day.status === 'on_break' && day.breakUntil && (
          <span className="font-medium text-fg">{t('status.backAt', { time: formatTime(day.breakUntil, lang) })}</span>
        )}
      </div>

      <SegmentedControl
        label={t('status.choose')}
        value={mode}
        onChange={(next) => {
          setMode(next);
          setSubmitted(false);
        }}
        options={[
          { value: 'available', label: t('common:doctorStatus.available'), icon: DoorOpen },
          { value: 'on_break', label: t('common:doctorStatus.on_break'), icon: Coffee },
          { value: 'running_late', label: t('common:doctorStatus.running_late'), icon: Timer },
        ]}
      />

      {mode === 'on_break' && (
        <RadioGroup
          legend={t('status.breakLength')}
          name="break-length"
          layout="inline"
          value={breakLength}
          onChange={setBreakLength}
          options={BREAKS.map((mins) => ({ value: mins, label: t('common:minutesShort', { count: Number(mins) }) }))}
        />
      )}

      {mode === 'running_late' && (
        <Field label={t('status.delayLabel')} hint={t('status.delayHint')} error={error} required>
          {(c) => (
            <Input
              {...c}
              type="number"
              inputMode="numeric"
              min={MIN_DELAY}
              max={MAX_DELAY}
              step={5}
              value={delay}
              onChange={(e) => setDelay(e.target.value)}
              className="max-w-[8rem]"
            />
          )}
        </Field>
      )}

      <p className="text-sm text-fg-muted">{t('status.explain')}</p>
      <Button onClick={submit} loading={setStatus.isPending}>
        {t('status.update')}
      </Button>
    </div>
  );
}

export function StatusCard({ doctorId }: { doctorId: string }) {
  const { t } = useTranslation('doctor');
  const day = useDoctorDay(doctorId);
  return (
    <Card>
      <CardHeader title={t('status.title')} />
      <CardBody>
        {day.isPending ? (
          <SkeletonList rows={3} rowClassName="h-10" />
        ) : day.isError ? (
          <ErrorState error={day.error} onRetry={() => void day.refetch()} />
        ) : (
          // Reset the draft whenever the saved status changes (here or in another tab).
          <StatusControl
            key={`${day.data.status}|${day.data.delayMins}|${day.data.breakUntil ?? ''}`}
            doctorId={doctorId}
            day={day.data}
          />
        )}
      </CardBody>
    </Card>
  );
}
