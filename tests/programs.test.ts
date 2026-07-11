import { describe, it, expect } from 'vitest';
import type { HouseholdProfile } from '../src/contracts.ts';
import type { FplBasis } from '../src/programs/fplBasis.ts';
import { monthlyLimitUsd } from '../src/programs/fplBasis.ts';
import { screenMediCal } from '../src/programs/medical.ts';
import { screenCare } from '../src/programs/care.ts';
import { screenLifeline } from '../src/programs/lifeline.ts';
import { screenEitc, EITC_2026 } from '../src/programs/eitc.ts';

// Real 2026 FPL values (fetched live from the ASPE API — see data layer gates).
const FPL_2026 = [15960, 21640, 27320, 33000, 38680, 44360, 50040, 55720];
const basis: FplBasis = {
  year: 2026,
  annualUsdFor: (hh) => (hh <= 8 ? FPL_2026[Math.max(1, hh) - 1] : FPL_2026[7] + (FPL_2026[7] - FPL_2026[6]) * (hh - 8)),
  provenance: { source_url: 'https://aspe.hhs.gov/.../api/2026/us/1', as_of: '2026', fetched_at: 't', checksum: 'x' },
};

const base: HouseholdProfile = {
  householdSize: 1,
  monthlyGrossIncome: 1500,
  earnedIncome: 1500,
  hasChildren: false,
  hasElderlyOrDisabled: false,
  isRenter: false,
  countyFips: '06075',
  preferredLanguage: 'en',
};

describe('Medi-Cal (138% adults / 266% children, live FPL)', () => {
  const adultLimit1 = monthlyLimitUsd(basis, 1, 13800); // ceil(15960*1.38/12) = 1836

  it('derives the hh1 adult limit from the live FPL', () => {
    expect(adultLimit1).toBe(1836);
  });
  it('income exactly at the adult limit → likely_qualify (≤)', () => {
    expect(screenMediCal({ ...base, monthlyGrossIncome: adultLimit1 }, basis).screening).toBe('likely_qualify');
  });
  it('one dollar over, no children → unlikely', () => {
    expect(screenMediCal({ ...base, monthlyGrossIncome: adultLimit1 + 1 }, basis).screening).toBe('unlikely');
  });
  it('over the adult limit but children within 266% → likely_qualify (children tier)', () => {
    const r = screenMediCal({ ...base, householdSize: 2, monthlyGrossIncome: 3000, hasChildren: true }, basis);
    expect(r.screening).toBe('likely_qualify');
    expect(r.reason).toMatch(/children likely qualify/);
  });
  it('no live FPL basis → need_more_info, never a hardcoded threshold', () => {
    expect(screenMediCal(base, null).screening).toBe('need_more_info');
  });
});

describe('PG&E CARE (200% FPL, live)', () => {
  const limit2 = monthlyLimitUsd(basis, 2, 20000); // ceil(21640*2/12) = 3607
  it('at the limit → likely_qualify; over → unlikely', () => {
    expect(screenCare({ ...base, householdSize: 2, monthlyGrossIncome: limit2 }, basis).screening).toBe('likely_qualify');
    expect(screenCare({ ...base, householdSize: 2, monthlyGrossIncome: limit2 + 1 }, basis).screening).toBe('unlikely');
  });
  it('reports eligibility without inventing a dollar amount (no bill collected)', () => {
    expect(screenCare({ ...base, monthlyGrossIncome: 1000 }, basis).estimatedBenefit).toBeNull();
  });
});

describe('California LifeLine (150% FPL or categorical)', () => {
  it('categorical: CalFresh-likely qualifies even with no FPL basis at all', () => {
    const r = screenLifeline({ ...base, monthlyGrossIncome: 9999 }, null, { calfreshLikely: true, mediCalLikely: false });
    expect(r.screening).toBe('likely_qualify');
    expect(r.reason).toMatch(/CalFresh/);
  });
  it('income path: at 150% limit → likely; over (no categorical) → unlikely', () => {
    const limit1 = monthlyLimitUsd(basis, 1, 15000); // ceil(15960*1.5/12) = 1995
    expect(limit1).toBe(1995);
    expect(screenLifeline({ ...base, monthlyGrossIncome: limit1 }, basis, { calfreshLikely: false, mediCalLikely: false }).screening).toBe('likely_qualify');
    expect(screenLifeline({ ...base, monthlyGrossIncome: limit1 + 1 }, basis, { calfreshLikely: false, mediCalLikely: false }).screening).toBe('unlikely');
  });
});

