// The visible trail under an assistant reply: "Orchestrator -> Triage agent -> searchDoctors -> bookAppointment",
// expandable to each step's short result, including the safety checks.
import { useTranslation } from 'react-i18next';
import { CheckCircle2, ChevronRight, CircleAlert, Workflow } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAgentText } from '@/hooks/useAgentText';
import type { TrailStep } from '@/types';

function useStepName() {
  const { t } = useTranslation('triage');
  return (step: TrailStep): string => {
    if (step.kind === 'tool') return step.name;
    if (step.kind === 'safety') return t('trail.safetyCheck');
    return t(`agents.${step.name as 'orchestrator'}`, { defaultValue: step.name });
  };
}

export function TrailView({ steps, className }: { steps: readonly TrailStep[]; className?: string }) {
  const { t } = useTranslation('triage');
  const render = useAgentText();
  const nameOf = useStepName();
  const path = steps.filter((s) => s.kind !== 'safety');
  return (
    <details className={cn('group rounded-lg text-xs text-fg-subtle', className)}>
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md py-1 hover:text-fg-muted [&::-webkit-details-marker]:hidden">
        <Workflow aria-hidden className="h-3.5 w-3.5 shrink-0" />
        <span className="sr-only">{t('trail.title')}: </span>
        <span className="flex flex-wrap items-center gap-x-1">
          {path.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              {i > 0 && <ChevronRight aria-hidden className="h-3 w-3" />}
              <span className={cn(s.kind === 'tool' && 'font-mono')}>{nameOf(s)}</span>
            </span>
          ))}
        </span>
      </summary>
      <ol className="mt-1 space-y-1 border-l-2 border-border pl-3">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-1.5">
            {s.ok ? (
              <CheckCircle2 aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
            ) : (
              <CircleAlert aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
            )}
            <span>
              <span className={cn('font-semibold text-fg-muted', s.kind === 'tool' && 'font-mono')}>{nameOf(s)}</span>
              {': '}
              {render(s.result)}
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}
