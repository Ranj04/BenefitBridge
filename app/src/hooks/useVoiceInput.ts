// T2 — voice input via the browser Web Speech API (SpeechRecognition).
// Voice is a pure input transform: the transcript lands in the editable text
// field and the user submits it — nothing auto-submits, nothing bypasses text.
//
// TODO(native): on iOS/Android the Web Speech API does not exist. The native
// build would swap this hook's internals for a native STT module (e.g.
// expo-speech-recognition) behind the same { supported, listening, interim,
// error, toggle } surface. The demo runs on web, so this is deferred — when
// Platform.OS !== 'web' the hook reports supported: false and the UI simply
// hides the mic; text intake is unaffected.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

// lib.dom ships no SpeechRecognition types (still vendor-prefixed in Chrome) —
// declare the minimal surface we use.
type SpeechRecognitionAlternativeLike = { transcript: string };
type SpeechRecognitionResultLike = { isFinal: boolean; 0: SpeechRecognitionAlternativeLike };
type SpeechRecognitionEventLike = { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> };
type SpeechRecognitionErrorEventLike = { error: string };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type VoiceInputError = 'denied' | 'no-speech' | 'network' | 'failed';

export function useVoiceInput(opts: { lang: string; onFinal: (text: string) => void }) {
  const supported = getRecognitionCtor() != null;
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<VoiceInputError | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  // Refs so recognition callbacks always see the current lang/onFinal without
  // tearing the session down on every render.
  const onFinalRef = useRef(opts.onFinal);
  onFinalRef.current = opts.onFinal;

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    setError(null);
    setInterim('');
    const rec = new Ctor();
    rec.lang = opts.lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const transcript = res[0]?.transcript ?? '';
        if (res.isFinal) onFinalRef.current(transcript.trim());
        else interimText += transcript;
      }
      setInterim(interimText);
    };
    rec.onerror = (e) => {
      // Graceful degradation: surface a short message, fall back to text.
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setError('denied');
      else if (e.error === 'no-speech') setError('no-speech');
      else if (e.error === 'network') setError('network');
      else if (e.error !== 'aborted') setError('failed');
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
      setInterim('');
    };
    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch {
      setError('failed');
    }
  }, [opts.lang]);

  const toggle = useCallback(() => {
    if (recRef.current) stop();
    else start();
  }, [start, stop]);

  // Language switch or unmount ends any in-flight session (its lang is stale).
  useEffect(() => {
    return () => recRef.current?.abort();
  }, [opts.lang]);

  return { supported, listening, interim, error, toggle };
}
