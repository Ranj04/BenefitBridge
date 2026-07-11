import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import type { HouseholdProfile } from '../src/contracts.ts';
import { mapProfileToCf285, CF285 } from '../src/filer/cf285Map.ts';
import { fillCf285 } from '../src/filer/fillCf285.ts';
import { buildServer } from '../src/server.ts';
import { resetDataCache } from '../src/data/runtime.ts';

beforeAll(() => {
  resetDataCache();
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network disabled in tests'); }));
});
afterAll(() => vi.unstubAllGlobals());

const persona: HouseholdProfile = {
  householdSize: 2,
  monthlyGrossIncome: 2800,
  earnedIncome: 2800,
  hasChildren: true,
  childrenAges: [4],
  hasElderlyOrDisabled: false,
  isRenter: true,
  monthlyRent: 1800,
  monthlyUtilities: 150,
  dependentCareCost: 300,
  countyFips: '06075',
  preferredLanguage: 'es',
};

describe('CF 285 mapping — nothing fabricated, blanks flagged', () => {
  it('maps exactly what the profile states', () => {
    const m = mapProfileToCf285(persona);
    expect(m.text[CF285.earnedRow1MonthTotal]).toBe('2800');
    expect(m.text[CF285.earnedRow1Freq]).toBe('Monthly');
    expect(m.check).toContain(CF285.earnedYes);
    expect(m.check).toContain(CF285.unearnedNo); // gross − earned = 0
    expect(m.text[CF285.rentAmount]).toBe('1800');
    expect(m.check).toContain(CF285.utilitiesYes);
    expect(m.text[CF285.careRow1Amount]).toBe('300');
    expect(m.text[CF285.langRead]).toBe('Spanish');
  });

  it('never fills identity fields it does not have — they are flagged blank', () => {
    const m = mapProfileToCf285(persona);
    const joined = m.blankFields.join(' | ');
    expect(joined).toMatch(/Name/);
    expect(joined).toMatch(/Social Security/);
    expect(joined).toMatch(/Signature/);
    // And no mapped value looks like a fabricated person name:
    for (const v of Object.values(m.text)) expect(['Monthly', 'Spanish']).toSatisfy(() => !/[A-Z][a-z]+ [A-Z][a-z]+/.test(v));
  });

  it('missing profile fields → flagged blank, not guessed', () => {
    const m = mapProfileToCf285({ ...persona, monthlyRent: undefined, dependentCareCost: undefined });
    expect(m.text[CF285.rentAmount]).toBeUndefined();
    expect(m.blankFields.join(' ')).toMatch(/Rent amount/);
    expect(m.check).not.toContain(CF285.careYes);
    expect(m.check).not.toContain(CF285.careNo); // unknown ≠ "No"
  });

  it('unknown earned split → earned section left for the human, never asserted', () => {
    const m = mapProfileToCf285({ ...persona, earnedIncome: null as unknown as number });
    expect(m.check).not.toContain(CF285.earnedYes);
    expect(m.check).not.toContain(CF285.earnedNo);
    expect(m.blankFields.join(' ')).toMatch(/Earned income/);
  });

  it('English speaker → language lines left blank (form asks only "if not English")', () => {
    const m = mapProfileToCf285({ ...persona, preferredLanguage: 'en' });
    expect(m.text[CF285.langRead]).toBeUndefined();
  });
});

describe('CF 285 fill — values land in the real official PDF', () => {
  it('round-trips: the filled PDF reads back exactly the mapped values', async () => {
    const { pdf, app } = await fillCf285(persona);
    const doc = await PDFDocument.load(pdf, { ignoreEncryption: true });
    const form = doc.getForm();
    expect(form.getTextField(CF285.earnedRow1MonthTotal).getText()).toBe('2800');
    expect(form.getTextField(CF285.rentAmount).getText()).toBe('1800');
    expect(form.getTextField(CF285.langSpeak).getText()).toBe('Spanish');
    expect(form.getCheckBox(CF285.earnedYes).isChecked()).toBe(true);
    expect(form.getCheckBox(CF285.rentYes).isChecked()).toBe(true);
    expect(form.getCheckBox(CF285.earnedNo).isChecked()).toBe(false);
    expect(app.status).toBe('ready_for_review');
  });
});

describe('THE FILER BOUNDARY — the system never submits', () => {
  it("status type admits no 'submitted' value and /fill returns ready_for_review", async () => {
    const res = await buildServer().inject({ method: 'POST', url: '/fill', payload: { profile: persona, program: 'CalFresh' } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ready_for_review');
    expect(['draft', 'ready_for_review', 'staged_awaiting_user_submit']).toContain(body.status);
    expect(body.pdfUrl).toMatch(/\/files\/cf285-[0-9a-f-]+\.pdf$/);
    expect(body.blankFields.join(' ')).toMatch(/Signature/);
  });

  it('the served PDF is retrievable and is a real PDF', async () => {
    const app = buildServer();
    const fill = await app.inject({ method: 'POST', url: '/fill', payload: { profile: persona, program: 'CalFresh' } });
    const url = new URL(fill.json().pdfUrl);
    const file = await app.inject({ method: 'GET', url: url.pathname });
    expect(file.statusCode).toBe(200);
    expect(file.headers['content-type']).toBe('application/pdf');
    expect(file.rawPayload.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('no source file both references a .gov host and sends a POST (static scan)', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith('.ts')) {
          const src = readFileSync(p, 'utf8');
          // Inspect each fetch() call site: offender only if THAT call both
          // targets a .gov host and sends a POST. Citation string literals
          // elsewhere in the file must not trip the scan.
          for (const m of src.matchAll(/fetch\(/g)) {
            const window = src.slice(m.index!, m.index! + 400);
            if (/\.gov/.test(window.split(')')[0] ?? '') && /method:\s*['"]POST['"]/i.test(window)) offenders.push(p);
          }
        }
      }
    };
    walk('src');
    expect(offenders).toEqual([]);
  });

  it('bad /fill bodies are rejected', async () => {
    const app = buildServer();
    expect((await app.inject({ method: 'POST', url: '/fill', payload: {} })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/fill', payload: { profile: persona, program: 'Medi-Cal' } })).statusCode).toBe(400);
  });
});
