import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateFpl, syncPovertyGuidelines, crossCheckCalfreshLimits, deriveProgramLimitUsd } from '../src/data/sync.ts';
import { deriveMonthlyLimitCents } from '../src/data/fplRules.ts';
import { loadStore, type ConstantsStore } from '../src/data/constantsStore.ts';
import { checksum } from '../src/data/provenance.ts';
import { ensureDataContext, resetDataCache, toScreenContext } from '../src/data/runtime.ts';
import { screenCalfresh } from '../src/programs/calfresh.ts';

// Real guideline values, fetched live from the ASPE API in Gate A (2026) and
// published HHS guidelines (2025 — the SNAP FY2026 COLA basis).
const FPL: Record<number, number[]> = {
  2026: [15960, 21640, 27320, 33000, 38680, 44360, 50040, 55720],
  2025: [15650, 21150, 26650, 32150, 37650, 43150, 48650, 54150],
};

function aspeMock(table: Record<number, number[]> = FPL) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    const m = url.match(/api\/(\d{4})\/(\w+)\/(\d+)$/);
    if (!m) return new Response('not found', { status: 404 });
    const [, year, , size] = m;
    const v = table[Number(year)]?.[Number(size) - 1];
    if (v == null) return new Response('not found', { status: 404 });
    // Mirror the live API's actual shape: income as a STRING.
    return Response.json({ data: { year, household_size: size, income: String(v), state: 'US' }, method: 'GET', status: 200 });
  });
}

function tmpStorePath(): string {
  return join(mkdtempSync(join(tmpdir(), 'bb-store-')), 'constants.json');
}

beforeEach(() => resetDataCache());
afterEach(() => vi.unstubAllGlobals());

describe('validateFpl — refuses garbage and implausible data', () => {
  const rows = (vals: number[]) => vals.map((annualUsd, i) => ({ year: 2026, state: 'us' as const, householdSize: i + 1, annualUsd }));

  it('accepts the real 2026 table', () => {
    expect(() => validateFpl(rows(FPL[2026]))).not.toThrow();
  });
  it('rejects FPL(1) = $2 (implausible)', () => {
    expect(() => validateFpl(rows([2, 21640, 27320, 33000, 38680, 44360, 50040, 55720]))).toThrow(/sane bounds/);
  });
  it('rejects a non-increasing table', () => {
    expect(() => validateFpl(rows([15960, 15960, 27320, 33000, 38680, 44360, 50040, 55720]))).toThrow(/strictly increasing/);
  });
  it('rejects a short table', () => {
    expect(() => validateFpl(rows([15960, 21640]))).toThrow(/8 FPL rows/);
  });
});

describe('syncPovertyGuidelines — live shape, provenance, drift', () => {
  it('happy path: populates both years with provenance and no drift vs the published chart', async () => {
    vi.stubGlobal('fetch', aspeMock());
    const storePath = tmpStorePath();
    const { store, changes, driftWarnings } = await syncPovertyGuidelines({ year: 2026, storePath });
    expect(store.version).toBe(1);
    expect(store.entries['fpl.annual.2026.us.hh1'].value).toBe(15960);
    expect(store.entries['fpl.annual.2025.us.hh1'].value).toBe(15650);
    expect(store.entries['calfresh.grossLimit.hh1'].value).toBe(2610);
    const prov = store.entries['fpl.annual.2026.us.hh1'].provenance;
    expect(prov.source_url).toMatch(/aspe\.hhs\.gov/);
    expect(prov.fetched_at).toBeTruthy();
    expect(prov.checksum).toBe(checksum(15960));
    expect(changes.length).toBeGreaterThan(0);
    // The FY2026 published chart derives from the 2025 guidelines within $2:
    expect(driftWarnings).toEqual([]);
    expect(await loadStore(storePath)).not.toBeNull();
  });

  it('garbage response (missing income) → throws, store NOT updated', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: { year: '2026' }, status: 200 })));
    const storePath = tmpStorePath();
    await expect(syncPovertyGuidelines({ year: 2026, storePath })).rejects.toThrow(/no valid income/);
    expect(await loadStore(storePath)).toBeNull();
  });

  it('implausible FPL(1) → validateFpl refuses, store NOT updated', async () => {
    vi.stubGlobal('fetch', aspeMock({ 2025: FPL[2025], 2026: [2, 21640, 27320, 33000, 38680, 44360, 50040, 55720] }));
    const storePath = tmpStorePath();
    await expect(syncPovertyGuidelines({ year: 2026, storePath })).rejects.toThrow(/sane bounds/);
    expect(await loadStore(storePath)).toBeNull();
  });

  it('drift flag fires on a deliberately-wrong FPL basis', async () => {
    // Feed a 2025 basis $600 higher than reality → derived limits diverge > $2.
    vi.stubGlobal('fetch', aspeMock({ 2025: FPL[2025].map((v) => v + 600), 2026: FPL[2026] }));
    const { driftWarnings } = await syncPovertyGuidelines({ year: 2026, storePath: tmpStorePath() });
    expect(driftWarnings.length).toBeGreaterThan(0);
    expect(driftWarnings[0]).toHaveProperty('published');
    expect(driftWarnings[0]).toHaveProperty('derived');
  });
});

