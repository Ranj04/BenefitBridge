// Adversarial verify gates for opt-in on-device save & resume (feat/save-resume).
// Drives the exported web bundle (app/dist) in real Chromium and checks the
// gates from the phase prompt:
//   A consent   — save OFF: nothing in storage, nothing restored after reload
//   B resume    — save ON: reload → Resume restores profile+step and re-runs /screen
//   C clear     — "Clear my information" deletes the key and resets the UI
//   D sensitive — web storage blob never contains immigrationStatus
//   E expiry    — a blob savedAt 8 days ago is silently discarded on load
//   F no server — zero network requests leave localhost; no /screen|/chat during save/load
// (Gate G native is covered by typecheck + the Platform-gated backend; this
// script IS the web half of gate G.)
//
// Usage: node scripts/verify-save-resume.mjs
//   Requires playwright (resolvable normally, or via PLAYWRIGHT_MODULES=<abs
//   path to a node_modules dir containing playwright>).
import { createRequire } from 'node:module';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(
  process.env.PLAYWRIGHT_MODULES ? join(process.env.PLAYWRIGHT_MODULES, 'x.js') : import.meta.url,
);
const { chromium } = require('playwright');

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const PORT = 4173;
const ORIGIN = `http://localhost:${PORT}`;
const KEY = 'benefitbridge.session.v1';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.png': 'image/png' };

// ---------- fixtures (shapes mirror app/src/types.ts) ----------
const result = (amount, reason) => ({
  program: 'CalFresh',
  screening: 'likely_qualify',
  estimatedBenefit: { amount, period: 'monthly' },
  computation: [{ label: 'Net income test', value: amount }],
  assumptions: [],
  reason,
  citations: [{ text: 'CDSS ACIN', source_url: 'https://www.cdss.ca.gov/', as_of: '2026-07-10' }],
  applyUrl: 'https://www.getcalfresh.org/',
  disclaimer: 'Estimate only.',
});
const PROFILE = { householdSize: 2, monthlyIncomeDollars: 2800, immigrationStatus: 'lawful_permanent_resident', rentDollars: 1800 };
const CHAT_FIXTURE = { profile: PROFILE, results: [result(300, 'Initial run')], explanation: 'You likely qualify.', guard: { rewritten: false, disclaimerAppended: true }, needMoreInfo: null, agentLayer: 'live' };
const SCREEN_FIXTURE = [result(351, 'Fresh re-run after resume')]; // 351 ≠ 300 proves resume shows /screen's CURRENT answer

const INTAKE_TEXT = 'single mom in SF, about $2,800 a month, one kid, renting for $1,800';

let failures = 0;
const gate = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

function serveDist() {
  const server = http.createServer(async (req, res) => {
    const path = req.url.split('?')[0];
    try {
      const file = await readFile(join(DIST, path === '/' ? 'index.html' : path));
      res.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'application/octet-stream' });
      res.end(file);
    } catch {
      const index = await readFile(join(DIST, 'index.html'));
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(index); // SPA fallback
    }
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

const storageRaw = (page) => page.evaluate((k) => localStorage.getItem(k), KEY);

async function newPage(browser, requestLog) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('request', (r) => requestLog.push(r.url()));
  await page.route('**/chat', (route) => route.fulfill({ json: CHAT_FIXTURE }));
  await page.route('**/screen', (route) => route.fulfill({ json: SCREEN_FIXTURE }));
  return { context, page };
}

const server = await serveDist();
const browser = await chromium.launch();
const allRequests = [];

