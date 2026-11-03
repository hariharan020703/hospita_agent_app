// Doctor search with filters kept in the URL (department, language, gender, fee, name, sort).
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SearchX, Sparkles } from 'lucide-react';
import { Button, EmptyState, Field, QueryBoundary, SearchInput, Select, SkeletonList } from '@/components/ui';
import { DoctorCard } from '@/components/domain/Cards';
import { useDepartments, useDoctors } from '@/hooks/queries/directory';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useLocale } from '@/hooks/useLocale';
import { formatCurrency } from '@/lib/format';
import type { DoctorFilters } from '@/types';
import { usePatientContext } from '../usePatientContext';

const FEES = [300, 500, 700];

export default function DoctorsPage() {
  const { t } = useTranslation(['patient', 'common']);
  const { lang, l } = useLocale();
  const { today } = usePatientContext();
  const [params, setParams] = useSearchParams();
  const departments = useDepartments();
  const bookable = useMemo(() => departments.data?.filter((d) => d.bookable) ?? [], [departments.data]);

  const dept = params.get('dept') ?? '';
  const language = params.get('lang') ?? '';
  const gender = params.get('gender') ?? '';
  const fee = params.get('fee') ?? '';
  const sort = params.get('sort') === 'fee' ? 'fee' : 'next';
  const triage = params.get('triage');
  const q = params.get('q') ?? '';
  const debouncedQ = useDebouncedValue(q);

  const set = (key: string, value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

  const filters: DoctorFilters = {
    ...(dept ? { departmentId: dept } : {}),
    ...(language === 'ta' || language === 'en' ? { lang: language } : {}),
    ...(gender === 'female' || gender === 'male' ? { gender } : {}),
    ...(fee ? { maxFee: Number(fee) } : {}),
    ...(debouncedQ.trim() ? { q: debouncedQ.trim() } : {}),
  };
  const doctors = useDoctors(filters);
  const bookableIds = new Set(bookable.map((d) => d.id));

  const sorted = (doctors.data ?? [])
    .filter((d) => bookableIds.has(d.departmentId))
    .sort((a, b) => {
      if (sort === 'fee') return a.fee - b.fee;
      const ak = a.nextAvailable ? `${a.nextAvailable.date} ${a.nextAvailable.start}` : '~';
      const bk = b.nextAvailable ? `${b.nextAvailable.date} ${b.nextAvailable.start}` : '~';
      return ak.localeCompare(bk);
    });

  const hasFilters = Boolean(dept || language || gender || fee || q);
  const recommended = triage && dept ? bookable.find((d) => d.id === dept) : undefined;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-fg">{t('doctors.title')}</h1>
      {recommended && (
        <p className="flex items-center gap-2 rounded-lg bg-primary-soft px-3 py-2 text-sm font-medium text-primary-ink">
          <Sparkles aria-hidden className="h-4 w-4 shrink-0" />
          {t('doctors.recommendedFor', { department: l(recommended.name) })}
        </p>
      )}
      {/* Large screens: filters in a sticky side panel, results beside them. */}
      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
        <div className="space-y-3 rounded-xl border bg-surface p-4 lg:sticky lg:top-24">
          <SearchInput value={q} onChange={(v) => set('q', v)} label={t('doctors.search')} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Field label={t('doctors.department')}>
              {(c) => (
                <Select
                  {...c}
                  value={dept}
                  onChange={(e) => set('dept', e.target.value)}
                  placeholder={t('doctors.allDepartments')}
                  options={bookable.map((d) => ({ value: d.id, label: d.name[lang] }))}
                />
              )}
            </Field>
            <Field label={t('doctors.language')}>
              {(c) => (
                <Select
                  {...c}
                  value={language}
                  onChange={(e) => set('lang', e.target.value)}
                  placeholder={t('doctors.anyLanguage')}
                  options={[
                    { value: 'ta', label: t('common:language.ta') },
                    { value: 'en', label: t('common:language.en') },
                  ]}
                />
              )}
            </Field>
            <Field label={t('doctors.gender')}>
              {(c) => (
                <Select
                  {...c}
                  value={gender}
                  onChange={(e) => set('gender', e.target.value)}
                  placeholder={t('doctors.anyGender')}
                  options={[
                    { value: 'female', label: t('doctors.female') },
                    { value: 'male', label: t('doctors.male') },
                  ]}
                />
              )}
            </Field>
            <Field label={t('doctors.maxFee')}>
              {(c) => (
                <Select
                  {...c}
                  value={fee}
                  onChange={(e) => set('fee', e.target.value)}
                  placeholder={t('doctors.anyFee')}
                  options={FEES.map((f) => ({ value: String(f), label: formatCurrency(f, lang) }))}
                />
              )}
            </Field>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <Field label={t('doctors.sort')} className="min-w-[12rem] lg:w-full">
              {(c) => (
                <Select
                  {...c}
                  value={sort}
                  onChange={(e) => set('sort', e.target.value === 'fee' ? 'fee' : '')}
                  options={[
                    { value: 'next', label: t('doctors.sortNext') },
                    { value: 'fee', label: t('doctors.sortFee') },
                  ]}
                />
              )}
            </Field>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={() => setParams(triage ? { triage } : {}, { replace: true })}>
                {t('common:actions.clearFilters')}
              </Button>
            )}
          </div>
        </div>

        <QueryBoundary query={doctors} loading={<SkeletonList rows={4} rowClassName="h-28" />}>
          {() =>
            sorted.length === 0 ? (
              <EmptyState icon={SearchX} title={t('doctors.empty')} body={t('doctors.emptyBody')} />
            ) : (
              <section aria-label={t('doctors.count', { count: sorted.length })} className="space-y-3">
                <p className="text-sm text-fg-muted" aria-live="polite">
                  {t('doctors.count', { count: sorted.length })}
                </p>
                <ul className="grid gap-3 2xl:grid-cols-2">
                  {sorted.map((doctor) => (
                    <li key={doctor.id}>
                      <DoctorCard
                        doctor={doctor}
                        department={departments.data?.find((d) => d.id === doctor.departmentId)}
                        today={today}
                        to={`/app/doctors/${doctor.id}${triage ? `?triage=${triage}` : ''}`}
                        action={t('doctors.viewAndBook')}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )
          }
        </QueryBoundary>
      </div>
    </div>
  );
}
