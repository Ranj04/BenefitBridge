import { describe, it, expect } from 'vitest';
import { validateProfile } from '../src/validate.ts';
import { INTAKE_CASES, checkCase } from '../src/intake-cases.ts';

describe('validateProfile — unstated-is-null discipline', () => {
  it('accepts a profile with null for unstated fields', () => {
    const r = validateProfile({
      householdSize: 2,
      monthlyGrossIncome: 2800,
      earnedIncome: 2800,
      monthlyRent: null, // unstated → null is allowed
      isRenter: true,
      countyFips: '06075',
      preferredLanguage: 'en',
    });
    expect(r).toEqual({ ok: true, errors: [] });
  });

  it('rejects a missing required identity field', () => {
    const r = validateProfile({ householdSize: 1, monthlyGrossIncome: 1000, countyFips: '06075' });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/preferredLanguage/);
  });

  it('rejects a negative or non-numeric income (a fabricated/garbled value)', () => {
    expect(validateProfile({ householdSize: 1, monthlyGrossIncome: -5, countyFips: '06075', preferredLanguage: 'en' }).ok).toBe(false);
    expect(validateProfile({ householdSize: 1, monthlyGrossIncome: 'lots', countyFips: '06075', preferredLanguage: 'en' } as unknown).ok).toBe(false);
  });

  it('rejects householdSize 0', () => {
    expect(validateProfile({ householdSize: 0, countyFips: '06075', preferredLanguage: 'en' }).ok).toBe(false);
  });

  it('rejects an invalid immigrationStatus enum', () => {
    expect(validateProfile({ householdSize: 1, countyFips: '06075', preferredLanguage: 'en', immigrationStatus: 'green-card' }).ok).toBe(false);
  });
});

describe('intake case-checker logic (offline)', () => {
  it('every golden case has required identity expectations', () => {
    for (const c of INTAKE_CASES) {
      expect(typeof c.text).toBe('string');
      expect(c.expect.preferredLanguage).toBeTypeOf('string');
    }
  });

  it('checkCase flags a fabricated number where null was expected', () => {
    const missingIncome = INTAKE_CASES.find((c) => c.name === 'missing-income')!;
    // simulate an intake that WRONGLY invented an income
    const bad = { hasChildren: true, isRenter: true, monthlyGrossIncome: 3000, preferredLanguage: 'en' };
    const failures = checkCase(missingIncome, bad);
    expect(failures.join(' ')).toMatch(/monthlyGrossIncome/);
  });

  it('checkCase passes a correct extraction within tolerance', () => {
    const weekly = INTAKE_CASES.find((c) => c.name === 'weekly-wage-normalization')!;
    const good = { householdSize: 1, monthlyGrossIncome: 2817, preferredLanguage: 'en' };
    expect(checkCase(weekly, good)).toEqual([]);
  });
});
