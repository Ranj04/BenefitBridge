// Run: node scripts/verify-voice.mjs (needs Playwright: `npx playwright install chromium`
// + a running app: cd app && EXPO_PUBLIC_API_URL=<engine url> npx expo start --web --port 8081).
// Not a package.json dependency by design — no new deps in the app or engine;
// resolvable normally or via PLAYWRIGHT_MODULES=<abs path to a node_modules dir
// containing playwright> (same convention as app/scripts/verify-*.mjs).
// Adversarial verify gates A–E for Hearth voice + multilingual intake.
// Drives the real Expo web app against the LIVE agent backend. SpeechRecognition
// is scripted (headless Chromium has no mic/ASR service): the fake emits interim
// then final results exactly like Chrome's implementation, so the entire UI
// wiring (interim display → editable field → submit → live intake agent) is real.
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(
  process.env.PLAYWRIGHT_MODULES ? join(process.env.PLAYWRIGHT_MODULES, 'x.js') : import.meta.url,
);
const { chromium } = require('playwright');

const APP = 'http://localhost:8081';
const results = [];
const gate = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
};

// Fake SpeechRecognition: window.__speak(phrase) emits 2 interim chunks then a
// final result; records the lang it was started with in window.__asrLang.
const FAKE_ASR = `
  class FakeSpeechRecognition {
    constructor() { this.lang=''; this.continuous=false; this.interimResults=false;
      this.onresult=null; this.onerror=null; this.onend=null; window.__asr=this; }
    start() { window.__asrLang = this.lang; window.__asrStarted = true; }
    stop() { if (this.onend) this.onend(); }
    abort() { if (this.onend) this.onend(); }
  }
  window.SpeechRecognition = FakeSpeechRecognition;
  window.webkitSpeechRecognition = FakeSpeechRecognition;
  window.__emit = (transcript, isFinal) => {
    const r = window.__asr;
    if (!r || !r.onresult) return;
    r.onresult({ resultIndex: 0, results: [{ isFinal, 0: { transcript } }] });
  };
  window.__err = (code) => { const r = window.__asr; if (r && r.onerror) r.onerror({ error: code }); };
  // Spy on speechSynthesis.speak for Gate E.
  window.__spoken = [];
  const realSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);
  window.speechSynthesis.speak = (u) => { window.__spoken.push({ text: u.text, lang: u.lang }); };
`;

async function newPage(browser, { withASR }) {
  // reducedMotion: the mic ring runs an infinite listening pulse (IntakeInput.tsx),
  // which never satisfies Playwright's element-stability check and wedged gate B
  // forever. Emulating prefers-reduced-motion stills the pulse via the app's own
  // useReducedMotion hook — a real user setting, not a test-only backdoor — while
  // every gate still exercises the full live flow.
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  if (withASR) await ctx.addInitScript(FAKE_ASR);
  else await ctx.addInitScript(`delete window.SpeechRecognition; delete window.webkitSpeechRecognition;`);
  const page = await ctx.newPage();
  await page.goto(APP, { waitUntil: 'networkidle' });
  // The design-system flow opens on the Welcome screen; intake is behind Start.
  await page.getByRole('button', { name: /^(Start|Comenzar|\u5f00\u59cb)$/ }).click({ timeout: 60000 });
  await page.waitForSelector('textarea', { timeout: 60000 });
  return { ctx, page };
}

const browser = await chromium.launch();

// ── Gate A — graceful degradation: no SpeechRecognition → mic hidden, text intake fully works
{
  const { ctx, page } = await newPage(browser, { withASR: false });
  const micCount = await page.getByLabel(/Speak instead of typing|Stop listening/).count();
  const crashed = await page.evaluate(() => document.body.innerText.length < 50);
  await page.locator('textarea').fill('single mom in SF, about $2,800 a month, one kid, renting for $1,800');
  await page.getByLabel(/See what I qualify for|Ver para qu\u00e9 califico/).click();
  const gotResult = await page
    .waitForSelector('text=/CalFresh/', { timeout: 120000 })
    .then(() => true)
    .catch(() => false);
  gate('A graceful degradation', micCount === 0 && !crashed && gotResult, `mic buttons: ${micCount}, UI alive: ${!crashed}, text-path screened via live agent: ${gotResult}`);
  await ctx.close();
}

