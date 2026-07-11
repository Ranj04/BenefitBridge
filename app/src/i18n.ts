// Voice + multilingual intake (T1): the three supported intake languages.
// The selected language drives (a) SpeechRecognition.lang, (b) the TTS voice,
// and (c) the preferredLanguage hint passed through to the intake agent.
// The agent layer already handles non-English input; this is UI plumbing only.
import { Platform } from 'react-native';

export type LangCode = 'en' | 'es' | 'zh';

export const LANGUAGES: { code: LangCode; bcp47: string; label: string; a11yLabel: string }[] = [
  { code: 'en', bcp47: 'en-US', label: 'English', a11yLabel: 'English' },
  { code: 'es', bcp47: 'es-US', label: 'Español', a11yLabel: 'Spanish' },
  { code: 'zh', bcp47: 'zh-CN', label: '中文', a11yLabel: 'Chinese' },
];

export function bcp47For(code: LangCode): string {
  return LANGUAGES.find((l) => l.code === code)?.bcp47 ?? 'en-US';
}

/** Default to the browser locale when it is one of ours; otherwise English. */
export function defaultLanguage(): LangCode {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.language) {
    const primary = navigator.language.toLowerCase().split('-')[0];
    if (primary === 'es' || primary === 'zh') return primary;
  }
  return 'en';
}

/** UI strings for the voice controls, per selected language. */
export const STRINGS: Record<
  LangCode,
  {
    heading: string;
    placeholder: string;
    check: string;
    micStart: string;
    micStop: string;
    listening: string;
    micDenied: string;
    micNoSpeech: string;
    micNetwork: string;
    micUnavailable: string;
    readAloud: string;
    stopReading: string;
    languagePicker: string;
  }
> = {
  en: {
    heading: 'Tell us about your household — any language',
    placeholder: 'e.g. "single mom in SF, about $2,800 a month, one kid, renting"',
    check: 'Check',
    micStart: 'Speak instead of typing',
    micStop: 'Stop listening',
    listening: 'Listening… speak now. Your words appear below and stay editable.',
    micDenied: 'Microphone permission was denied — you can keep typing below.',
    micNoSpeech: "We didn't catch that. Try again, or just type below.",
    micNetwork: 'Speech recognition is unreachable right now — typing still works.',
    micUnavailable: 'Voice input is not available in this browser — typing works fully.',
    readAloud: 'Read this aloud',
    stopReading: 'Stop reading',
    languagePicker: 'Choose your language',
  },
  es: {
    heading: 'Cuéntenos sobre su hogar — en cualquier idioma',
    placeholder: 'p. ej. "madre soltera en SF, unos $2,800 al mes, un hijo, alquilando"',
    check: 'Consultar',
    micStart: 'Hable en lugar de escribir',
    micStop: 'Dejar de escuchar',
    listening: 'Escuchando… hable ahora. Sus palabras aparecen abajo y se pueden editar.',
    micDenied: 'Se denegó el permiso del micrófono — puede seguir escribiendo abajo.',
    micNoSpeech: 'No le escuchamos. Intente de nuevo, o simplemente escriba abajo.',
    micNetwork: 'El reconocimiento de voz no está disponible ahora — escribir sigue funcionando.',
    micUnavailable: 'La entrada por voz no está disponible en este navegador — escribir funciona plenamente.',
    readAloud: 'Leer en voz alta',
    stopReading: 'Dejar de leer',
    languagePicker: 'Elija su idioma',
  },
  zh: {
    heading: '告诉我们您的家庭情况 — 任何语言均可',
    placeholder: '例如："住在旧金山的单亲妈妈，每月约 $2,800，一个孩子，租房"',
    check: '查询',
    micStart: '用语音代替打字',
    micStop: '停止聆听',
    listening: '正在聆听……请说话。您的话会显示在下方，可随时编辑。',
    micDenied: '麦克风权限被拒绝 — 您仍可以在下方输入文字。',
    micNoSpeech: '没有听到声音。请再试一次，或直接在下方输入。',
    micNetwork: '语音识别暂时不可用 — 文字输入仍然可用。',
    micUnavailable: '此浏览器不支持语音输入 — 文字输入完全可用。',
    readAloud: '朗读结果',
    stopReading: '停止朗读',
    languagePicker: '选择您的语言',
  },
};
