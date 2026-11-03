// Sortable, paginated table with loading, empty and error states built in.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Pagination } from './Pagination';
import { Skeleton } from './Skeleton';
import { EmptyState, ErrorState } from './States';

export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  align?: 'left' | 'right';
  className?: string;
  /** Hide on narrow screens to keep the table readable. */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl';
}

type SortState = { id: string; dir: 'asc' | 'desc' } | null;

const HIDE = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
};

export function DataTable<T>({
  caption,
  columns,
  rows,
  getRowId,
  initialSort = null,
  pageSize = 10,
  loading = false,
  error,
  onRetry,
  empty,
  onRowClick,
  rowClassName,
}: {
  caption: string;
  columns: readonly Column<T>[];
  rows: readonly T[] | undefined;
  getRowId: (row: T) => string;
  initialSort?: SortState;
  pageSize?: number;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
}) {
  const { t } = useTranslation();
  const [sort, setSort] = useState<SortState>(initialSort);
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    const list = [...(rows ?? [])];
    const column = sort && columns.find((c) => c.id === sort.id);
    if (column?.sortValue && sort) {
      const value = column.sortValue;
      list.sort((a, b) => {
        const x = value(a);
        const y = value(b);
        const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
        return sort.dir === 'asc' ? cmp : -cmp;
      });
    }
    return list;
  }, [rows, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);
  const visible = sorted.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = (id: string) => {
    setSort((current) =>
      current?.id === id ? { id, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { id, dir: 'asc' },
    );
    setPage(1);
  };

  if (error) return <ErrorState error={error} onRetry={onRetry} />;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border bg-surface scrollbar-thin">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b bg-surface-muted text-left">
              {columns.map((column) => {
                const active = sort?.id === column.id;
                const ariaSort = active
                  ? sort.dir === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : column.sortValue
                    ? 'none'
                    : undefined;
                return (
                  <th
                    key={column.id}
                    scope="col"
                    aria-sort={ariaSort}
                    className={cn(
                      'whitespace-nowrap px-4 py-2.5 font-semibold text-fg-muted',
                      column.align === 'right' && 'text-right',
                      column.hideBelow && HIDE[column.hideBelow],
                    )}
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.id)}
                        className="-mx-1 inline-flex items-center gap-1 rounded px-1 hover:text-fg"
                        aria-label={t('table.sortBy', { column: column.header })}
                      >
                        {column.header}
                        {active ? (
                          sort.dir === 'asc' ? (
                            <ArrowUp aria-hidden className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDown aria-hidden className="h-3.5 w-3.5" />
                          )
                        ) : (
                          <ArrowUpDown aria-hidden className="h-3.5 w-3.5 opacity-40" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: Math.min(pageSize, 6) }, (_, i) => (
                <tr key={`s${i}`} className="border-b last:border-0">
                  {columns.map((column) => (
                    <td key={column.id} className={cn('px-4 py-3', column.hideBelow && HIDE[column.hideBelow])}>
                      <Skeleton className="h-4 w-full max-w-[10rem]" />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading &&
              visible.map((row) => (
                <tr
                  key={getRowId(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-b last:border-0 hover:bg-surface-muted',
                    onRowClick && 'cursor-pointer',
                    rowClassName?.(row),
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={cn(
                        'px-4 py-3 align-middle text-fg',
                        column.align === 'right' && 'text-right',
                        column.hideBelow && HIDE[column.hideBelow],
                        column.className,
                      )}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
        {loading && (
          <span className="sr-only" role="status">
            {t('states.loading')}
          </span>
        )}
        {!loading && sorted.length === 0 && (
          <div className="p-4">{empty ?? <EmptyState title={t('states.noResults')} className="border-0" />}</div>
        )}
      </div>
      {!loading && sorted.length > pageSize && (
        <Pagination page={page} pageCount={pageCount} total={sorted.length} pageSize={pageSize} onPage={setPage} />
      )}
    </div>
  );
}
