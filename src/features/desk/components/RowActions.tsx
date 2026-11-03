// Visit actions shared by the doctor cards and the "all patients" table: check in, move to another doctor, no-show.
// One provider owns the mutations and dialogs so each row only renders buttons.
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRightLeft, UserCheck, UserX } from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  controlClasses,
  ErrorState,
  Field,
  IconButton,
  Modal,
  SkeletonList,
  toast,
} from '@/components/ui';
import { useVisitActions } from '@/hooks/queries/appointments';
import { useDepartments, useDoctors } from '@/hooks/queries/directory';
import { useQueueBoard } from '@/hooks/queries/queue';
import { useLocale } from '@/hooks/useLocale';
import { todayIso } from '@/lib/clock';
import type { DoctorListItem } from '@/services';
import type { AppointmentView } from '@/types';
import { canCheckIn, isOpenVisit } from '../deskUtils';

interface RowActionsValue {
  today: string;
  checkingInId: string | null;
  checkIn: (appointment: AppointmentView) => void;
  requestMove: (appointment: AppointmentView) => void;
  requestNoShow: (appointment: AppointmentView) => void;
}

const RowActionsContext = createContext<RowActionsValue | null>(null);

function useRowActions(): RowActionsValue {
  const value = useContext(RowActionsContext);
  if (!value) throw new Error('RowActionButtons must be rendered inside <RowActionsProvider>');
  return value;
}

export function RowActionsProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation(['desk', 'common']);
  const { doctorName } = useLocale();
  const { checkIn, markNoShow, reassign } = useVisitActions();
  const [moving, setMoving] = useState<AppointmentView | null>(null);
  const [noShow, setNoShow] = useState<AppointmentView | null>(null);
  const today = todayIso();

  const checkingInId = checkIn.isPending ? (checkIn.variables ?? null) : null;
  const mutateCheckIn = checkIn.mutate;

  const value = useMemo<RowActionsValue>(
    () => ({
      today,
      checkingInId,
      checkIn: (appointment) =>
        mutateCheckIn(appointment.id, {
          onSuccess: (updated) =>
            toast.success(t('actions.checkedInToast', { name: updated.patientName, token: updated.token })),
        }),
      requestMove: setMoving,
      requestNoShow: setNoShow,
    }),
    [today, checkingInId, mutateCheckIn, t],
  );

  return (
    <RowActionsContext.Provider value={value}>
      {children}
      {moving && (
        <MoveDoctorDialog
          appointment={moving}
          saving={reassign.isPending}
          onClose={() => setMoving(null)}
          onConfirm={(doctorId) =>
            reassign.mutate(
              { id: moving.id, doctorId },
              {
                onSuccess: (updated) => {
                  toast.success(
                    t('move.doneToast', {
                      name: updated.patientName,
                      doctor: doctorName(updated),
                      token: updated.token,
                    }),
                  );
                  setMoving(null);
                },
              },
            )
          }
        />
      )}
      {noShow && (
        <ConfirmDialog
          open
          tone="danger"
          onClose={() => setNoShow(null)}
          title={t('noShow.title')}
          body={t('noShow.body', { name: noShow.patientName, token: noShow.token, doctor: doctorName(noShow) })}
          confirmLabel={t('noShow.confirm')}
          loading={markNoShow.isPending}
          onConfirm={() =>
            markNoShow.mutate(noShow.id, {
              onSuccess: (updated) => {
                toast.success(t('noShow.doneToast', { name: updated.patientName }));
                setNoShow(null);
              },
            })
          }
        />
      )}
    </RowActionsContext.Provider>
  );
}

/** Buttons for one visit; renders nothing once the consultation has started or the visit is closed. */
export function RowActionButtons({ appointment: a }: { appointment: AppointmentView }) {
  const { t } = useTranslation('desk');
  const actions = useRowActions();
  if (!isOpenVisit(a)) return null;
  const names = { name: a.patientName, token: a.token };
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
      {canCheckIn(a, actions.today) && (
        <Button
          size="sm"
          variant="secondary"
          icon={UserCheck}
          loading={actions.checkingInId === a.id}
          aria-label={t('actions.checkInFor', names)}
          onClick={() => actions.checkIn(a)}
        >
          {t('actions.checkIn')}
        </Button>
      )}
      <IconButton
        size="sm"
        icon={ArrowRightLeft}
        label={t('actions.moveFor', names)}
        onClick={() => actions.requestMove(a)}
      />
      <IconButton
        size="sm"
        icon={UserX}
        label={t('actions.noShowFor', names)}
        onClick={() => actions.requestNoShow(a)}
      />
    </div>
  );
}

