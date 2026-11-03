// TanStack Query client. Mutations declare `meta` (success text, keys to invalidate); this file turns that into
// toasts and cache invalidation so every mutation reports success or failure the same way.
import { MutationCache, QueryClient, type QueryKey } from '@tanstack/react-query';
import i18n from '@/i18n';
import { errorCodeOf } from '@/services/errors';
import { toast } from '@/components/ui/Toast';

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      /** Already-translated success message. */
      success?: string;
      /** Override the error toast text (already translated). */
      error?: string;
      /** Don't toast errors: the screen shows them inline. */
      silentError?: boolean;
      invalidates?: readonly QueryKey[];
    };
  }
}

export function createQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (count, error) => errorCodeOf(error) === 'NETWORK' && count < 2,
      },
      mutations: { retry: 0 },
    },
    mutationCache: new MutationCache({
      onSuccess: (_data, _variables, _context, mutation) => {
        const meta = mutation.meta;
        meta?.invalidates?.forEach((queryKey) => void client.invalidateQueries({ queryKey }));
        if (meta?.success) toast.success(meta.success);
      },
      onError: (error, _variables, _context, mutation) => {
        if (mutation.meta?.silentError) return;
        toast.error(mutation.meta?.error ?? i18n.t(`errors.${errorCodeOf(error)}`));
      },
    }),
  });
  return client;
}
