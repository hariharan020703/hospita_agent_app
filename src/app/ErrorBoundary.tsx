/* eslint-disable react-refresh/only-export-components -- a class error boundary is not hot-reloadable anyway */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw, ServerCrash } from 'lucide-react';
import { Button } from '@/components/ui';

function CrashScreen({ onReset }: { onReset: () => void }) {
  const { t } = useTranslation();
  return (
    <main className="grid min-h-[60dvh] place-items-center p-6">
      <div role="alert" className="max-w-md space-y-4 text-center">
        <ServerCrash aria-hidden className="mx-auto h-10 w-10 text-fg-subtle" />
        <h1 className="text-xl font-bold text-fg">{t('pages.crashTitle')}</h1>
        <p className="text-fg-muted">{t('pages.crashBody')}</p>
        <Button
          icon={RotateCcw}
          onClick={() => {
            onReset();
            window.location.reload();
          }}
        >
          {t('pages.reload')}
        </Button>
      </div>
    </main>
  );
}

/** One per app, so a crash in one app's screen never takes the others down. */
export class ErrorBoundary extends Component<{ children: ReactNode; name: string }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.name}] crashed`, error, info.componentStack);
  }

  override render() {
    if (this.state.failed) return <CrashScreen onReset={() => this.setState({ failed: false })} />;
    return this.props.children;
  }
}
