import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildMockApp } from '../src/mock-screen.ts';
import { validateScreeningResult } from '../src/validate.ts';
import type { HouseholdProfile, ScreeningResult } from '../src/contracts.ts';

let app: FastifyInstance;

const base: HouseholdProfile = {
  householdSize: 2,
  monthlyGrossIncome: 2800,
  earnedIncome: 2800,
  hasChildren: true,
  hasElderlyOrDisabled: false,
  isRenter: true,
  monthlyRent: 1900,
  countyFips: '06075',
  preferredLanguage: 'en',
};

async function screen(body: unknown) {
  const res = await app.inject({ method: 'POST', url: '/screen', payload: body as object });
  return { status: res.statusCode, json: res.statusCode === 200 ? (res.json() as ScreeningResult[]) : res.json() };
}

beforeAll(async () => {
  app = buildMockApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('mock /screen — contract shape', () => {
  it('returns a contract-valid ScreeningResult[]', async () => {
    const { status, json } = await screen(base);
    expect(status).toBe(200);
    expect(Array.isArray(json)).toBe(true);
    const r = (json as ScreeningResult[])[0];
    expect(validateScreeningResult(r)).toEqual({ ok: true, errors: [] });
    expect(r.program).toBe('CalFresh');
    // every result carries a disclaimer and at least one citation
    expect(r.disclaimer.length).toBeGreaterThan(0);
    expect(r.citations.length).toBeGreaterThan(0);
  });

  it('never labels a benefit as guaranteed (estimate framing only)', async () => {
    const { json } = await screen(base);
    const r = (json as ScreeningResult[])[0];
    expect(r.disclaimer.toLowerCase()).toMatch(/estimate|not a determination/);
    expect(JSON.stringify(r).toLowerCase()).not.toMatch(/guaranteed|you will receive/);
  });
});

describe('mock /screen — adversarial', () => {
  it('renter with no rent → need_more_info, not a silent number', async () => {
    const { json } = await screen({ ...base, monthlyRent: undefined });
    const r = (json as ScreeningResult[])[0];
    expect(r.screening).toBe('need_more_info');
    expect(r.estimatedBenefit).toBeNull();
  });

  it('over-threshold non-elderly → unlikely, no benefit', async () => {
    const { json } = await screen({ ...base, householdSize: 1, monthlyGrossIncome: 9000, monthlyRent: 1000, hasChildren: false });
    const r = (json as ScreeningResult[])[0];
    expect(r.screening).toBe('unlikely');
    expect(r.estimatedBenefit).toBeNull();
  });

  it('malformed body (no householdSize) → 400, not a crash', async () => {
    const { status } = await screen({ monthlyGrossIncome: 2800 });
    expect(status).toBe(400);
  });

  it('empty body → 400', async () => {
    const { status } = await screen({});
    expect(status).toBe(400);
  });
});