describe('EITC (federal, TY2026) — verified Rev. Proc. 2025-32 table', () => {
  it('statutory rates cross-derive the verified dollar table (internal consistency)', () => {
    for (const [kids, p] of Object.entries(EITC_2026.byKids)) {
      const derivedMax = Math.round((p.earnedIncomeAmount * p.phaseInBp) / 10000);
      expect(Math.abs(derivedMax - p.maxCredit), `max credit, ${kids} kids`).toBeLessThanOrEqual(1);
      const derivedCompleted = p.thresholdOther + Math.round((p.maxCredit * 10000) / p.phaseOutBp);
      expect(Math.abs(derivedCompleted - p.completedOther), `completed phaseout, ${kids} kids`).toBeLessThanOrEqual(2);
    }
  });

  it('1 child at the earned-income amount → the published maximum $4,427', () => {
    const [fed] = screenEitc({ ...base, hasChildren: true, childrenAges: [4], monthlyGrossIncome: 1085, earnedIncome: 1085 });
    expect(fed.screening).toBe('likely_qualify');
    expect(fed.estimatedBenefit).toEqual({ amount: 4427, period: 'annual' });
  });

  it('3+ children tier reaches the published maximum $8,231', () => {
    const [fed] = screenEitc({ ...base, hasChildren: true, childrenAges: [2, 5, 9], monthlyGrossIncome: 1524.17, earnedIncome: 1524.17 });
    expect(fed.estimatedBenefit).toEqual({ amount: 8231, period: 'annual' });
  });

  it('0 children → the small credit tier ($664 max)', () => {
    const [fed] = screenEitc({ ...base, monthlyGrossIncome: 723.35, earnedIncome: 723.35 });
    expect(fed.estimatedBenefit).toEqual({ amount: 664, period: 'annual' });
  });

  it('mid-phaseout computes exactly (1 child, $30,000/yr → $3,451)', () => {
    const [fed] = screenEitc({ ...base, hasChildren: true, childrenAges: [4], monthlyGrossIncome: 2500, earnedIncome: 2500 });
    expect(fed.estimatedBenefit).toEqual({ amount: 3451, period: 'annual' });
  });

  it('at the completed phaseout → unlikely, $0 never shown as a credit', () => {
    const monthly = EITC_2026.byKids[1].completedOther / 12; // 51593/12
    const [fed] = screenEitc({ ...base, hasChildren: true, childrenAges: [4], monthlyGrossIncome: monthly, earnedIncome: monthly });
    expect(fed.screening).toBe('unlikely');
    expect(fed.estimatedBenefit).toBeNull();
  });

  it('no earned income stated → need_more_info, nothing fabricated', () => {
    const [fed] = screenEitc({ ...base, earnedIncome: null as unknown as number });
    expect(fed.screening).toBe('need_more_info');
  });

  it('period is ALWAYS annual — never monthly', () => {
    const results = screenEitc({ ...base, hasChildren: true, childrenAges: [4], monthlyGrossIncome: 1085, earnedIncome: 1085 });
    for (const r of results) {
      if (r.estimatedBenefit) expect(r.estimatedBenefit.period).toBe('annual');
    }
  });

  it('CalEITC: within the $32,900 cap → likely_qualify with NO invented amount; over → unlikely', () => {
    const results = screenEitc({ ...base, monthlyGrossIncome: 2500, earnedIncome: 2500 });
    const cal = results.find((r) => r.program === 'CalEITC')!;
    expect(cal.screening).toBe('likely_qualify');
    expect(cal.estimatedBenefit).toBeNull();
    const over = screenEitc({ ...base, monthlyGrossIncome: 2800, earnedIncome: 2800 }).find((r) => r.program === 'CalEITC')!;
    expect(over.screening).toBe('unlikely'); // 2800×12 = 33,600 > 32,900
  });
});
