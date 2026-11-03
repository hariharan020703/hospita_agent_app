// The conversation with the orchestrator, shared by the patient app and the kiosk ("lg" for touch screens):
// messages, inline cards, quick replies, the trail of agents and tools, and text or voice input.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Mic, MicOff, SendHorizontal, TriangleAlert, UserRound } from 'lucide-react';
import { Button, Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useAgentText } from '@/hooks/useAgentText';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { errorCodeOf } from '@/services';
import type { ChatMessage, Lang } from '@/types';
import { ChatCardView } from './cards';
import { TrailView } from './TrailView';
import type { Assistant } from './useAssistant';

function Avatar({ mine, big }: { mine: boolean; big: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-full',
        big ? 'h-10 w-10' : 'h-8 w-8',
        mine ? 'bg-surface-sunken text-fg-muted' : 'bg-primary-soft text-primary-ink',
      )}
    >
      {mine ? <UserRound className="h-1/2 w-1/2" /> : <Bot className="h-1/2 w-1/2" />}
    </span>
  );
}

function AssistantTurn({
  message,
  latest,
  assistant,
  onPickDepartment,
  hospitalPhone,
  big,
}: {
  message: ChatMessage;
  latest: boolean;
  assistant: Assistant;
  onPickDepartment: (departmentId: string) => void;
  hospitalPhone?: string | undefined;
  big: boolean;
}) {
  const { t } = useTranslation('triage');
  const render = useAgentText();
  const interactive = latest && !assistant.busy;
  return (
    <div className="flex items-start gap-2">
      <Avatar mine={false} big={big} />
      <div className="min-w-0 max-w-[92%] flex-1 space-y-2 sm:max-w-[85%]">
        {message.say && message.say.length > 0 && (
          <div className="space-y-1.5 rounded-2xl rounded-tl-md border bg-surface px-4 py-2.5 leading-relaxed text-fg">
            <span className="sr-only">{t('chat.assistant')}: </span>
            {message.say.map((s, i) => (
              <p key={i}>{render(s)}</p>
            ))}
          </div>
        )}
        {message.card && (
          <ChatCardView
            card={message.card}
            interactive={interactive}
            onCommand={(command, label) => assistant.command(command, label)}
            onPickDepartment={onPickDepartment}
            hospitalPhone={hospitalPhone}
            size={big ? 'lg' : 'md'}
          />
        )}
        {latest && message.actions && message.actions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.actions.map((a) => {
              const label = render(a.label);
              return (
                <Button
                  key={a.id}
                  variant={a.tone === 'primary' ? 'primary' : 'outline'}
                  size={big ? 'lg' : 'md'}
                  disabled={!interactive}
                  onClick={() => assistant.run(a, label, message)}
                >
                  {label}
                </Button>
              );
            })}
          </div>
        )}
        {message.trail && message.trail.length > 0 && <TrailView steps={message.trail} />}
      </div>
    </div>
  );
}

