// Request whole days of leave, or block a time window on one day. Admin approves; patients can't book blocked time.
import { useId } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';
import { Button, DatePicker, Drawer, Field, Input, RadioGroup, Textarea, toast } from '@/components/ui';
import { useRequestLeave } from '@/hooks/queries/directory';
import { addDaysIso } from '@/lib/time';
import { LEAVE_KINDS, leaveRequestSchema, type LeaveRequestValues } from '@/types';
import type { z } from 'zod';

type LeaveRequestInput = z.input<typeof leaveRequestSchema>;

export function LeaveRequestDrawer({
  doctorId,
  today,
  onClose,
}: {
  doctorId: string;
  today: string;
  onClose: () => void;
}) {
  const { t } = useTranslation(['doctor', 'common']);
  const formId = useId();
  const requestLeave = useRequestLeave();
  const tomorrow = addDaysIso(today, 1);
  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitted },
  } = useForm<LeaveRequestInput, unknown, LeaveRequestValues>({
    resolver: zodResolver(leaveRequestSchema),
    defaultValues: { kind: 'leave', from: tomorrow, to: tomorrow, startTime: '', endTime: '', reason: '' },
  });
  const kind = useWatch({ control, name: 'kind' });
  const from = useWatch({ control, name: 'from' });

  const onSubmit = (values: LeaveRequestValues) =>
    requestLeave.mutate(
      { doctorId, values: values.kind === 'block' ? { ...values, to: values.from } : values },
      {
        onSuccess: () => {
          toast.success(t('leave.requested'), t('leave.requestedBody'));
          onClose();
        },
      },
    );

  return (
    <Drawer
      open
      onClose={onClose}
      width="md"
      dismissible={!requestLeave.isPending}
      title={t('leave.formTitle')}
      description={t('leave.formDescription')}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={requestLeave.isPending}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" form={formId} icon={Send} loading={requestLeave.isPending}>
            {t('leave.submit')}
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-5">
        <Controller
          control={control}
          name="kind"
          render={({ field }) => (
            <RadioGroup
              legend={t('leave.kind')}
              name="leave-kind"
              value={field.value}
              onChange={(next) => {
                field.onChange(next);
                if (next === 'block') setValue('to', getValues('from'));
              }}
              error={errors.kind?.message}
              options={LEAVE_KINDS.map((k) => ({
                value: k,
                label: t(`leave.kinds.${k}`),
                description: t(`leave.kindHints.${k}`),
              }))}
            />
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name="from"
            render={({ field }) => (
              <Field label={kind === 'block' ? t('leave.date') : t('leave.from')} error={errors.from?.message} required>
                {(c) => (
                  <DatePicker
                    control={c}
                    value={field.value || null}
                    min={today}
                    onChange={(iso) => {
                      field.onChange(iso);
                      if (kind === 'block' || getValues('to') < iso) {
                        setValue('to', iso, { shouldValidate: isSubmitted });
                      }
                    }}
                  />
                )}
              </Field>
            )}
          />
          {kind === 'leave' && (
            <Controller
              control={control}
              name="to"
              render={({ field }) => (
                <Field label={t('leave.to')} error={errors.to?.message} required>
                  {(c) => (
                    <DatePicker control={c} value={field.value || null} min={from || today} onChange={field.onChange} />
                  )}
                </Field>
              )}
            />
          )}
        </div>

        {kind === 'block' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('leave.startTime')} error={errors.startTime?.message} required>
              {(c) => <Input {...c} type="time" step={300} {...register('startTime')} />}
            </Field>
            <Field label={t('leave.endTime')} error={errors.endTime?.message} required>
              {(c) => <Input {...c} type="time" step={300} {...register('endTime')} />}
            </Field>
          </div>
        )}

        <Field label={t('leave.reason')} hint={t('leave.reasonHint')} error={errors.reason?.message} required>
          {(c) => <Textarea {...c} rows={3} maxLength={200} {...register('reason')} />}
        </Field>
      </form>
    </Drawer>
  );
}