try {
  // ---------- Gate A: consent — save OFF means zero persistence ----------
  {
    const { context, page } = await newPage(browser, allRequests);
    await page.goto(ORIGIN);
    await page.getByRole('button', { name: 'Start' }).click();
    await page.getByLabel('Tell us about your home').fill(INTAKE_TEXT);
    await page.waitForTimeout(1500); // well past the 600ms autosave debounce
    gate('A1 nothing written with save off', (await storageRaw(page)) === null);
    await page.reload();
    await page.waitForTimeout(800);
    gate('A2 no resume prompt after reload', !(await page.getByText('Resume where you left off?').isVisible().catch(() => false)));
    gate('A3 storage still empty after reload', (await storageRaw(page)) === null);
    await context.close();
  }

  // ---------- Gates B, C, D: opt-in → autosave → resume → clear ----------
  {
    const { context, page } = await newPage(browser, allRequests);
    const screenBodies = [];
    await page.route('**/screen', (route) => {
      screenBodies.push(route.request().postData());
      return route.fulfill({ json: SCREEN_FIXTURE });
    });
    await page.goto(ORIGIN);
    await page.getByRole('button', { name: 'Start' }).click();
    await page.getByLabel('Tell us about your home').fill(INTAKE_TEXT);
    await page.getByRole('switch', { name: 'Save my progress on this device' }).click();
    await page.waitForTimeout(1200);
    const draft = JSON.parse((await storageRaw(page)) ?? 'null');
    gate('B1 opt-in autosaves draft (step+text+lang, no profile yet)',
      draft?.flowStep === 'intake' && draft?.intakeText === INTAKE_TEXT && draft?.preferredLanguage === 'en' && draft?.profile === null,
      JSON.stringify(draft)?.slice(0, 80));

    await page.getByRole('button', { name: 'See what I qualify for' }).click();
    await page.getByText('$300').first().waitFor({ timeout: 5000 }); // initial /chat result on screen
    await page.waitForTimeout(1200);
    const withProfile = (await storageRaw(page)) ?? '';
    gate('B2 autosave now includes extracted profile', JSON.parse(withProfile).profile?.householdSize === 2);
    gate('D  immigrationStatus never in web storage', !withProfile.includes('immigrationStatus') && !withProfile.includes('lawful_permanent_resident'));
    gate('D2 saved results never persisted', !withProfile.includes('$300') && !JSON.parse(withProfile).results && !withProfile.includes('estimatedBenefit'));

    await page.reload();
    await page.getByText('Resume where you left off?').waitFor({ timeout: 5000 });
    gate('B3 resume prompt offered after reload', true);
    const screenCallsBefore = screenBodies.length;
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await page.getByText('$351').first().waitFor({ timeout: 5000 });
    gate('B4 resume re-ran /screen and shows FRESH numbers (351, not saved-era 300)', screenBodies.length === screenCallsBefore + 1);
    gate('B5 /screen re-run body is the saved profile, still without immigrationStatus',
      !!screenBodies.at(-1) && screenBodies.at(-1).includes('householdSize') && !screenBodies.at(-1).includes('immigrationStatus'));

    // Gate C: two-tap clear from the header
    await page.getByRole('button', { name: 'Clear my information' }).click();
    await page.getByRole('button', { name: 'Tap again to confirm' }).click();
    await page.waitForTimeout(400);
    gate('C1 key deleted from localStorage', (await storageRaw(page)) === null);
    gate('C2 UI reset to welcome', await page.getByRole('button', { name: 'Start' }).isVisible());
    await page.getByRole('button', { name: 'Start' }).click();
    gate('C3 intake draft wiped from memory too', (await page.getByLabel('Tell us about your home').inputValue()) === '');
    await page.waitForTimeout(1200);
    gate('C4 nothing re-saved after clear (save consent reset)', (await storageRaw(page)) === null);
    await context.close();
  }

  // ---------- Gate E: 8-day-old session is discarded on load ----------
  {
    const { context, page } = await newPage(browser, allRequests);
    const stale = JSON.stringify({ v: 1, profile: { householdSize: 2 }, flowStep: 'intake', intakeText: 'old draft', preferredLanguage: 'en', savedAt: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString() });
    await context.addInitScript(([k, v]) => localStorage.setItem(k, v), [KEY, stale]);
    await page.goto(ORIGIN);
    await page.waitForTimeout(1200);
    gate('E1 no resume prompt for an 8-day-old session', !(await page.getByText('Resume where you left off?').isVisible().catch(() => false)));
    gate('E2 stale blob wiped from storage on load', (await storageRaw(page)) === null);
    await context.close();
  }

  // ---------- Gate F: storage is fully local — nothing leaves localhost ----------
  {
    const offOrigin = allRequests.filter((u) => !u.startsWith(ORIGIN));
    gate('F1 zero requests left localhost across every scenario', offOrigin.length === 0, offOrigin.slice(0, 3).join(', '));
    const apiCalls = allRequests.filter((u) => /\/(chat|screen)$/.test(u));
    gate('F2 API calls are exactly: 1 explicit submit + 1 resume re-run', apiCalls.length === 2, `saw ${apiCalls.length}`);
  }
} finally {
  await browser.close();
  server.close();
}

console.log(failures === 0 ? '\nALL GATES PASS' : `\n${failures} GATE(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
