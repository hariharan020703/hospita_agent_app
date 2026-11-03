import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { services } from '@/services';
import { Spinner, Toaster } from '@/components/ui';
import { createQueryClient } from './queryClient';

export function FullPageSpinner() {
  return (
    <div className="grid min-h-dvh place-items-center text-fg-subtle">
      <Spinner className="h-8 w-8" label="Loading" />
    </div>
  );
}

/** Refetches active queries when data changes elsewhere (another tab, background simulation). */
function DataSync({ client }: { client: ReturnType<typeof createQueryClient> }) {
  useEffect(() => {
    let timer: number | undefined;
    const unsubscribe = services.system.subscribe(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void client.invalidateQueries(), 150);
    });
    const stop = services.system.start();
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
      stop();
    };
  }, [client]);
  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient);
  return (
    <QueryClientProvider client={client}>
      <DataSync client={client} />
      <Suspense fallback={<FullPageSpinner />}>
        {children}
        <Toaster />
      </Suspense>
    </QueryClientProvider>
  );
}