describe('derivation', () => {
  it('deriveMonthlyLimitCents matches the published CalFresh chart from the 2025 basis (anchor)', () => {
    // net (100%): ceil(15650/12) = 1305 → published 1305; gross = 2×net = 2610.
    expect(Number(deriveMonthlyLimitCents(15650, 10000) / 100n)).toBe(1305);
    expect(Number(deriveMonthlyLimitCents(21150, 10000) / 100n)).toBe(1763);
  });

  it('crossCheckCalfreshLimits is clean on the real basis and fires on a wrong one', () => {
    const mk = (vals: number[]): ConstantsStore => ({
      version: 1,
      generated_at: 'test',
      entries: Object.fromEntries(
        vals.map((v, i) => [
          `fpl.annual.2025.us.hh${i + 1}`,
          { key: `fpl.annual.2025.us.hh${i + 1}`, value: v, provenance: { source_url: 't', as_of: '2025', fetched_at: 't', checksum: 'x' } },
        ]),
      ),
    });
    expect(crossCheckCalfreshLimits(mk(FPL[2025]), 2025)).toEqual([]);
    expect(crossCheckCalfreshLimits(mk(FPL[2025].map((v) => v + 600)), 2025).length).toBeGreaterThan(0);
  });

  it('program limits derive fully live (Medi-Cal 138%, CARE 200%, LifeLine 150%) with >8 from the live increment', async () => {
    vi.stubGlobal('fetch', aspeMock());
    const { store } = await syncPovertyGuidelines({ year: 2026, storePath: tmpStorePath() });
    const medical = deriveProgramLimitUsd(store, { year: 2026, householdSize: 1, pctBasisPoints: 13800 });
    expect(medical.monthlyUsd).toBe(Math.ceil((15960 * 1.38) / 12)); // 1836
    const hh10 = deriveProgramLimitUsd(store, { year: 2026, householdSize: 10, pctBasisPoints: 20000 });
    const expectedAnnual = 55720 + (55720 - 50040) * 2; // live (7,8) increment, not hardcoded
    expect(hh10.fplAnnualUsd).toBe(expectedAnnual);
  });

  it('checksum changes when the value changes (drift detection)', () => {
    expect(checksum(15960)).not.toBe(checksum(15650));
  });
});

describe('runtime — honest fallback (T4)', () => {
  it('live sync failure falls back to the last-good store, flagged cached', async () => {
    const storePath = tmpStorePath();
    vi.stubGlobal('fetch', aspeMock());
    const live = await ensureDataContext({ storePath, year: 2026 });
    expect(live?.freshness).toBe('live');

    resetDataCache();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    const cached = await ensureDataContext({ storePath, year: 2026, force: true });
    expect(cached?.freshness).toBe('cached');
    expect(cached?.store.version).toBe(live?.store.version); // last-good, not fabricated
  });

  it('no live API and no store → null (engine constants only), not a crash or a hardcoded number', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    const ctx = await ensureDataContext({ storePath: tmpStorePath(), year: 2026, force: true });
    expect(ctx).toBeNull();
  });

  it('screen result carries store version + FPL provenance + freshness (T3/Gate D)', async () => {
    const storePath = tmpStorePath();
    vi.stubGlobal('fetch', aspeMock());
    const ctx = await ensureDataContext({ storePath, year: 2026, force: true });
    const screenCtx = toScreenContext(ctx!, 2026);
    const r = screenCalfresh(
      { householdSize: 2, monthlyGrossIncome: 2800, earnedIncome: 2800, hasChildren: true, hasElderlyOrDisabled: false, isRenter: true, monthlyRent: 1800, countyFips: '06075', preferredLanguage: 'en' },
      screenCtx!,
    );
    expect(r.data_freshness).toBe('live');
    expect(r.dataVersion).toBe(ctx!.store.version);
    const fplCitation = r.citations.find((c) => c.text.includes('HHS ASPE'));
    expect(fplCitation).toBeTruthy();
    expect(fplCitation!.source_url).toMatch(/aspe\.hhs\.gov/);
    expect(fplCitation!.text).toMatch(/store v\d+/);
  });
});
