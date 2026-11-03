// One conversation with the orchestrator (patient app or kiosk): starts it, sends the patient's words and taps,
// and keeps the thread. Taps that open a page or are handled by the screen itself (the kiosk's "Get a token") never
// reach the orchestrator.
import { useCallback, useEffect, useRef, useState } from 'react';
import { agentService } from '@/services';
import { newId } from '@/lib/id';
import type { ChatAction, ChatCommand, ChatMessage, ConversationStart, ConversationStatus, Lang } from '@/types';

const INITIAL_STATUS: ConversationStatus = {
  outcome: 'ongoing',
  departmentId: null,
  redFlagId: null,
  triageId: null,
  blocked: false,
  age: null,
  reason: null,
};

export interface UseAssistantOptions {
  channel: ConversationStart['channel'];
  lang: Lang;
  patientId?: string | undefined;
  userId?: string | undefined;
  /** Return true when the screen handles the command itself. */
  onCommand?: (command: ChatCommand, message: ChatMessage) => boolean;
}

export function useAssistant({ channel, lang, patientId, userId, onCommand }: UseAssistantOptions) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ConversationStatus>(INITIAL_STATUS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [lastInput, setLastInput] = useState<{ text?: string; voice?: boolean; command?: ChatCommand } | null>(null);
  const langRef = useRef(lang);
  langRef.current = lang;
  const commandRef = useRef(onCommand);
  commandRef.current = onCommand;
  const startedFor = useRef<string | null>(null);

  const start = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const started = await agentService.orchestrator.start({
        channel,
        lang: langRef.current,
        ...(patientId ? { patientId } : {}),
        ...(userId ? { userId } : {}),
      });
      setConversationId(started.conversationId);
      setMessages(started.messages);
      setStatus(INITIAL_STATUS);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }, [channel, patientId, userId]);

  useEffect(() => {
    const key = `${channel}:${patientId ?? ''}`;
    if (startedFor.current === key) return;
    startedFor.current = key;
    void start();
  }, [channel, patientId, start]);

  const transmit = useCallback(
    async (input: { text?: string; voice?: boolean; command?: ChatCommand }) => {
      if (!conversationId) return;
      setBusy(true);
      setError(null);
      setLastInput(input);
      try {
        const reply = await agentService.orchestrator.send(conversationId, { ...input, lang: langRef.current });
        setMessages((current) =>
          input.command?.type === 'start_over' ? reply.messages : [...current, ...reply.messages],
        );
        setStatus(reply.status);
      } catch (e) {
        setError(e);
      } finally {
        setBusy(false);
      }
    },
    [conversationId],
  );

  const send = useCallback(
    (text: string, voice = false) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      setMessages((current) => [
        ...current,
        { id: newId('msg'), from: 'patient', text: trimmed, ...(voice ? { voice: true } : {}) },
      ]);
      void transmit({ text: trimmed, voice });
    },
    [busy, transmit],
  );

  /** A tapped action: quick replies are sent as the patient's words; page links and local commands stay here. */
  const run = useCallback(
    (action: ChatAction, label: string, message: ChatMessage) => {
      if (busy) return;
      const { command } = action;
      if (command.type === 'reply') {
        send(label);
        return;
      }
      if (commandRef.current?.(command, message)) return;
      if (command.type === 'open') return;
      setMessages((current) => [...current, { id: newId('msg'), from: 'patient', text: label }]);
      void transmit({ command });
    },
    [busy, send, transmit],
  );

  const command = useCallback(
    (cmd: ChatCommand, label?: string) => {
      if (busy) return;
      if (label) setMessages((current) => [...current, { id: newId('msg'), from: 'patient', text: label }]);
      void transmit({ command: cmd });
    },
    [busy, transmit],
  );

  const restart = useCallback(() => {
    if (conversationId) void transmit({ command: { type: 'start_over' } });
    else void start();
  }, [conversationId, start, transmit]);

  const retry = useCallback(() => {
    if (!conversationId) void start();
    else if (lastInput) void transmit(lastInput);
  }, [conversationId, lastInput, start, transmit]);

  return { messages, status, busy, error, ready: Boolean(conversationId), send, run, command, restart, retry };
}

export type Assistant = ReturnType<typeof useAssistant>;