export function AssistantThread({
  assistant,
  lang,
  size = 'md',
  onPickDepartment,
  hospitalPhone,
}: {
  assistant: Assistant;
  lang: Lang;
  size?: 'md' | 'lg';
  onPickDepartment: (departmentId: string) => void;
  hospitalPhone?: string | undefined;
}) {
  const { t } = useTranslation(['triage', 'common']);
  const [draft, setDraft] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const big = size === 'lg';
  const speech = useSpeechRecognition(lang, (text) => assistant.send(text, true));
  const latestId = [...assistant.messages].reverse().find((m) => m.from === 'assistant')?.id;
  const closed = assistant.status.outcome === 'emergency';

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [assistant.messages.length, assistant.busy, speech.interim]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    assistant.send(draft);
    setDraft('');
  };

  const speechMessage = speech.error === 'denied' ? t('chat.micDenied') : speech.error ? t('chat.voiceError') : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-label={t('chat.conversation')}
        className={cn('min-h-0 flex-1 space-y-4 overflow-y-auto py-4 scrollbar-thin', big ? 'text-lg' : 'text-base')}
      >
        {assistant.messages.map((m) =>
          m.from === 'patient' ? (
            <div key={m.id} className="flex flex-row-reverse items-end gap-2">
              <Avatar mine big={big} />
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 leading-relaxed text-primary-fg">
                <span className="sr-only">{t('chat.you')}: </span>
                {m.text}
                {m.voice && <span className="ml-2 text-xs opacity-80">({t('chat.viaVoice')})</span>}
              </div>
            </div>
          ) : (
            <AssistantTurn
              key={m.id}
              message={m}
              latest={m.id === latestId}
              assistant={assistant}
              onPickDepartment={onPickDepartment}
              hospitalPhone={hospitalPhone}
              big={big}
            />
          ),
        )}
        {speech.listening && speech.interim && (
          <div className="flex flex-row-reverse">
            <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary/70 px-4 py-2.5 text-primary-fg">
              {speech.interim}…
            </div>
          </div>
        )}
        {assistant.busy && (
          <p className="flex items-center gap-2 text-sm text-fg-subtle">
            <Spinner />
            {t('chat.typing')}
          </p>
        )}
        {assistant.error !== null && !assistant.busy && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning-ink"
          >
            <TriangleAlert aria-hidden className="h-4 w-4 shrink-0" />
            <span className="flex-1">{t(`common:errors.${errorCodeOf(assistant.error)}`)}</span>
            <Button size="sm" variant="outline" onClick={assistant.retry}>
              {t('common:actions.retry')}
            </Button>
          </div>
        )}
      </div>

      {!closed && (
        <div className="space-y-2 border-t pt-3">
          {speech.listening ? (
            <div className="flex items-center gap-3 rounded-xl bg-primary-soft p-3 text-primary-ink" role="status">
              <span className="relative grid h-12 w-12 place-items-center">
                <span aria-hidden className="absolute inset-0 animate-pulse-ring rounded-full bg-primary/40" />
                <Mic aria-hidden className="relative h-6 w-6" />
              </span>
              <span className={cn('flex-1 font-semibold', big && 'text-lg')}>{t('chat.listening')}</span>
              <Button variant="outline" icon={MicOff} onClick={speech.stop} size={big ? 'lg' : 'md'}>
                {t('chat.micStop')}
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="flex items-center gap-2">
              {speech.supported && (
                <button
                  type="button"
                  onClick={speech.start}
                  disabled={!assistant.ready || assistant.busy}
                  aria-label={t('chat.mic')}
                  className={cn(
                    'grid shrink-0 place-items-center rounded-full bg-primary text-primary-fg transition-colors hover:bg-primary-hover disabled:opacity-50',
                    big ? 'h-14 w-14' : 'h-12 w-12',
                  )}
                >
                  <Mic aria-hidden className={big ? 'h-6 w-6' : 'h-5 w-5'} />
                </button>
              )}
              <label htmlFor="assistant-input" className="sr-only">
                {t('chat.placeholder')}
              </label>
              <input
                id="assistant-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t('chat.placeholder')}
                autoComplete="off"
                disabled={!assistant.ready}
                className={cn(
                  'min-w-0 flex-1 rounded-full border border-border-strong bg-surface px-4 text-fg placeholder:text-fg-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30',
                  big ? 'h-14 text-lg' : 'h-12 text-base',
                )}
              />
              <button
                type="submit"
                aria-label={t('chat.send')}
                disabled={!draft.trim() || assistant.busy || !assistant.ready}
                className={cn(
                  'grid shrink-0 place-items-center rounded-full border border-border-strong bg-surface text-primary-ink hover:bg-primary-soft disabled:opacity-40',
                  big ? 'h-14 w-14' : 'h-12 w-12',
                )}
              >
                <SendHorizontal aria-hidden className={big ? 'h-6 w-6' : 'h-5 w-5'} />
              </button>
            </form>
          )}
          {!speech.supported && <p className="text-xs text-fg-subtle">{t('chat.voiceUnsupported')}</p>}
          {speechMessage && (
            <p role="alert" className="text-sm text-warning-ink">
              {speechMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
