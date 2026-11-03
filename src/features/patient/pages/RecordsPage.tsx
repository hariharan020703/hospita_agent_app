// Health records: the patient uploads old prescriptions, lab reports and discharge summaries (camera or files,
// several at once, local preview only). The medical records agent reads each one; the patient checks and corrects
// the result before it is saved and shared with the doctor in the pre-visit summary.
import { useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, ClipboardCheck, Eye, FileStack, FileText, Trash2, TriangleAlert, Upload } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Modal,
  SkeletonCard,
  SkeletonList,
} from '@/components/ui';
import {
  useAgentActive,
  useDeleteRecord,
  useExtractRecord,
  useRecords,
  useRecordSamples,
  useSaveRecord,
} from '@/hooks/queries/agents';
import { useLocale } from '@/hooks/useLocale';
import { newId } from '@/lib/id';
import { formatDate } from '@/lib/format';
import { imagePreview, isPdf } from '@/lib/image';
import { errorCodeOf } from '@/services';
import type { MedicalRecord, RecordUpload } from '@/types';
import { DocumentImage, ProcessingView, RecordFacts, RecordReview } from '../components/records';
import { usePatientContext } from '../usePatientContext';

interface Pending {
  key: string;
  fileName: string;
  fileType: 'image' | 'pdf';
  previewUrl?: string;
  sampleId?: string;
}

