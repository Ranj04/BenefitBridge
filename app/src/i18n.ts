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

/**
 * Plain-language names for the parsed HouseholdProfile fields, per language.
 * Shared by the verification panel, the need-more-info card, and the 400
 * error path — one map so a field never shows raw camelCase to a user.
 */
export const FIELD_LABELS: Record<LangCode, Record<string, string>> = {
  en: {
    householdSize: 'People in your household',
    monthlyGrossIncome: 'Monthly income (before taxes)',
    earnedIncome: 'Of that, earned from work',
    hasChildren: 'Children at home',
    childrenAges: 'Children’s ages',
    hasElderlyOrDisabled: 'Anyone 60+ or disabled',
    isRenter: 'Renting your home',
    monthlyRent: 'Monthly rent',
    monthlyUtilities: 'Monthly utilities',
    dependentCareCost: 'Child or dependent care costs',
    medicalExpenses: 'Medical expenses',
    countyFips: 'County',
    immigrationStatus: 'Immigration status',
    preferredLanguage: 'Preferred language',
  },
  es: {
    householdSize: 'Personas en su hogar',
    monthlyGrossIncome: 'Ingreso mensual (antes de impuestos)',
    earnedIncome: 'De eso, ganado trabajando',
    hasChildren: 'Niños en casa',
    childrenAges: 'Edades de los niños',
    hasElderlyOrDisabled: 'Alguien de 60+ o con discapacidad',
    isRenter: 'Alquila su vivienda',
    monthlyRent: 'Alquiler mensual',
    monthlyUtilities: 'Servicios mensuales (luz, gas, agua)',
    dependentCareCost: 'Costos de cuidado de niños o dependientes',
    medicalExpenses: 'Gastos médicos',
    countyFips: 'Condado',
    immigrationStatus: 'Estatus migratorio',
    preferredLanguage: 'Idioma preferido',
  },
  zh: {
    householdSize: '家庭人数',
    monthlyGrossIncome: '每月收入（税前）',
    earnedIncome: '其中的工作收入',
    hasChildren: '家中有孩子',
    childrenAges: '孩子的年龄',
    hasElderlyOrDisabled: '有 60 岁以上或残障成员',
    isRenter: '租房居住',
    monthlyRent: '每月房租',
    monthlyUtilities: '每月水电费',
    dependentCareCost: '子女或家属照护费用',
    medicalExpenses: '医疗费用',
    countyFips: '所在县',
    immigrationStatus: '移民身份',
    preferredLanguage: '首选语言',
  },
};

