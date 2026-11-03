import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { SkeletonList } from './Skeleton';
import { ErrorState } from './States';

/**
 * Renders the loading skeleton, error-with-retry, empty state or content for one query, so every data view
 * handles all four states the same way.
 */
export function QueryBoundary<T>({
  query,
  loading,
  empty,
  isEmpty,
  children,
}: {
  query: UseQueryResult<T>;
  loading?: ReactNode;
  empty?: ReactNode;
  isEmpty?: (data: T) => boolean;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <>{loading ?? <SkeletonList />}</>;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const data = query.data;
  if (empty && (isEmpty ? isEmpty(data) : Array.isArray(data) && data.length === 0)) return <>{empty}</>;
  return <>{children(data)}</>;
}