function RecordCard({
  record,
  onView,
  onDelete,
  onCheck,
}: {
  record: MedicalRecord;
  onView: () => void;
  onDelete: () => void;
  onCheck?: () => void;
}) {
  const { t } = useTranslation(['patient', 'triage']);
  const { lang } = useLocale();
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border bg-surface p-3">
      <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-sunken">
        {record.imageUrl ? (
          <img src={record.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <FileText aria-hidden className="h-6 w-6 text-fg-muted" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-fg">{t(`triage:recordKinds.${record.kind.value}`)}</p>
        <p className="text-sm text-fg-muted">
          {[
            /^\d{4}-\d{2}-\d{2}$/.test(record.date.value) ? formatDate(record.date.value, lang) : '',
            record.hospital.value,
            t('records.list.medicines', { count: record.medicines.length }),
            t('records.list.tests', { count: record.tests.length }),
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {onCheck ? (
          <Button size="sm" icon={ClipboardCheck} onClick={onCheck}>
            {t('records.list.continue')}
          </Button>
        ) : (
          <Button size="sm" variant="outline" icon={Eye} onClick={onView}>
            {t('records.list.view')}
          </Button>
        )}
        <Button size="sm" variant="dangerOutline" icon={Trash2} onClick={onDelete}>
          {t('records.list.delete')}
        </Button>
      </div>
    </li>
  );
}

function Uploads() {
  const { t } = useTranslation(['patient', 'triage', 'common']);
  const { l } = useLocale();
  const { session, userId } = usePatientContext();
  const patientId = session?.patientId ?? '';
  const records = useRecords(patientId ? [patientId] : []);
  const samples = useRecordSamples();
  const extract = useExtractRecord();
  const save = useSaveRecord();
  const remove = useDeleteRecord();
  const [queue, setQueue] = useState<Pending[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [failed, setFailed] = useState<unknown>(null);
  const [viewing, setViewing] = useState<MedicalRecord | null>(null);
  const [deleting, setDeleting] = useState<MedicalRecord | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);

  const uploadOf = (item: Pending): RecordUpload => ({
    patientId,
    userId,
    fileName: item.fileName,
    fileType: item.fileType,
    ...(item.previewUrl && !item.sampleId ? { imageUrl: item.previewUrl } : {}),
    ...(item.sampleId ? { sampleId: item.sampleId } : {}),
  });

  const read = (item: Pending) => {
    setFailed(null);
    extract.mutate(uploadOf(item), { onSuccess: (record) => setReviewing(record.id), onError: setFailed });
  };

  const enqueue = (items: Pending[]) => {
    if (items.length === 0) return;
    const idle = queue.length === 0;
    setQueue([...queue, ...items]);
    setProgress(idle ? { done: 0, total: items.length } : { ...progress, total: progress.total + items.length });
    if (idle && items[0]) read(items[0]);
  };

  /** After the current document is saved, discarded or skipped: on to the next one. */
  const next = () => {
    setReviewing(null);
    setFailed(null);
    if (queue.length === 0) return;
    const rest = queue.slice(1);
    setQueue(rest);
    setProgress((p) => ({ ...p, done: p.done + 1 }));
    if (rest[0]) read(rest[0]);
  };

  const onFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = '';
    const items = await Promise.all(
      files.map(async (file): Promise<Pending> => {
        const pdf = isPdf(file);
        const previewUrl = pdf ? undefined : await imagePreview(file).catch(() => undefined);
        return {
          key: newId('up'),
          fileName: file.name,
          fileType: pdf ? 'pdf' : 'image',
          ...(previewUrl ? { previewUrl } : {}),
        };
      }),
    );
    enqueue(items);
  };

  const current = queue[0];
  const reviewRecord =
    records.data?.find((r) => r.id === reviewing) ?? (extract.data?.id === reviewing ? extract.data : undefined);
  const pending = records.data?.filter((r) => r.status === 'review' && r.id !== reviewing) ?? [];
  const saved = records.data?.filter((r) => r.status === 'saved') ?? [];

  if (reviewing && reviewRecord) {
    return (
      <div className="space-y-3">
        {progress.total > 1 && (
          <p className="text-sm font-semibold text-fg-muted">
            {t('records.upload.queue', { done: progress.done + 1, total: progress.total })}
          </p>
        )}
        <RecordReview
          key={reviewRecord.id}
          record={reviewRecord}
          saving={save.isPending}
          discarding={remove.isPending}
          onSave={(values) => save.mutate({ id: reviewRecord.id, values }, { onSuccess: next })}
          onDiscard={() => remove.mutate(reviewRecord.id, { onSuccess: next })}
        />
      </div>
    );
  }

  if (current && (extract.isPending || failed !== null)) {
    const preview = (
      <DocumentImage
        record={{ imageUrl: current.previewUrl, fileName: current.fileName, fileType: current.fileType }}
        className="max-h-72"
      />
    );
    return (
      <div className="space-y-3">
        {progress.total > 1 && (
          <p className="text-sm font-semibold text-fg-muted">
            {t('records.upload.queue', { done: progress.done + 1, total: progress.total })}
          </p>
        )}
        {failed !== null ? (
          <Card>
            <CardBody className="space-y-3">
              <p role="alert" className="flex items-center gap-2 font-semibold text-warning-ink">
                <TriangleAlert aria-hidden className="h-5 w-5" />
                {t('records.processing.failed')}
              </p>
              <p className="text-sm text-fg-muted">{t(`common:errors.${errorCodeOf(failed)}`)}</p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => read(current)}>{t('common:actions.retry')}</Button>
                <Button variant="outline" onClick={next}>
                  {t('records.processing.skip')}
                </Button>
              </div>
            </CardBody>
          </Card>
        ) : (
          <ProcessingView key={current.key} preview={preview} done={false} />
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
      <div className="space-y-6">
        <Card>
          <CardHeader title={t('records.upload.title')} />
          <CardBody className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button icon={Camera} onClick={() => cameraRef.current?.click()}>
                {t('records.upload.camera')}
              </Button>
              <Button variant="outline" icon={Upload} onClick={() => filesRef.current?.click()}>
                {t('records.upload.files')}
              </Button>
            </div>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => void onFiles(e)}
            />
            <input
              ref={filesRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => void onFiles(e)}
            />
            <p className="text-sm text-fg-muted">{t('records.upload.hint')}</p>
            {samples.data && samples.data.length > 0 && (
              <div className="space-y-2 border-t pt-4">
                <p className="text-sm font-semibold text-fg">{t('records.upload.samples')}</p>
                <ul className="grid gap-2 sm:grid-cols-3">
                  {samples.data.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() =>
                          enqueue([
                            {
                              key: newId('up'),
                              fileName: s.title.en,
                              fileType: 'image',
                              previewUrl: s.imageUrl,
                              sampleId: s.id,
                            },
                          ])
                        }
                        className="flex w-full items-center gap-3 rounded-xl border bg-surface p-2 text-left text-sm hover:border-primary/60 hover:bg-primary-soft/30"
                      >
                        <img src={s.imageUrl} alt="" className="h-14 w-11 shrink-0 rounded border object-cover" />
                        <span className="font-medium text-fg">{l(s.title)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardBody>
        </Card>

        {pending.length > 0 && (
          <Card>
            <CardHeader title={t('records.list.pending')} />
            <CardBody>
              <ul className="space-y-2">
                {pending.map((r) => (
                  <RecordCard
                    key={r.id}
                    record={r}
                    onView={() => setViewing(r)}
                    onCheck={() => setReviewing(r.id)}
                    onDelete={() => setDeleting(r)}
                  />
                ))}
              </ul>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader title={t('records.list.title')} description={t('records.list.sharedNote')} />
          <CardBody>
            {records.isPending && patientId ? (
              <SkeletonList rows={3} />
            ) : records.isError ? (
              <ErrorState error={records.error} onRetry={() => void records.refetch()} />
            ) : saved.length === 0 ? (
              <EmptyState icon={FileStack} title={t('records.list.empty')} body={t('records.list.emptyBody')} />
            ) : (
              <ul className="space-y-2">
                {saved.map((r) => (
                  <RecordCard key={r.id} record={r} onView={() => setViewing(r)} onDelete={() => setDeleting(r)} />
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <aside className="hidden rounded-xl border bg-surface p-5 shadow-xs lg:block">
        <h2 className="font-semibold text-fg">{t('records.how.title')}</h2>
        <ol className="mt-3 space-y-3 text-sm text-fg">
          {(['upload', 'read', 'check', 'share'] as const).map((s, i) => (
            <li key={s} className="flex gap-3">
              <Badge tone="primary">{i + 1}</Badge>
              <span>{t(`records.how.${s}`)}</span>
            </li>
          ))}
        </ol>
      </aside>

      <Modal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        size="xl"
        title={viewing ? t(`triage:recordKinds.${viewing.kind.value}`) : ''}
      >
        {viewing && (
          <div className="grid gap-4 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
            <DocumentImage record={viewing} />
            <RecordFacts record={viewing} />
          </div>
        )}
      </Modal>
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
        tone="danger"
        loading={remove.isPending}
        title={t('records.list.deleteTitle')}
        body={t('records.list.deleteBody')}
        confirmLabel={t('records.list.delete')}
      />
    </div>
  );
}

export default function RecordsPage() {
  const { t } = useTranslation('patient');
  const active = useAgentActive('records');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fg">{t('records.title')}</h1>
        <p className="text-fg-muted">{t('records.subtitle')}</p>
      </div>
      {active === undefined ? (
        <SkeletonCard />
      ) : active ? (
        <Uploads />
      ) : (
        <EmptyState icon={FileStack} title={t('records.paused')} body={t('records.pausedBody')} />
      )}
    </div>
  );
}