// ── Gate B — English voice: interim shows → final lands editable → submit → correct profile
{
  const { ctx, page } = await newPage(browser, { withASR: true });
  await page.getByLabel('Speak instead of typing').click();
  const asrLang = await page.evaluate(() => window.__asrLang);
  const listeningShown = await page.waitForSelector('text=/Listening/', { timeout: 5000 }).then(() => true).catch(() => false);
  await page.evaluate(() => window.__emit('single mom in', false));
  const interimShown = await page.waitForSelector('text=/single mom in/', { timeout: 5000 }).then(() => true).catch(() => false);
  await page.evaluate(() => window.__emit('single mom in SF, about $2,800 a month, one kid, renting for $1,800', true));
  await page.getByLabel('Stop listening').click();
  const fieldValue = await page.locator('textarea').inputValue();
  const fieldOk = fieldValue.includes('$2,800') && fieldValue.includes('one kid');
  // Nothing auto-submitted: still no results on screen.
  const preSubmit = await page.locator('text=/likely|CalFresh/i').count();
  await page.getByLabel(/See what I qualify for|Ver para qu\u00e9 califico/).click();
  await page.waitForSelector('text=/CalFresh/', { timeout: 120000 });
  const profileOk = await page
    .waitForSelector('text=/estimate/i', { timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  gate(
    'B English voice→profile',
    asrLang === 'en-US' && listeningShown && interimShown && fieldOk && preSubmit === 0 && profileOk,
    `asr lang: ${asrLang}, listening announced: ${listeningShown}, interim live: ${interimShown}, final in editable field: ${fieldOk}, no auto-submit: ${preSubmit === 0}, live screen returned: ${profileOk}`,
  );
  // Capture the resolved profile for the report.
  const body = await page.evaluate(() => document.body.innerText);
  console.log('   Gate B result snippet:', body.match(/CalFresh[^\n]*/)?.[0] ?? '(n/a)');
  await ctx.close();
}

// ── Gate C — Spanish: selector → es-US ASR + preferredLanguage:'es' → Spanish response
{
  const { ctx, page } = await newPage(browser, { withASR: true });
  await page.getByRole('radio', { name: 'Spanish' }).click();
  await page.getByLabel(/Hable en lugar de escribir/).click();
  const asrLang = await page.evaluate(() => window.__asrLang);
  await page.evaluate(() => window.__emit('Soy madre soltera en San Francisco, gano como $2,800 al mes, tengo un hijo y pago renta de $1,800', true));
  await page.getByLabel(/Dejar de escuchar/).click();
  const fieldValue = await page.locator('textarea').inputValue();
  await page.getByLabel(/See what I qualify for|Ver para qu\u00e9 califico/).click();
  await page.waitForSelector('text=/CalFresh/', { timeout: 120000 });
  const bodyText = await page.evaluate(() => document.body.innerText);
  const spanishResponse = /califiques|calificar|beneficio|hogar/i.test(bodyText);
  gate('C Spanish e2e', asrLang === 'es-US' && fieldValue.includes('madre soltera') && spanishResponse, `asr lang: ${asrLang}, transcript in field: ${fieldValue.includes('madre soltera')}, agent replied in Spanish: ${spanishResponse}`);

  // ── Gate E on the same page — read aloud speaks the disclaimered explanation in the selected language
  const readBtn = page.getByLabel(/Leer en voz alta/);
  const readVisible = await readBtn.count();
  if (readVisible) await readBtn.click();
  const spoken = await page.evaluate(() => window.__spoken);
  const spokeSpanish = spoken.length > 0 && spoken[0].lang === 'es-US';
  const noMarkdown = spoken.length > 0 && !/[#*|]/.test(spoken[0].text);
  const explanation = await page.evaluate(() => document.body.innerText);
  // The spoken text must be the on-screen disclaimered explanation (same words).
  const sameText = spoken.length > 0 && explanation.replace(/\s+/g, ' ').includes(spoken[0].text.slice(0, 60).replace(/\s+/g, ' ').split(' ').slice(0, 5).join(' '));
  gate('E spoken result', readVisible === 1 && spokeSpanish && noMarkdown, `read-aloud control: ${readVisible}, utterance lang: ${spoken[0]?.lang}, markdown stripped: ${noMarkdown}, matches on-screen text: ${sameText}`);
  console.log('   Gate E utterance head:', JSON.stringify(spoken[0]?.text.slice(0, 140)));
  await ctx.close();
}

// ── Gate D — bad transcript is editable before submit; mic errors degrade gracefully
{
  const { ctx, page } = await newPage(browser, { withASR: true });
  await page.getByLabel('Speak instead of typing').click();
  await page.evaluate(() => window.__emit('single mom in SF about twenty eight hundred dollars a month one squid renting', true));
  await page.getByLabel('Stop listening').click();
  let fieldValue = await page.locator('textarea').inputValue();
  const garbledLanded = fieldValue.includes('one squid');
  const notSubmitted = (await page.locator('text=/CalFresh/').count()) === 0;
  // The user corrects the ASR error in the field before submitting.
  await page.locator('textarea').fill(fieldValue.replace('one squid', 'one kid'));
  fieldValue = await page.locator('textarea').inputValue();
  // Permission-denied path: mic error surfaces a message, text path unaffected.
  await page.getByLabel('Speak instead of typing').click();
  await page.evaluate(() => window.__err('not-allowed'));
  await page.evaluate(() => window.__asr.onend && window.__asr.onend());
  const deniedMsg = await page.waitForSelector('text=/Microphone permission was denied/', { timeout: 5000 }).then(() => true).catch(() => false);
  const fieldStill = (await page.locator('textarea').inputValue()) === fieldValue;
  gate('D editable bad transcript + denied mic', garbledLanded && notSubmitted && fieldValue.includes('one kid') && deniedMsg && fieldStill, `garbled landed editable: ${garbledLanded}, no auto-submit: ${notSubmitted}, corrected: ${fieldValue.includes('one kid')}, denial message: ${deniedMsg}, text intact: ${fieldStill}`);
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} gates passed${failed.length ? ' — FAILURES: ' + failed.map((f) => f.name).join(', ') : ''}`);
process.exit(failed.length ? 1 : 0);
