// T4 — spoken results via the browser speechSynthesis API.
// Reads the SAME disclaimered explanation shown on screen — never a bare
// number reframed as a guarantee. Only markdown syntax is stripped so the
// screen reader voice doesn't say "hash hash" and "pipe".
//
// TODO(native): iOS/Android would use expo-speech (Speech.speak) behind the
// same { supported, speaking, speak, stop } surface. Deferred — demo is web.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

function getSynth(): SpeechSynthesis | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return 'speechSynthesis' in window ? window.speechSynthesis : null;
}

/** Strip markdown decoration for TTS; the visible text is unchanged. */
export function speechText(md: string): string {
  return md
    .replace(/^\s*\|[-\s|:]+\|\s*$/gm, '') // table separator rows
    .replace(/\|/g, ', ') // table cells → pauses
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*?|__|`+/g, '')
    .replace(/^\s*[-*]{3,}\s*$/gm, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\n{2,}/g, '. ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function useVoiceOutput() {
  const synth = getSynth();
  const supported = synth != null;
  const [speaking, setSpeaking] = useState(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  // getVoices() is empty until the async voiceschanged event on some browsers.
  useEffect(() => {
    const s = getSynth();
    if (!s) return;
    const load = () => {
      voicesRef.current = s.getVoices();
    };
    load();
    s.addEventListener?.('voiceschanged', load);
    return () => {
      s.removeEventListener?.('voiceschanged', load);
      s.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    getSynth()?.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback((text: string, bcp47: string) => {
    const s = getSynth();
    if (!s) return;
    s.cancel();
    const utter = new SpeechSynthesisUtterance(speechText(text));
    utter.lang = bcp47;
    const primary = bcp47.toLowerCase().split('-')[0];
    const voices = voicesRef.current.length ? voicesRef.current : s.getVoices();
    const voice =
      voices.find((v) => v.lang.toLowerCase() === bcp47.toLowerCase()) ??
      voices.find((v) => v.lang.toLowerCase().split('-')[0] === primary);
    if (voice) utter.voice = voice;
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    setSpeaking(true);
    s.speak(utter);
  }, []);

  return { supported, speaking, speak, stop };
}
