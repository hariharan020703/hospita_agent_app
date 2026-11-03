// Walk-in registration: find or register the patient, choose a department (and optionally a doctor), issue a token.
import { useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Ticket } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  Field,
  PageHeader,
  Select,
  Textarea,
  toast,
} from '@/components/ui';
import { useIssueWalkIn } from '@/hooks/queries/appointments';
import { useDepartments, useDoctors } from '@/hooks/queries/directory';
import { useLocale } from '@/hooks/useLocale';
import { todayIso } from '@/lib/clock';
import { formatTime } from '@/lib/format';
import { errorCodeOf } from '@/services';
import type { AppointmentView, Patient } from '@/types';
import { PatientPicker, SelectedPatient } from '../components/PatientPicker';
import { TokenSlip, WalkInSuccess } from '../components/WalkInSuccess';
import { phoneFromParam } from '../deskUtils';

function InlineAlert({ title, body }: { title: string; body: string }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning-soft p-3">
      <AlertTriangle aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-warning-ink" />
      <div className="min-w-0">
        <p className="font-semibold text-warning-ink">{title}</p>
        <p className="text-sm text-fg">{body}</p>
      </div>
    </div>
  );
}

function WalkInFlow({ initialQuery, onRegisterAnother }: { initialQuery: string; onRegisterAnother: () => void }) {
  const { t } = useTranslation(['desk', 'common']);
  const { lang, doctorName } = useLocale();
  const today = todayIso();
  const departments = useDepartments();
  const doctors = useDoctors();
  const issueWalkIn = useIssueWalkIn();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [departmentId, setDepartmentId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [reason, setReason] = useState('');
  const [departmentError, setDepartmentError] = useState<string | undefined>();
  const [issued, setIssued] = useState<AppointmentView | null>(null);

  const bookable = useMemo(() => (departments.data ?? []).filter((d) => d.bookable), [departments.data]);

  // Doctors in the chosen department, earliest free slot today first.
  const departmentDoctors = useMemo(() => {
    const freeToday = (d: { nextAvailable: { date: string; start: string } | null }) =>
      d.nextAvailable?.date === today ? d.nextAvailable.start : '~';
    return (doctors.data ?? [])
      .filter((d) => d.active && d.departmentId === departmentId)
      .sort((a, b) => freeToday(a).localeCompare(freeToday(b)) || a.name.localeCompare(b.name));
  }, [doctors.data, departmentId, today]);

  const errorCode = issueWalkIn.isError ? errorCodeOf(issueWalkIn.error) : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!patient) return;
    if (!departmentId) {
      setDepartmentError('selectOne');
      return;
    }
    const note = reason.trim();
    issueWalkIn.mutate(
      {
        patientId: patient.id,
        departmentId,
        ...(doctorId ? { doctorId } : {}),
        source: 'desk',
        ...(note ? { reason: note } : {}),
      },
      {
        onSuccess: (appointment) => {
          toast.success(t('walkIn.issuedToast', { token: appointment.token, name: appointment.patientName }));
          setIssued(appointment);
        },
      },
    );
  };

  return (
    <>
      <div className="no-print space-y-6">
        <PageHeader title={t('walkIn.title')} description={t('walkIn.description')} />

        {issued ? (
          <WalkInSuccess appointment={issued} onRegisterAnother={onRegisterAnother} />
        ) : (
          <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
            <Card>
              <CardHeader title={t('walkIn.patientStep')} />
              <CardBody>
                {patient ? (
                  <SelectedPatient patient={patient} onChange={() => setPatient(null)} />
                ) : (
                  <PatientPicker initialQuery={initialQuery} onSelect={setPatient} />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title={t('walkIn.visitStep')} />
              <CardBody>
                <form noValidate onSubmit={submit} className="space-y-4">
                  {!patient && (
                    <p className="rounded-lg bg-surface-sunken px-3 py-2 text-sm text-fg-muted">
                      {t('walkIn.selectPatientFirst')}
                    </p>
                  )}
                  {departments.isError ? (
                    <ErrorState error={departments.error} onRetry={() => void departments.refetch()} />
                  ) : (
                    <fieldset disabled={!patient} className="space-y-4 disabled:opacity-60">
                      <legend className="sr-only">{t('walkIn.visitStep')}</legend>
                      <Field label={t('walkIn.department')} error={departmentError} required>
                        {(c) => (
                          <Select
                            {...c}
                            value={departmentId}
                            disabled={departments.isPending}
                            onChange={(e) => {
                              setDepartmentId(e.target.value);
                              setDoctorId('');
                              setDepartmentError(undefined);
                              issueWalkIn.reset();
                            }}
                            placeholder={t('walkIn.chooseDepartment')}
                            options={bookable.map((d) => ({ value: d.id, label: d.name[lang] }))}
                          />
                        )}
                      </Field>

                      {doctors.isError ? (
                        <ErrorState error={doctors.error} onRetry={() => void doctors.refetch()} />
                      ) : (
                        <Field label={t('walkIn.doctor')}>
                          {(c) => (
                            <Select
                              {...c}
                              value={doctorId}
                              disabled={!departmentId || doctors.isPending}
                              onChange={(e) => {
                                setDoctorId(e.target.value);
                                issueWalkIn.reset();
                              }}
                              placeholder={t('walkIn.earliest')}
                              options={departmentDoctors.map((d) => ({
                                value: d.id,
                                label: [
                                  doctorName(d),
                                  t('common:room', { room: d.room }),
                                  d.nextAvailable?.date === today
                                    ? t('walkIn.nextFree', { time: formatTime(d.nextAvailable.start, lang) })
                                    : t('walkIn.noSlotsToday'),
                                ].join(' · '),
                              }))}
                            />
                          )}
                        </Field>
                      )}

                      <Field label={t('walkIn.reason')} hint={t('walkIn.reasonHint')}>
                        {(c) => (
                          <Textarea
                            {...c}
                            value={reason}
                            maxLength={200}
                            rows={2}
                            onChange={(e) => setReason(e.target.value)}
                          />
                        )}
                      </Field>

                      {errorCode === 'NO_SLOTS' && (
                        <InlineAlert
                          title={t('walkIn.noSlotsTitle')}
                          body={
                            issueWalkIn.variables?.doctorId ? t('walkIn.noSlotsDoctor') : t('walkIn.noSlotsDepartment')
                          }
                        />
                      )}
                      {errorCode === 'PATIENT_BUSY' && (
                        <InlineAlert title={t('walkIn.busyTitle')} body={t('common:errors.PATIENT_BUSY')} />
                      )}
                      {errorCode && errorCode !== 'NO_SLOTS' && errorCode !== 'PATIENT_BUSY' && (
                        <InlineAlert title={t('common:states.errorTitle')} body={t(`common:errors.${errorCode}`)} />
                      )}

                      <Button type="submit" size="lg" block icon={Ticket} loading={issueWalkIn.isPending}>
                        {t('walkIn.issueToken')}
                      </Button>
                    </fieldset>
                  )}
                </form>
              </CardBody>
            </Card>
          </div>
        )}
      </div>
      {issued && <TokenSlip appointment={issued} />}
    </>
  );
}

export default function WalkInPage() {
  const [params, setParams] = useSearchParams();
  const [round, setRound] = useState(0);
  const phone = phoneFromParam(params.get('phone'));
  return (
    <WalkInFlow
      key={`${round}-${phone}`}
      initialQuery={phone}
      onRegisterAnother={() => {
        if (params.has('phone')) setParams({}, { replace: true });
        setRound((r) => r + 1);
      }}
    />
  );
}
