// P8 a11y gate: run axe-core (WCAG 2.0/2.1 A + AA) against the exported web
// bundle on all three screens — welcome, intake, and results (rendered from
// the committed offline fixture, so no network). Produces the pass/fail list
// that docs/a11y.md records.
//
// Usage: node scripts/verify-a11y.mjs [path-to-axe.min.js]
//   Requires playwright (resolvable normally, or via PLAYWRIGHT_MODULES) and
//   an axe.min.js (default: /tmp/package/axe.min.js from `npm pack axe-core`).
import { createRequire } from 'node:module';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(
  process.env.PLAYWRIGHT_MODULES ? join(process.env.PLAYWRIGHT_MODULES, 'x.js') : import.meta.url,
);
const { chromium } = require('playwright');

const AXE_PATH = process.argv[2] ?? '/tmp/package/axe.min.js';
const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const PORT = 4175;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.png': 'image/png' };

function serveDist() {
  const server = http.createServer(async (req, res) => {
    const path = req.url.split('?')[0].replace(/^\/app(\/|$)/, '/');
    const target = path === '/' ? '/index.html' : path;
    try {
      const file = await readFile(join(DIST, target));
      res.writeHead(200, { 'content-type': MIME[extname(target)] ?? 'application/octet-stream' });
      res.end(file);
    } catch {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(await readFile(join(DIST, 'index.html')));
    }
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

const axeSource = await readFile(AXE_PATH, 'utf8');
const server = await serveDist();
const browser = await chromium.launch();
let totalViolations = 0;

async function audit(page, label) {
  await page.addScriptTag({ content: axeSource });
  const result = await page.evaluate(() =>
    axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }),
  );
  console.log(`\n## ${label}: ${result.violations.length} violations (${result.passes.length} rules passed)`);
  for (const v of result.violations) {
    totalViolations += 1;
    console.log(`- [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nodes)`);
    for (const n of v.nodes.slice(0, 3)) console.log(`    ${n.target.join(' ')} — ${n.failureSummary?.split('\n')[0]}`);
  }
}

try {
  // Mobile-ish viewport: the demo runs at phone width; catches overflow-related failures.
  for (const viewport of [{ width: 375, height: 812 }, { width: 1280, height: 800 }]) {
    console.log(`\n===== viewport ${viewport.width}x${viewport.height} =====`);
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.goto(`http://localhost:${PORT}/`);
    await page.getByRole('button', { name: 'Start' }).waitFor({ timeout: 15000 });
    await audit(page, 'Welcome');

    await page.getByRole('button', { name: 'Start' }).click();
    await page.getByLabel('Tell us about your home').waitFor();
    await page.getByRole('switch', { name: 'Save my progress on this device' }).waitFor();
    await audit(page, 'Intake (incl. save toggle)');

    // Results from the committed offline fixture — real captured data, no network.
    await page.getByRole('button', { name: 'Toggle offline demo mode' }).click();
    await page.getByRole('button', { name: /Single parent/ }).click();
    await page.getByText('Money we found for you').waitFor({ timeout: 15000 });
    await page.getByRole('button', { name: /verification panel/ }).click();
    await page.getByText('What we understood').waitFor({ timeout: 5000 }).catch(() => {});
    await audit(page, 'Results + Verification Console (offline fixture)');
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(totalViolations === 0 ? '\nA11Y GATE: PASS (0 violations)' : `\nA11Y GATE: FAIL (${totalViolations} violations)`);
process.exit(totalViolations === 0 ? 0 : 1);
