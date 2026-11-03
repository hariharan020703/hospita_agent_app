// Reads text aloud with the browser's built-in speech synthesis (ta-IN or en-IN voice when the device has one).
import { useCallback, useEffect, useState } from 'react';
import type { Lang } from '@/types';

const available = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function useSpeechSynthesis() {
  const [speaking, setSpeaking] = useState(false);

  const stop = useCallback(() => {
    if (available()) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback((text: string, lang: Lang) => {
    if (!available()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'ta' ? 'ta-IN' : 'en-IN';
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) => v.lang === utterance.lang) ?? voices.find((v) => v.lang.startsWith(lang));
    if (voice) utterance.voice = voice;
    utterance.rate = 0.95;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, []);

  useEffect(
    () => () => {
      if (available()) window.speechSynthesis.cancel();
    },
    [],
  );

  return { supported: available(), speaking, speak, stop };
}
