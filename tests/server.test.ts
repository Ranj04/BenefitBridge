import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/server.ts';
import { validateScreeningResult } from '../src/validate.ts';
import { resetDataCache } from '../src/data/runtime.ts';

// No live network in unit tests: force the data layer onto its last-good
// store fallback (data/constants.json) so /screen is fast and deterministic.
beforeAll(() => {
  resetDataCache();
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network disabled in tests'); }));
});
afterAll(() => vi.unstubAllGlobals());

const valid = {
  householdSize: 2,
  monthlyGrossIncome: 2800,
  earnedIncome: 2800,
  hasChildren: true,
  hasElderlyOrDisabled: false,
  isRenter: true,
  monthlyRent: 1800,
  countyFips: '06075',
  preferredLanguage: 'en',
};

describe('POST /screen — the real engine endpoint (adversarial gate 0 checks)', () => {
  it('valid body → 200 with a contract-valid, non-placeholder ScreeningResult[]', async () => {
    const res = await buildServer().inject({ method: 'POST', url: '/screen', payload: valid });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    const v = validateScreeningResult(body[0]);
    expect(v.errors).toEqual([]);
    expect(JSON.stringify(body)).not.toMatch(/MOCK/i);
  });

  it('malformed body (missing householdSize) → 400, not a crash', async () => {
    const { householdSize, ...rest } = valid;
    const res = await buildServer().inject({ method: 'POST', url: '/screen', payload: rest });
    expect(res.statusCode).toBe(400);
  });

  it('householdSize 0 and -1 → 400, not silently accepted', async () => {
    for (const bad of [0, -1]) {
      const res = await buildServer().inject({ method: 'POST', url: '/screen', payload: { ...valid, householdSize: bad } });
      expect(res.statusCode).toBe(400);
    }
  });

  it('garbage body → 400', async () => {
    const res = await buildServer().inject({
      method: 'POST',
      url: '/screen',
      payload: 'not json at all',
      headers: { 'content-type': 'text/plain' },
    });
    expect([400, 415]).toContain(res.statusCode);
  });

  it('missing monthlyGrossIncome → 400 (engine-required field)', async () => {
    const { monthlyGrossIncome, ...rest } = valid;
    const res = await buildServer().inject({ method: 'POST', url: '/screen', payload: rest });
    expect(res.statusCode).toBe(400);
  });
});