/** Friendly label for a profile field; falls back to the raw key, never crashes. */
export function fieldLabel(lang: LangCode, key: string): string {
  return FIELD_LABELS[lang][key] ?? key;
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
  /** Label next to a one-time amount on a program card. */
  perOneTimeLabel: string;
  /** The second line when an annual tax credit rides along. */
  plusAnnualLine: (amount: string) => string;
  /** The extra hero line when a one-time payment rides along. */
  plusOneTimeLine: (amount: string) => string;
  estimateNote: string;
  startOver: string;
  editAnswers: string;
  // Status pills
  pillLikely: string;
  pillMoreInfo: string;
  pillUnlikely: string;
  // Errors + retry
  errTimeout: string;
  errAgentUnconfigured: string;
  errEngineDown: string;
  /** 400 with validation details: pass the joined human-readable field labels. */
  errBadRequest: (fields: string) => string;
  errTitle: string;
  tryAgain: string;
  // Offline demo
  offlineToggle: string;
  offlineToggleOn: string;
  offlineToggleA11y: string;
  offlineBanner: string;
  // Results: cards + states
  needMoreTitle: string;
  needMoreLead: string;
  needMoreTail: string;
  emptyTitle: string;
  noLikelyTitle: string;
  noLikelyBody: string;
  explanationTitle: string;
  seeHow: string;
  hideHow: string;
  closingDisclaimer: string;
  // Program card
  annualChip: string;
  sourcesShow: string;
  sourcesHide: string;
  howToApply: string;
  // Cascade ("one yes opens more doors")
  cascadeTitle: string;
  cascadeLead: string;
  cascadeTail: string;
  // Verification panel ("see how we know")
  verifyTitle: string;
  verifySub: string;
  verifyUnderstood: string;
  verifyNotStated: string;
  verifyYes: string;
  verifyNo: string;
  verifyShowRaw: string;
  verifyHideRaw: string;
  verifyMathTitle: (program: string) => string;
  verifyAssumptions: (list: string) => string;
  verifyGuardCaught: string;
  verifyGuardClean: string;
  verifyGuardCaughtBody: string;
  verifyGuardCleanBody: string;
  verifyGuardNoModelBody: string;
  verifyRunTest: string;
  verifyTestError: string;
  verifyBefore: string;
  verifyAfter: string;
  // Filer panel + consent gate (the filer boundary, stated to the user)
  filerTitle: string;
  filerBody: string;
  filerPrepare: string;
  filerError: string;
  filerStatus: (status: string) => string;
  filerOpenPdf: string;
  filerFilledFrom: string;
  filerYouComplete: string;
  consentTitle: string;
  consentBody: string;
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
    perOneTimeLabel: 'one-time, estimated',
    plusAnnualLine: (a) => `plus about ${a} a year in tax credits`,
    plusOneTimeLine: (a) => `plus about ${a} as a one-time payment`,
    estimateNote: 'This is an estimate — the office confirms the final amount when you apply.',
    startOver: 'Start over',
    editAnswers: 'Edit my answers',
    pillLikely: 'Likely qualifies',
    pillMoreInfo: 'Need a bit more',
    pillUnlikely: 'Probably not this time',
    errTimeout: 'That took too long, so we stopped waiting. Nothing was lost — check your connection and try again.',
    errAgentUnconfigured: 'Free-text screening needs the Gradient intake agent. Configure it on the local engine, or choose an example household.',
    errEngineDown: 'Nothing was lost. Check that the benefits engine is running, then try again.',
    errBadRequest: (fields) =>
      `We need a bit more before we can run the math. Missing or incomplete: ${fields}. Edit your answers and try again.`,
    errTitle: 'We can’t run that screening just now.',
    tryAgain: 'Try again',
    offlineToggle: 'Offline demo',
    offlineToggleOn: 'Offline demo: on',
    offlineToggleA11y: 'Toggle offline demo mode',
    offlineBanner: 'Offline demo — showing a saved sample household’s results, not your answers.',
    needMoreTitle: 'We need a bit more to screen honestly',
    needMoreLead: 'We never invent a number. Still missing: ',
    needMoreTail: '. Add that and we’ll run the real math.',
    emptyTitle: 'Nothing here yet',
    noLikelyTitle: 'No likely match from what you told us',
    noLikelyBody:
      'That can change with one detail — rent, childcare, or medical costs often tip the math. Add anything you left out and we’ll run it again.',
    explanationTitle: 'What this means for you',
    seeHow: 'See how we know ▾',
    hideHow: 'Hide how we know ▴',
    closingDisclaimer:
      'Benefit amounts are set by the office that handles your case — bring your questions to them, and treat everything here as a well-sourced head start, not a decision.',
    annualChip: 'Annual tax credit — one payment at tax time, not monthly',
    sourcesShow: 'Sources & next steps',
    sourcesHide: 'Hide sources & next steps',
    howToApply: 'How to apply →',
    cascadeTitle: 'One yes opens more doors',
    cascadeLead: 'Because this screening found you likely qualify for ',
    cascadeTail: ', these programs come with it:',
    verifyTitle: 'See how we know',
    verifySub: 'The AI only reads and explains. Every number comes from deterministic code you can check — here is all of it.',
    verifyUnderstood: 'Here’s what we understood',
    verifyNotStated: 'not stated — we never guess',
    verifyYes: 'yes',
    verifyNo: 'no',
    verifyShowRaw: 'Raw profile (JSON) ▾',
    verifyHideRaw: 'Hide raw profile ▴',
    verifyMathTitle: (p) => `${p} — the math, line by line`,
    verifyAssumptions: (list) => `Assumptions we made (and tell you about): ${list}`,
    verifyGuardCaught: 'Guardrail: caught and rewrote a promise',
    verifyGuardClean: 'Guardrail: clean',
    verifyGuardCaughtBody:
      'The model tried to phrase this as a guarantee — the deterministic guard rewrote it into honest estimate language before you saw it.',
    verifyGuardCleanBody: 'No guarantee language in this answer, and the estimate disclaimer is present.',
    verifyGuardNoModelBody: 'No model explanation on this run — these results are deterministic output only.',
    verifyRunTest: 'Run a test — try to make it promise $5,000',
    verifyTestError: 'We couldn’t run the test just now — nothing was lost. Try again in a moment.',
    verifyBefore: 'What the model tried to say',
    verifyAfter: 'What the guard let through',
    filerTitle: 'Get the paperwork started',
    filerBody:
      'We fill the official CalFresh application (CF 285) with what you told us — and stop there. You review it, add the personal items we never guess, sign it, and submit it yourself.',
    filerPrepare: 'Prepare my application',
    filerError: 'We couldn’t prepare the form just now — your info is safe. Try again.',
    filerStatus: (s) =>
      ({
        draft: 'Status: draft — nothing sent',
        ready_for_review: 'Status: ready for your review — nothing sent',
        staged_awaiting_user_submit: 'Status: staged, awaiting your submission — we never send it',
      })[s] ?? `Status: ${s.replace(/_/g, ' ')}`,
    filerOpenPdf: 'Open the filled CF 285 (PDF) →',
    filerFilledFrom: 'Filled from your answers',
    filerYouComplete: 'You complete these — we never guess',
    consentTitle: 'You review and submit — we never submit for you',
    consentBody:
      'This application is prepared, not sent. On our side it can never move past “staged, awaiting your submission.” When you’re ready: read every page, add anything we left blank, sign it, and submit it yourself — online, by mail, or in person.',
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
    perOneTimeLabel: 'pago único, estimado',
    plusAnnualLine: (a) => `más unos ${a} al año en créditos fiscales`,
    plusOneTimeLine: (a) => `más unos ${a} en un pago único`,
    estimateNote: 'Esto es un estimado — la oficina confirma el monto final cuando usted aplica.',
    startOver: 'Empezar de nuevo',
    editAnswers: 'Editar mis respuestas',
    pillLikely: 'Probablemente califica',
    pillMoreInfo: 'Falta un poco más',
    pillUnlikely: 'Probablemente esta vez no',
    errTimeout: 'Tardó demasiado y dejamos de esperar. No se perdió nada — revise su conexión e intente de nuevo.',
    errAgentUnconfigured: 'La evaluación con texto libre necesita el agente de entrada Gradient. Configúrelo en el motor local, o elija un hogar de ejemplo.',
    errEngineDown: 'No se perdió nada. Verifique que el motor de beneficios esté funcionando e intente de nuevo.',
    errBadRequest: (fields) =>
      `Necesitamos un poco más antes de hacer las cuentas. Falta o está incompleto: ${fields}. Edite sus respuestas e intente de nuevo.`,
    errTitle: 'No podemos hacer esa evaluación en este momento.',
    tryAgain: 'Intentar de nuevo',
    offlineToggle: 'Demo sin conexión',
    offlineToggleOn: 'Demo sin conexión: activada',
    offlineToggleA11y: 'Activar o desactivar la demo sin conexión',
    offlineBanner: 'Demo sin conexión — se muestran los resultados de un hogar de ejemplo guardado, no sus respuestas.',
    needMoreTitle: 'Necesitamos un poco más para evaluar con honestidad',
    needMoreLead: 'Nunca inventamos un número. Todavía falta: ',
    needMoreTail: '. Agréguelo y haremos las cuentas de verdad.',
    emptyTitle: 'Aún no hay nada aquí',
    noLikelyTitle: 'Con lo que nos contó, no encontramos una coincidencia probable',
    noLikelyBody:
      'Eso puede cambiar con un solo detalle — el alquiler, el cuidado de niños o los gastos médicos suelen inclinar las cuentas. Agregue lo que haya omitido y lo calculamos de nuevo.',
    explanationTitle: 'Qué significa esto para usted',
    seeHow: 'Vea cómo lo sabemos ▾',
    hideHow: 'Ocultar cómo lo sabemos ▴',
    closingDisclaimer:
      'Los montos de los beneficios los fija la oficina que maneja su caso — llévele sus preguntas a ella, y tome todo lo que ve aquí como un buen punto de partida con fuentes, no como una decisión.',
    annualChip: 'Crédito fiscal anual — un solo pago en la temporada de impuestos, no mensual',
    sourcesShow: 'Fuentes y próximos pasos',
    sourcesHide: 'Ocultar fuentes y próximos pasos',
    howToApply: 'Cómo aplicar →',
    cascadeTitle: 'Un sí abre más puertas',
    cascadeLead: 'Como esta evaluación encontró que usted probablemente califica para ',
    cascadeTail: ', estos programas vienen con ello:',
    verifyTitle: 'Vea cómo lo sabemos',
    verifySub: 'La IA solo lee y explica. Cada número sale de código determinista que usted puede revisar — aquí está todo.',
    verifyUnderstood: 'Esto es lo que entendimos',
    verifyNotStated: 'no indicado — nunca adivinamos',
    verifyYes: 'sí',
    verifyNo: 'no',
    verifyShowRaw: 'Perfil sin procesar (JSON) ▾',
    verifyHideRaw: 'Ocultar el perfil sin procesar ▴',
    verifyMathTitle: (p) => `${p} — las cuentas, línea por línea`,
    verifyAssumptions: (list) => `Suposiciones que hicimos (y le contamos): ${list}`,
    verifyGuardCaught: 'Barrera de seguridad: detectó y reescribió una promesa',
    verifyGuardClean: 'Barrera de seguridad: limpia',
    verifyGuardCaughtBody:
      'El modelo intentó expresar esto como una garantía — la barrera determinista lo reescribió en lenguaje honesto de estimado antes de que usted lo viera.',
    verifyGuardCleanBody: 'No hay lenguaje de garantía en esta respuesta, y el aviso de estimado está presente.',
    verifyGuardNoModelBody: 'No hubo explicación del modelo en esta corrida — estos resultados son solo salida determinista.',
    verifyRunTest: 'Haga una prueba — intente que prometa $5,000',
    verifyTestError: 'No pudimos hacer la prueba en este momento — no se perdió nada. Intente de nuevo en un momento.',
    verifyBefore: 'Lo que el modelo intentó decir',
    verifyAfter: 'Lo que la barrera dejó pasar',
    filerTitle: 'Empiece el papeleo',
    filerBody:
      'Llenamos la solicitud oficial de CalFresh (CF 285) con lo que usted nos contó — y ahí paramos. Usted la revisa, agrega los datos personales que nunca adivinamos, la firma y la presenta usted.',
    filerPrepare: 'Preparar mi solicitud',
    filerError: 'No pudimos preparar el formulario en este momento — su información está segura. Intente de nuevo.',
    filerStatus: (s) =>
      ({
        draft: 'Estado: borrador — no se ha enviado nada',
        ready_for_review: 'Estado: listo para su revisión — no se ha enviado nada',
        staged_awaiting_user_submit: 'Estado: preparado, en espera de que usted lo presente — nosotros nunca lo enviamos',
      })[s] ?? `Estado: ${s.replace(/_/g, ' ')}`,
    filerOpenPdf: 'Abrir el CF 285 llenado (PDF) →',
    filerFilledFrom: 'Llenado con sus respuestas',
    filerYouComplete: 'Usted completa estos — nunca adivinamos',
    consentTitle: 'Usted revisa y presenta — nosotros nunca lo presentamos por usted',
    consentBody:
      'Esta solicitud está preparada, no enviada. De nuestro lado nunca puede pasar de «preparada, en espera de que usted la presente». Cuando esté listo: lea cada página, agregue lo que dejamos en blanco, fírmela y preséntela usted — en línea, por correo o en persona.',
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
    perOneTimeLabel: '一次性（估算）',
    plusAnnualLine: (a) => `另加每年约 ${a} 的税收抵免`,
    plusOneTimeLine: (a) => `另加约 ${a} 的一次性付款`,
    estimateNote: '这是估算 — 您申请时由办事处确认最终金额。',
    startOver: '重新开始',
    editAnswers: '修改我的回答',
    pillLikely: '很可能符合',
    pillMoreInfo: '还需要一点信息',
    pillUnlikely: '这次可能不符合',
    errTimeout: '等待时间过长，我们停止了请求。您的信息没有丢失 — 请检查网络连接后再试。',
    errAgentUnconfigured: '自由文字筛查需要 Gradient 信息读取代理。请在本地引擎上配置它，或选择一个示例家庭。',
    errEngineDown: '您的信息没有丢失。请确认福利计算引擎正在运行，然后再试一次。',
    errBadRequest: (fields) => `在计算之前我们还需要一点信息。缺失或不完整：${fields}。请修改您的回答后再试。`,
    errTitle: '目前无法进行这次筛查。',
    tryAgain: '再试一次',
    offlineToggle: '离线演示',
    offlineToggleOn: '离线演示：已开启',
    offlineToggleA11y: '开关离线演示模式',
    offlineBanner: '离线演示 — 显示的是预先保存的示例家庭结果，不是您的回答。',
    needMoreTitle: '我们还需要一点信息才能如实筛查',
    needMoreLead: '我们绝不凭空编造数字。还缺少：',
    needMoreTail: '。补上之后我们就能进行真正的计算。',
    emptyTitle: '这里还没有内容',
    noLikelyTitle: '根据您告诉我们的情况，暂时没有找到很可能符合的项目',
    noLikelyBody: '一个细节就可能改变结果 — 房租、托儿或医疗费用常常会影响计算。补充遗漏的信息，我们再算一次。',
    explanationTitle: '这对您意味着什么',
    seeHow: '看看我们如何得知 ▾',
    hideHow: '收起我们如何得知 ▴',
    closingDisclaimer: '福利金额由负责您案件的办事处决定 — 有疑问请咨询他们。这里的一切只是一个有据可查的起点，不是决定。',
    annualChip: '年度税收抵免 — 报税时一次性发放，不是每月发放',
    sourcesShow: '来源和下一步',
    sourcesHide: '收起来源和下一步',
    howToApply: '如何申请 →',
    cascadeTitle: '一个「是」打开更多扇门',
    cascadeLead: '由于本次筛查发现您很可能符合',
    cascadeTail: '的条件，这些项目也随之开放：',
    verifyTitle: '看看我们如何得知',
    verifySub: 'AI 只负责阅读和解释。每个数字都来自您可以核查的确定性代码 — 全部内容都在这里。',
    verifyUnderstood: '这是我们理解到的信息',
    verifyNotStated: '未提供 — 我们从不猜测',
    verifyYes: '是',
    verifyNo: '否',
    verifyShowRaw: '原始档案（JSON）▾',
    verifyHideRaw: '收起原始档案 ▴',
    verifyMathTitle: (p) => `${p} — 逐行计算`,
    verifyAssumptions: (list) => `我们做出（并告知您）的假设：${list}`,
    verifyGuardCaught: '安全护栏：拦截并改写了一句承诺',
    verifyGuardClean: '安全护栏：无问题',
    verifyGuardCaughtBody: '模型试图把这说成保证 — 确定性护栏在您看到之前把它改写成了诚实的估算表述。',
    verifyGuardCleanBody: '这条回答中没有保证性措辞，并且已附上估算说明。',
    verifyGuardNoModelBody: '本次运行没有模型解释 — 这些结果完全来自确定性计算。',
    verifyRunTest: '做个测试 — 试着让它承诺 $5,000',
    verifyTestError: '目前无法运行测试 — 您的信息没有丢失。请稍后再试。',
    verifyBefore: '模型试图说的话',
    verifyAfter: '护栏放行的内容',
    filerTitle: '开始准备申请材料',
    filerBody: '我们用您告诉我们的信息填写官方 CalFresh 申请表（CF 285）— 到此为止。您来审阅，补上我们从不猜测的个人信息，签名，然后由您自己提交。',
    filerPrepare: '准备我的申请',
    filerError: '目前无法准备表格 — 您的信息是安全的。请再试一次。',
    filerStatus: (s) =>
      ({
        draft: '状态：草稿 — 尚未发送任何内容',
        ready_for_review: '状态：待您审阅 — 尚未发送任何内容',
        staged_awaiting_user_submit: '状态：已备好，等待您提交 — 我们从不代您发送',
      })[s] ?? `状态：${s.replace(/_/g, ' ')}`,
    filerOpenPdf: '打开已填写的 CF 285（PDF）→',
    filerFilledFrom: '根据您的回答填写',
    filerYouComplete: '这些由您来填 — 我们从不猜测',
    consentTitle: '您审阅并提交 — 我们从不代您提交',
    consentBody:
      '这份申请只是准备好了，并没有发送。在我们这边，它永远不会越过「已备好，等待您提交」这一步。当您准备好时：读完每一页，补上我们留空的内容，签名，然后由您自己提交 — 在线、邮寄或亲自前往均可。',
  },
};
