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

/**
 * The stated-preference wording sent with the intake text. Language NAMES, not
 * ISO codes — verified against the live intake agent: "zh" alone is ignored,
 * "Chinese / 中文" extracts preferredLanguage: 'zh'.
 */
export function languageHint(code: LangCode): string {
  return { en: 'English', es: 'Spanish / español', zh: 'Chinese / 中文' }[code];
}

/** Default to the browser locale when it is one of ours; otherwise English. */
export function defaultLanguage(): LangCode {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.language) {
    const primary = navigator.language.toLowerCase().split('-')[0];
    if (primary === 'es' || primary === 'zh') return primary;
  }
  return 'en';
}

export type Strings = {
  // Voice + intake controls
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
  // Welcome
  welcomeLine: string;
  welcomeSub: string;
  trustFree: string;
  trustPrivate: string;
  trustNoAccount: string;
  trustNoStore: string;
  /** Full honest privacy sentence (FTC §5: precise, not just reassuring). */
  privacyLine: string;
  start: string;
  tryPersona: string;
  // Save & resume (opt-in, on-device only)
  saveProgress: string;
  saveProgressNote: string;
  resumeTitle: string;
  resumeBody: string;
  resume: string;
  startFresh: string;
  clearInfo: string;
  clearConfirm: string;
  // Intake
  intakeTitle: string;
  intakeHint: string;
  back: string;
  checking: string;
  // Results
  resultsTitle: string;
  heroKicker: string;
  /** The payoff line. Pass preformatted $ strings; either may be null. */
  heroLine: (monthly: string | null, annual: string | null) => string;
  /** Label under the big monthly number. */
  perMonthLabel: string;
  /** Label under the big annual number when it stands alone. */
  perYearLabel: string;
  /** The second line when an annual tax credit rides along. */
  plusAnnualLine: (amount: string) => string;
  estimateNote: string;
  startOver: string;
  editAnswers: string;
  // Status pills
  pillLikely: string;
  pillMoreInfo: string;
  pillUnlikely: string;
};

