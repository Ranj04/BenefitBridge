/**
 * VERIFY GATES A–E for voice-multilingual intake (adversarial, Playwright).
 * The Web Speech API cannot be driven by real audio in CI, so SpeechRecognition
 * is mocked at the window level and DRIVEN FROM THE TEST (interim/final/error
 * events) — the entire app-side path (hook → field → submit → /chat body) is
 * real. /chat is route-intercepted with the committed offline fixture so the
 * gates are deterministic and hit no live agent.
 *
 *   npx tsx scripts/verify-voice.mts
 */
import { chromium, type Page, type Route } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const DIST = 'app/dist';
const S = {
  start: 'Start',
  check: 'See what I qualify for',
  micStart: 'Speak instead of typing',
  listening: 'Listening… speak now',
  micDenied: 'Microphone permission was denied',
  readAloud: 'Read this aloud',
  intakeTitle: 'Tell us about your home',
  esCheck: 'Ver para qué califico',
  esMicStart: 'Hable en lugar de escribir',
};

const fixture = JSON.parse(readFileSync('app/fixtures/offline.json', 'utf8'));
const CANNED_EN = fixture.personas.p1; // real captured ChatResponse
const CANNED_ES = { ...CANNED_EN, explanation: '¡Hola! Según lo que nos contó, es probable que califique para CalFresh, aproximadamente $159 al mes. Esto es un estimado, no una determinación.' };

const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf' };

function serveDist(port: number) {
  const srv = createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0]!.replace(/^\/app/, '') || '/';
    let file = join(DIST, path === '/' ? 'index.html' : path);
    if (!existsSync(file)) file = join(DIST, 'index.html');
    try {
      const body = readFileSync(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise<() => void>((resolve) => srv.listen(port, () => resolve(() => srv.close())));
}

// ---- window-level mocks -----------------------------------------------------
const MOCK_ASR = `
  window.__asr = { instances: [] };
  window.SpeechRecognition = class {
    constructor(){ this.lang=''; this.continuous=false; this.interimResults=false;
      this.onresult=null; this.onerror=null; this.onend=null; window.__asr.instances.push(this); }
    start(){ window.__asr.started = (window.__asr.started||0)+1; }
    stop(){ this.onend && this.onend(); }
    abort(){ this.onend && this.onend(); }
  };
  Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true });
`;
const NO_ASR = `
  Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true });
  Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true });
`;
const MOCK_TTS = `
  window.__tts = [];
  // window.speechSynthesis is a readonly accessor — plain assignment silently
  // no-ops and the app would use the real (silent, headless) synthesis.
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value:
    class { constructor(t){ this.text=t; this.lang=''; this.voice=null; this.onend=null; this.onerror=null; } } });
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
    cancel(){}, pause(){}, resume(){},
    speak(u){ window.__tts.push({ text: u.text, lang: u.lang, voice: u.voice && u.voice.lang }); u.onend && u.onend(); },
    getVoices(){ return [ { lang:'en-US', name:'MockEN' }, { lang:'es-US', name:'MockES' }, { lang:'zh-CN', name:'MockZH' } ]; },
    addEventListener(){}, removeEventListener(){},
  } });
`;

// Drive the newest mock recognition instance from the test side.
const emitInterim = (page: Page, text: string) =>
  page.evaluate((t) => {
    const r = (window as any).__asr.instances.at(-1);
    r.onresult({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript: t }, length: 1 }] });
  }, text);
const emitFinal = (page: Page, text: string) =>
  page.evaluate((t) => {
    const r = (window as any).__asr.instances.at(-1);
    r.onresult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: t }, length: 1 }] });
    r.onend && r.onend();
  }, text);
const emitError = (page: Page, code: string) =>
  page.evaluate((c) => {
    const r = (window as any).__asr.instances.at(-1);
    r.onerror({ error: c });
    r.onend && r.onend();
  }, code);

async function eventually(fn: () => Promise<boolean>, ms = 5000): Promise<boolean> {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if (await fn()) return true; } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