function MoveDoctorDialog({
  appointment,
  saving,
  onClose,
  onConfirm,
}: {
  appointment: AppointmentView;
  saving: boolean;
  onClose: () => void;
  onConfirm: (doctorId: string) => void;
}) {
  const { t } = useTranslation(['desk', 'common']);
  const { l, doctorName } = useLocale();
  const doctors = useDoctors();
  const departments = useDepartments();
  const board = useQueueBoard();
  const [doctorId, setDoctorId] = useState('');
  const [error, setError] = useState<string | undefined>();

  const { same, others } = useMemo(() => {
    const bookable = new Map((departments.data ?? []).filter((d) => d.bookable).map((d) => [d.id, d]));
    const order = (d: DoctorListItem) => bookable.get(d.departmentId)?.sortOrder ?? 0;
    const candidates = (doctors.data ?? []).filter(
      (d) => d.active && d.id !== appointment.doctorId && bookable.has(d.departmentId),
    );
    return {
      same: candidates
        .filter((d) => d.departmentId === appointment.departmentId)
        .sort((a, b) => a.name.localeCompare(b.name)),
      others: candidates
        .filter((d) => d.departmentId !== appointment.departmentId)
        .sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name)),
    };
  }, [doctors.data, departments.data, appointment.doctorId, appointment.departmentId]);

  const optionLabel = (d: DoctorListItem, withDepartment: boolean) => {
    const queue = board.data?.find((q) => q.doctorId === d.id);
    const parts = [doctorName(d)];
    if (withDepartment) parts.push(l(departments.data?.find((dep) => dep.id === d.departmentId)?.name));
    parts.push(t('common:room', { room: d.room }));
    if (queue) {
      parts.push(t('move.waiting', { count: queue.waiting.length }));
      if (queue.day.status !== 'available') parts.push(t(`common:doctorStatus.${queue.day.status}`));
    }
    return parts.filter(Boolean).join(' · ');
  };

  const submit = () => {
    if (!doctorId) {
      setError('selectOne');
      return;
    }
    onConfirm(doctorId);
  };

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!saving}
      title={t('move.title')}
      description={t('move.body', {
        name: appointment.patientName,
        token: appointment.token,
        doctor: doctorName(appointment),
      })}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t('common:actions.cancel')}
          </Button>
          <Button icon={ArrowRightLeft} loading={saving} onClick={submit} disabled={doctors.isError}>
            {t('move.confirm')}
          </Button>
        </>
      }
    >
      {doctors.isPending || departments.isPending ? (
        <SkeletonList rows={1} rowClassName="h-11" />
      ) : doctors.isError ? (
        <ErrorState error={doctors.error} onRetry={() => void doctors.refetch()} />
      ) : same.length + others.length === 0 ? (
        <p className="text-sm text-fg-muted">{t('move.noDoctors')}</p>
      ) : (
        <Field label={t('move.doctor')} hint={t('move.hint')} error={error} required>
          {(control) => (
            <select
              {...control}
              value={doctorId}
              onChange={(e) => {
                setDoctorId(e.target.value);
                setError(undefined);
              }}
              className={controlClasses('appearance-auto pr-8')}
            >
              <option value="">{t('move.choose')}</option>
              {same.length > 0 && (
                <optgroup label={t('move.sameDepartment')}>
                  {same.map((d) => (
                    <option key={d.id} value={d.id}>
                      {optionLabel(d, false)}
                    </option>
                  ))}
                </optgroup>
              )}
              {others.length > 0 && (
                <optgroup label={t('move.otherDepartments')}>
                  {others.map((d) => (
                    <option key={d.id} value={d.id}>
                      {optionLabel(d, true)}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          )}
        </Field>
      )}
    </Modal>
  );
}