/** UI strings per selected language. */
export const STRINGS: Record<LangCode, Strings> = {
  en: {
    heading: 'Tell us about your household — any language',
    placeholder: 'e.g. "single mom in SF, about $2,800 a month, one kid, renting"',
    check: 'See what I qualify for',
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
    welcomeLine: "Let's find every benefit you're owed.",
    welcomeSub: 'A few plain questions — we check food, health, utility, and tax programs, and we show our math.',
    trustFree: 'Free',
    trustPrivate: 'Private',
    trustNoAccount: 'No account',
    trustNoStore: 'Secure screening',
    privacyLine:
      'Your answers are sent securely to our screening service for processing. Saving progress is optional and stays on this device — clear it anytime.',
    start: 'Start',
    tryPersona: 'Just looking? Try an example household:',
    saveProgress: 'Save my progress on this device',
    saveProgressNote: 'Saved only on this device and erased automatically after 7 days. Screening still sends your answers securely for processing.',
    resumeTitle: 'Resume where you left off?',
    resumeBody: 'You chose to save your progress on this device. Pick it up, or start fresh — starting fresh erases it.',
    resume: 'Resume',
    startFresh: 'Start fresh',
    clearInfo: 'Clear my information',
    clearConfirm: 'Tap again to confirm',
    intakeTitle: 'Tell us about your home',
    intakeHint: "Say it the way you'd tell a friend — who lives with you, about what you earn each month, and what you pay in rent.",
    back: 'Back',
    checking: 'Reading what you told us, then running the official math…',
    resultsTitle: 'What you may qualify for',
    heroKicker: 'Money we found for you',
    heroLine: (m, a) =>
      m && a
        ? `You may be owed about ${m} a month, plus ${a} a year in tax credits.`
        : m
          ? `You may be owed about ${m} a month.`
          : a
            ? `You may be owed about ${a} a year in tax credits.`
            : 'You may qualify for the programs below.',
    perMonthLabel: 'a month, estimated',
    perYearLabel: 'a year, estimated',
    plusAnnualLine: (a) => `plus about ${a} a year in tax credits`,
    estimateNote: 'This is an estimate — the office confirms the final amount when you apply.',
    startOver: 'Start over',
    editAnswers: 'Edit my answers',
    pillLikely: 'Likely qualifies',
    pillMoreInfo: 'Need a bit more',
    pillUnlikely: 'Not this time',
  },
  es: {
    heading: 'Cuéntenos sobre su hogar — en cualquier idioma',
    placeholder: 'p. ej. "madre soltera en SF, unos $2,800 al mes, un hijo, alquilando"',
    check: 'Ver para qué califico',
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
    welcomeLine: 'Encontremos cada beneficio que le corresponde.',
    welcomeSub: 'Unas preguntas sencillas — revisamos programas de comida, salud, servicios e impuestos, y le mostramos las cuentas.',
    trustFree: 'Gratis',
    trustPrivate: 'Privado',
    trustNoAccount: 'Sin cuenta',
    trustNoStore: 'Evaluación segura',
    privacyLine:
      'Sus respuestas se envían de forma segura a nuestro servicio para procesar la evaluación. Guardar el progreso es opcional y se mantiene en este dispositivo — bórrelo cuando quiera.',
    start: 'Comenzar',
    tryPersona: '¿Solo mirando? Pruebe un hogar de ejemplo:',
    saveProgress: 'Guardar mi progreso en este dispositivo',
    saveProgressNote: 'Se guarda solo en este dispositivo y se borra automáticamente a los 7 días. La evaluación aún envía sus respuestas de forma segura para procesarlas.',
    resumeTitle: '¿Continuar donde lo dejó?',
    resumeBody: 'Usted eligió guardar su progreso en este dispositivo. Retómelo, o empiece de cero — empezar de cero lo borra.',
    resume: 'Continuar',
    startFresh: 'Empezar de cero',
    clearInfo: 'Borrar mi información',
    clearConfirm: 'Toque de nuevo para confirmar',
    intakeTitle: 'Cuéntenos sobre su hogar',
    intakeHint: 'Dígalo como se lo contaría a una amistad — quién vive con usted, cuánto gana al mes y cuánto paga de alquiler.',
    back: 'Atrás',
    checking: 'Leyendo lo que nos contó y haciendo las cuentas oficiales…',
    resultsTitle: 'Para qué puede calificar',
    heroKicker: 'Dinero que encontramos para usted',
    heroLine: (m, a) =>
      m && a
        ? `Podrían corresponderle unos ${m} al mes, más ${a} al año en créditos fiscales.`
        : m
          ? `Podrían corresponderle unos ${m} al mes.`
          : a
            ? `Podrían corresponderle unos ${a} al año en créditos fiscales.`
            : 'Puede calificar para los programas de abajo.',
    perMonthLabel: 'al mes, estimado',
    perYearLabel: 'al año, estimado',
    plusAnnualLine: (a) => `más unos ${a} al año en créditos fiscales`,
    estimateNote: 'Esto es un estimado — la oficina confirma el monto final cuando usted aplica.',
    startOver: 'Empezar de nuevo',
    editAnswers: 'Editar mis respuestas',
    pillLikely: 'Probablemente califica',
    pillMoreInfo: 'Falta un poco más',
    pillUnlikely: 'Esta vez no',
  },
  zh: {
    heading: '告诉我们您的家庭情况 — 任何语言均可',
    placeholder: '例如："住在旧金山的单亲妈妈，每月约 $2,800，一个孩子，租房"',
    check: '看看我符合什么条件',
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
    welcomeLine: '让我们找到您应得的每一项福利。',
    welcomeSub: '几个简单的问题 — 我们为您查询食品、医疗、水电和税务项目，并展示计算过程。',
    trustFree: '免费',
    trustPrivate: '保密',
    trustNoAccount: '无需注册',
    trustNoStore: '安全筛查',
    privacyLine: '您的回答会安全发送到我们的筛查服务进行处理。保存进度是可选的，且只保存在此设备上 — 可随时清除。',
    start: '开始',
    tryPersona: '先看看？试试示例家庭：',
    saveProgress: '在此设备上保存我的进度',
    saveProgressNote: '仅保存在此设备上，并在 7 天后自动删除。筛查时仍会安全发送您的回答以进行处理。',
    resumeTitle: '从上次离开的地方继续？',
    resumeBody: '您选择了在此设备上保存进度。可以继续，或从头开始 — 从头开始会删除已保存的内容。',
    resume: '继续',
    startFresh: '从头开始',
    clearInfo: '清除我的信息',
    clearConfirm: '再点一次确认',
    intakeTitle: '告诉我们您的家庭情况',
    intakeHint: '像跟朋友聊天一样说就行 — 谁和您一起住、每月大约收入多少、房租多少。',
    back: '返回',
    checking: '正在理解您的情况，然后进行官方计算……',
    resultsTitle: '您可能符合的项目',
    heroKicker: '我们为您找到的钱',
    heroLine: (m, a) =>
      m && a
        ? `您每月可能应得约 ${m}，另加每年约 ${a} 的税收抵免。`
        : m
          ? `您每月可能应得约 ${m}。`
          : a
            ? `您每年可能应得约 ${a} 的税收抵免。`
            : '您可能符合以下项目的条件。',
    perMonthLabel: '每月（估算）',
    perYearLabel: '每年（估算）',
    plusAnnualLine: (a) => `另加每年约 ${a} 的税收抵免`,
    estimateNote: '这是估算 — 您申请时由办事处确认最终金额。',
    startOver: '重新开始',
    editAnswers: '修改我的回答',
    pillLikely: '很可能符合',
    pillMoreInfo: '还需要一点信息',
    pillUnlikely: '这次不符合',
  },
};