let pass = 0, fail = 0;
const check = (label: string, cond: boolean, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${cond || !detail ? '' : `  [${detail}]`}`);
  cond ? pass++ : fail++;
};

async function main() {
  const stop = await serveDist(8123);
  const browser = await chromium.launch();

  const chatBodies: { text: string }[] = [];
  const intercept = (canned: unknown) => async (route: Route) => {
    chatBodies.push(route.request().postDataJSON() as { text: string });
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(canned) });
  };

  const newPage = async (init: string, canned: unknown, locale = 'en-US') => {
    const ctx = await browser.newContext({ locale });
    await ctx.addInitScript(init);
    const page = await ctx.newPage();
    await page.route('**/chat', intercept(canned));
    await page.goto('http://127.0.0.1:8123/app/');
    await page.getByLabel(S.start).click();
    await page.getByLabel(S.intakeTitle).waitFor();
    return { ctx, page };
  };

  // ---------- GATE A1: no SpeechRecognition at all ---------------------------
  {
    const { ctx, page } = await newPage(NO_ASR + MOCK_TTS, CANNED_EN);
    check('A1: mic hidden when SpeechRecognition is absent', (await page.getByLabel(S.micStart).count()) === 0);
    await page.getByLabel(S.intakeTitle).fill('single mom in SF, about $2,800 a month, one kid, renting');
    await page.getByLabel(S.check).click();
    await page.getByText('CalFresh').first().waitFor({ timeout: 15_000 });
    check('A1: text-only intake still completes to results (no crash, no dead UI)', true);
    await ctx.close();
  }

  // ---------- GATE A2: mic permission denied ---------------------------------
  {
    const { ctx, page } = await newPage(MOCK_ASR + MOCK_TTS, CANNED_EN);
    await page.getByLabel(S.micStart).click();
    await emitError(page, 'not-allowed');
    check('A2: permission denied → short message shown', await eventually(async () => (await page.getByText(new RegExp('permission was denied')).count()) > 0));
    await page.getByLabel(S.intakeTitle).fill('typing still works after denial');
    check('A2: text field still editable after denial', (await page.getByLabel(S.intakeTitle).inputValue()) === 'typing still works after denial');
    await ctx.close();
  }

  // ---------- GATE B: English speech → interim → editable final → submit -----
  {
    const { ctx, page } = await newPage(MOCK_ASR + MOCK_TTS, CANNED_EN);
    const before = chatBodies.length;
    await page.getByLabel(S.micStart).click();
    check('B: listening state announced', await page.getByText(new RegExp(S.listening.slice(0, 12))).isVisible());
    await emitInterim(page, 'single mom in SF');
    check('B: interim transcript visible while speaking', await eventually(async () => (await page.getByText('single mom in SF', { exact: true }).count()) > 0));
    await emitFinal(page, 'single mom in SF, about $2,800 a month, one kid, renting');
    check('B: final transcript lands in the EDITABLE field', await eventually(async () => (await page.getByLabel(S.intakeTitle).inputValue()).includes('$2,800')));
    check('B: nothing auto-submitted', chatBodies.length === before);
    const asrLang = await page.evaluate(() => (window as any).__asr.instances.at(-1).lang);
    check('B: recognition lang follows selector (en-US)', asrLang === 'en-US', asrLang);
    await page.getByLabel(S.check).click();
    await page.getByText('CalFresh').first().waitFor({ timeout: 15_000 });
    const sent = chatBodies.at(-1)!.text;
    check('B: submitted text = transcript + language hint', sent.includes('$2,800') && sent.includes('preferred language is English'));

    // ---------- GATE E (en): read the disclaimered explanation aloud ---------
    await page.getByLabel(S.readAloud).first().click();
    await eventually(async () => (await page.evaluate(() => (window as any).__tts.length)) > 0);
    const tts = await page.evaluate(() => (window as any).__tts.at(-1));
    check('E: read-aloud speaks in the selected language voice', tts?.lang === 'en-US', JSON.stringify(tts?.lang));
    check('E: spoken text is the on-screen disclaimered explanation (no bare-number guarantee)', /estimate/i.test(tts?.text ?? '') && !/guarantee/i.test(tts?.text ?? ''));
    await ctx.close();
  }

  // ---------- GATE C: Spanish ------------------------------------------------
  {
    const { ctx, page } = await newPage(MOCK_ASR + MOCK_TTS, CANNED_ES);
    await page.getByLabel('Spanish').click(); // chip a11yLabel is the English name
    await page.getByLabel(S.esMicStart).click();
    const asrLang = await page.evaluate(() => (window as any).__asr.instances.at(-1).lang);
    check('C: recognition lang switched to es-US', asrLang === 'es-US', asrLang);
    await emitFinal(page, 'madre soltera en SF, unos $2,800 al mes, un hijo, alquilando');
    await page.getByLabel(S.esCheck).click();
    await page.getByText('CalFresh').first().waitFor({ timeout: 15_000 });
    const sent = chatBodies.at(-1)!.text;
    check('C: Spanish transcript + Spanish language hint passed through', sent.includes('madre soltera') && /Spanish|español/.test(sent));
    check('C: explanation rendered in Spanish', await page.getByText(/probable que califique/).isVisible());
    await ctx.close();
  }

  // ---------- GATE D: garbled transcript is corrected before submit ----------
  {
    const { ctx, page } = await newPage(MOCK_ASR + MOCK_TTS, CANNED_EN);
    const before = chatBodies.length;
    await page.getByLabel(S.micStart).click();
    await emitFinal(page, 'sing gull mum insist F twenty 800 month');
    check('D: garbled final did NOT auto-submit', chatBodies.length === before);
    // Edit like a human: select-all + retype (programmatic fill() on a
    // non-empty RN-web controlled TextInput concatenates via React's value
    // tracker — real keystrokes are both accurate and the realistic path).
    const field = page.getByLabel(S.intakeTitle);
    await field.click();
    await field.press('ControlOrMeta+a');
    await field.pressSequentially('single mom in SF, about $2,800 a month, one kid, renting');
    check('D: garbled transcript was fully editable before submit', await eventually(async () => {
      const v = await field.inputValue();
      return v.includes('$2,800 a month') && !v.includes('sing gull');
    }));
    await page.getByLabel(S.check).click();
    await page.getByText('CalFresh').first().waitFor({ timeout: 15_000 });
    check('D: the CORRECTED text was submitted, not the garbled ASR output', chatBodies.at(-1)!.text.includes('$2,800 a month') && !chatBodies.at(-1)!.text.includes('sing gull'), JSON.stringify(chatBodies.at(-1)!.text.slice(0, 120)));
    await ctx.close();
  }

  await browser.close();
  stop();
  console.log(`\nVOICE GATES: ${pass} passed, ${fail} failed → ${fail === 0 ? 'GREEN' : 'RED'}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
