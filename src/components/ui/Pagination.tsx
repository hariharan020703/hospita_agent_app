import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from './IconButton';

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  const { t } = useTranslation();
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav
      aria-label={t('pagination.page', { page, pages: pageCount })}
      className="flex flex-wrap items-center justify-between gap-3 text-sm text-fg-muted"
    >
      <p aria-live="polite">{t('pagination.summary', { from, to, total })}</p>
      <div className="flex items-center gap-1">
        <IconButton
          icon={ChevronLeft}
          label={t('pagination.previous')}
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        />
        <span className="px-2 tabular">{t('pagination.page', { page, pages: pageCount })}</span>
        <IconButton
          icon={ChevronRight}
          label={t('pagination.next')}
          variant="outline"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
        />
      </div>
    </nav>
  );
}
