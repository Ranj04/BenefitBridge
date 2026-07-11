import { describe, it, expect } from 'vitest';
import { screenCalfresh, toCents } from '../src/programs/calfresh.ts';
import { grossLimitFor, maxAllotmentFor } from '../src/programs/constants.ts';
import type { HouseholdProfile } from '../src/contracts.ts';

const base: HouseholdProfile = {
  householdSize: 1,
  monthlyGrossIncome: 1000,
  earnedIncome: 1000,
  hasChildren: false,
  hasElderlyOrDisabled: false,
  isRenter: false,
  countyFips: '06075',
  preferredLanguage: 'en',
};

describe('CalFresh cascade — boundaries and failure paths (adversarial)', () => {
  it('gross income EXACTLY at the 200% FPL limit passes the gross test (≤, not <)', () => {
    const r = screenCalfresh({ ...base, monthlyGrossIncome: 2610, earnedIncome: 2610 });
    // May still fail the NET test, but must not be rejected by the gross screen.
    expect(r.reason).not.toMatch(/Gross monthly income exceeds/);
  });

  it('one cent over the gross limit (non-elderly) → unlikely, by the gross test', () => {
    const r = screenCalfresh({ ...base, monthlyGrossIncome: 2610.01, earnedIncome: 2610.01 });
    expect(r.screening).toBe('unlikely');
    expect(r.reason).toMatch(/Gross monthly income exceeds/);
    expect(r.estimatedBenefit).toBeNull();
  });

  it('over-threshold non-elderly ($2,700 gross, hh 1) → unlikely with no benefit', () => {
    const r = screenCalfresh({ ...base, monthlyGrossIncome: 2700, earnedIncome: 2700 });
    expect(r.screening).toBe('unlikely');
    expect(r.estimatedBenefit).toBeNull();
  });

  it('elderly single at $2,700 gross is gross-exempt and proceeds to the net test', () => {
    const r = screenCalfresh({ ...base, monthlyGrossIncome: 2700, earnedIncome: 0, hasElderlyOrDisabled: true });
    expect(r.reason).not.toMatch(/Gross monthly income exceeds/);
    expect(r.reason).toMatch(/Net monthly income/); // fails net, proving it got past gross
  });

  it('elderly renter persona ($1,900, rent $1,500): uncapped shelter → benefit $185', () => {
    const r = screenCalfresh({
      ...base,
      monthlyGrossIncome: 1900,
      earnedIncome: 0,
      hasElderlyOrDisabled: true,
      isRenter: true,
      monthlyRent: 1500,
    });
    // adjusted 1691.00; shelter 1500+663 SUA=2163; excess 1317.50 (uncapped);
    // net 373.50; 30% = 112.05 → ceil 113; 298 − 113 = 185.
    expect(r.screening).toBe('likely_qualify');
    expect(r.estimatedBenefit).toEqual({ amount: 185, period: 'monthly' });
  });

  it('hh 4 with high rent: excess shelter (capped at $744) pulls net under the limit → likely_qualify', () => {
    const r = screenCalfresh({
      ...base,
      householdSize: 4,
      monthlyGrossIncome: 4200,
      earnedIncome: 4200,
      hasChildren: true,
      isRenter: true,
      monthlyRent: 2600,
    });
    // adjusted 3137 (> net limit 2680 without shelter); capped excess 744 → net 2393; benefit 994−718=276.
    expect(r.screening).toBe('likely_qualify');
    expect(r.estimatedBenefit).toEqual({ amount: 276, period: 'monthly' });
    expect(r.assumptions.join(' ')).toMatch(/capped at \$744/);
  });

  it('renter with missing rent → need_more_info, never a silent $0', () => {
    const r = screenCalfresh({ ...base, isRenter: true });
    expect(r.screening).toBe('need_more_info');
    expect(r.estimatedBenefit).toBeNull();
    expect(r.reason).toMatch(/rent/i);
  });

  it('unknown earned/unearned split → need_more_info, no guessed deduction', () => {
    const r = screenCalfresh({ ...base, earnedIncome: null as unknown as number });
    expect(r.screening).toBe('need_more_info');
    expect(r.reason).toMatch(/earned/i);
  });

  it('net floored at 0 → benefit equals the full max allotment', () => {
    const r = screenCalfresh({ ...base, monthlyGrossIncome: 300, earnedIncome: 300, isRenter: true, monthlyRent: 800 });
    expect(r.screening).toBe('likely_qualify');
    expect(r.estimatedBenefit).toEqual({ amount: maxAllotmentFor(1), period: 'monthly' });
  });

  it('SNAP rounding: 30% of net rounds UP to the whole dollar ($291 net → $88, not $87.30)', () => {
    const r = screenCalfresh({ ...base, monthlyGrossIncome: 500, earnedIncome: 0 });
    // adjusted/net 291.00 → 30% = 87.30 → 88; 298 − 88 = 210.
    expect(r.estimatedBenefit).toEqual({ amount: 210, period: 'monthly' });
    const thirty = r.computation.find((c) => c.label.includes('30% of net'));
    expect(thirty?.value).toBe(88);
  });

  it('minimum benefit: computed $22 for hh 1 is raised to $24', () => {
    const r = screenCalfresh({ ...base, monthlyGrossIncome: 1129, earnedIncome: 0 });
    // adjusted/net 920 → 30% = 276; 298 − 276 = 22 → minimum 24.
    expect(r.estimatedBenefit).toEqual({ amount: 24, period: 'monthly' });
    expect(r.assumptions.join(' ')).toMatch(/Minimum benefit/);
  });

  it('no float drift: cent-precision income computes exactly (bigint path)', () => {
    const r = screenCalfresh({ ...base, householdSize: 2, monthlyGrossIncome: 2000.1, earnedIncome: 2000.1 });
    // 20% of 200010¢ = 40002¢ = $400.02 exactly; adjusted 1391.08; 30% = 417.324 → 418; 546−418=128.
    const earned = r.computation.find((c) => c.label.includes('Earned income deduction'));
    expect(earned?.value).toBe(400.02);
    expect(r.estimatedBenefit).toEqual({ amount: 128, period: 'monthly' });
  });

  it('toCents is exact at the boundary', () => {
    expect(toCents(2610.01)).toBe(261001n);
    expect(toCents(0.1) + toCents(0.2)).toBe(30n);
  });

  it('tables extrapolate beyond published sizes (+$918 gross / +$218 allotment)', () => {
    expect(grossLimitFor(9)).toBe(8110 + 2 * 918);
    expect(maxAllotmentFor(9)).toBe(1789 + 218);
  });

  it('every terminal result carries citations, disclaimer, and the shown cascade', () => {
    const r = screenCalfresh({ ...base, monthlyGrossIncome: 2800, earnedIncome: 2800, householdSize: 2 });
    expect(r.citations.length).toBeGreaterThan(0);
    for (const c of r.citations) {
      expect(c.source_url).toMatch(/^https:\/\//);
      expect(c.as_of).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(r.disclaimer).toMatch(/estimate/i);
    expect(r.computation.length).toBeGreaterThan(3);
  });
});
