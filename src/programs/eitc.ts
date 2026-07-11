/**
 * Federal EITC (tax year 2026) + CalEITC screening — the annual, lump-sum
 * "money you never claimed" beat. period is ALWAYS 'annual'; the UI must
 * never present these as monthly.
 *
 * Federal parameters: Rev. Proc. 2025-32 §.06 (verified from the IRS PDF).
 * Phase-in/phase-out RATES are statutory (IRC §32(b)) and cross-derive from
 * the verified dollar table (maxCredit = rate × earnedIncomeAmount) — the
 * tests assert that consistency.
 * Money math: integer cents, bigint; rates as basis points.
 */
import type { HouseholdProfile, ScreeningResult, Citation } from '../contracts.ts';
import type { ScreenDataContext } from '../data/runtime.ts';
import { toCents } from './calfresh.ts';

export const EITC_SOURCE = {
  source_url: 'https://www.irs.gov/pub/irs-drop/rp-25-32.pdf',
  as_of: '2026', // tax year 2026 (returns filed in 2027)
};

/** Rev. Proc. 2025-32 §.06 table, USD; "other" = single / head of household. */
export const EITC_2026 = {
  investmentIncomeLimit: 12200,
  byKids: {
    0: { earnedIncomeAmount: 8680, maxCredit: 664, thresholdOther: 10860, completedOther: 19540, thresholdMfj: 18140, completedMfj: 26820, phaseInBp: 765, phaseOutBp: 765 },
    1: { earnedIncomeAmount: 13020, maxCredit: 4427, thresholdOther: 23890, completedOther: 51593, thresholdMfj: 31160, completedMfj: 58863, phaseInBp: 3400, phaseOutBp: 1598 },
    2: { earnedIncomeAmount: 18290, maxCredit: 7316, thresholdOther: 23890, completedOther: 58629, thresholdMfj: 31160, completedMfj: 65899, phaseInBp: 4000, phaseOutBp: 2106 },
    3: { earnedIncomeAmount: 18290, maxCredit: 8231, thresholdOther: 23890, completedOther: 62974, thresholdMfj: 31160, completedMfj: 70244, phaseInBp: 4500, phaseOutBp: 2106 },
  } as Record<number, { earnedIncomeAmount: number; maxCredit: number; thresholdOther: number; completedOther: number; thresholdMfj: number; completedMfj: number; phaseInBp: number; phaseOutBp: number }>,
};

// CalEITC (FTB, tax year 2026): verified headline parameters only — the full
// credit curve is an FTB table without published closed-form parameters.
// TODO(VERIFY): encode the full CalEITC curve from FTB when published as data.
export const CALEITC_2026 = {
  earnedIncomeCap: 32900,
  maxCredit3PlusKids: 3756,
  source_url: 'https://www.ftb.ca.gov/file/personal/credits/california-earned-income-tax-credit.html',
  as_of: '2026',
};

const DISCLAIMER =
  'Estimated annual tax credit for tax year 2026, based on what you told us. This is an estimate, not a determination — confirm when you file.';

function qualifyingKids(p: HouseholdProfile): { kids: number; assumption: string | null } {
  if (p.childrenAges && p.childrenAges.length) {
    return { kids: p.childrenAges.filter((a) => a < 19).length, assumption: 'Qualifying children counted from stated ages (under 19; full-time students under 24 would also count).' };
  }
  if (p.hasChildren) {
    return { kids: 1, assumption: 'Assumed 1 qualifying child (children stated but ages/count unknown) — more qualifying children raises the credit.' };
  }
  return { kids: 0, assumption: null };
}

export function screenEitc(p: HouseholdProfile, data?: ScreenDataContext): ScreeningResult[] {
  const flags = data ? { data_freshness: data.freshness, dataVersion: data.version } : {};
  const federalCommon = {
    program: 'EITC (federal)',
    applyUrl: 'https://www.irs.gov/credits-deductions/individuals/earned-income-tax-credit-eitc',
    disclaimer: DISCLAIMER,
    ...flags,
  };
  const citations: Citation[] = [
    { text: 'IRS Rev. Proc. 2025-32 §.06 — tax year 2026 EITC parameters', ...EITC_SOURCE },
  ];

  if (p.earnedIncome == null) {
    return [
      {
        ...federalCommon,
        screening: 'need_more_info',
        estimatedBenefit: null,
        computation: [],
        assumptions: [],
        reason: 'Need the earned (wage) portion of income — the EITC is computed from earned income.',
        citations,
      },
    ];
  }

  const { kids, assumption: kidsAssumption } = qualifyingKids(p);
  const params = EITC_2026.byKids[Math.min(kids, 3)];

  // Annualize monthly figures; assume single/head-of-household thresholds.
  const earnedAnnualCents = toCents(p.earnedIncome) * 12n;
  const grossAnnualCents = toCents(p.monthlyGrossIncome) * 12n;
  const agiProxyCents = grossAnnualCents > earnedAnnualCents ? grossAnnualCents : earnedAnnualCents;

  const assumptions = [
    'Monthly income annualized (×12) — a mid-year change in income changes the credit.',
    'Assumed single / head-of-household filing status (married-filing-jointly thresholds are higher).',
    `Assumed investment income at or below the $${EITC_2026.investmentIncomeLimit} limit.`,
    ...(kidsAssumption ? [kidsAssumption] : []),
  ];

  const computation = [
    { label: 'Earned income (annualized)', value: Number(earnedAnnualCents / 100n) },
    { label: `Qualifying children counted`, value: kids },
    { label: `Maximum credit (${Math.min(kids, 3)}${kids >= 3 ? '+' : ''} children, TY2026)`, value: params.maxCredit },
  ];

  const results: ScreeningResult[] = [];

  if (earnedAnnualCents <= 0n) {
    results.push({
      ...federalCommon,
      screening: 'unlikely',
      estimatedBenefit: null,
      computation,
      assumptions,
      reason: 'The EITC requires earned income (wages or self-employment); none was stated.',
      citations,
    });
  } else {
    // Phase in: min(rate × earned, max). Phase out above the AGI/earned threshold.
    const phaseInCents = (earnedAnnualCents * BigInt(params.phaseInBp)) / 10000n;
    const maxCents = toCents(params.maxCredit);
    let creditCents = phaseInCents > maxCents ? maxCents : phaseInCents;
    const thresholdCents = toCents(params.thresholdOther);
    if (agiProxyCents > thresholdCents) {
      const reduction = ((agiProxyCents - thresholdCents) * BigInt(params.phaseOutBp)) / 10000n;
      creditCents = creditCents > reduction ? creditCents - reduction : 0n;
    }
    // Round to the nearest whole dollar — matches how the IRS publishes maxima
    // (e.g. 34% × $13,020 = $4,426.80 → $4,427).
    const creditDollars = Number((creditCents + 50n) / 100n);
    computation.push({ label: 'Estimated federal EITC (annual)', value: creditDollars });

    if (creditDollars <= 0) {
      results.push({
        ...federalCommon,
        screening: 'unlikely',
        estimatedBenefit: null,
        computation,
        assumptions,
        reason: `Income is at or above the completed phase-out ($${params.completedOther} for ${kids} qualifying child${kids === 1 ? '' : 'ren'}, single/HoH): no federal EITC.`,
        citations,
      });
    } else {
      results.push({
        ...federalCommon,
        screening: 'likely_qualify',
        estimatedBenefit: { amount: creditDollars, period: 'annual' },
        computation,
        assumptions,
        reason: `Estimated $${creditDollars} federal Earned Income Tax Credit for tax year 2026 — an annual lump sum claimed when filing, not a monthly benefit.`,
        citations,
      });
    }
  }

  // CalEITC — eligibility screen with verified cap; amount comes from FTB tables.
  const calCommon = {
    program: 'CalEITC',
    applyUrl: 'https://www.ftb.ca.gov/file/personal/credits/california-earned-income-tax-credit.html',
    disclaimer: DISCLAIMER,
    ...flags,
  };
  const calCitations: Citation[] = [
    { text: 'California Earned Income Tax Credit (FTB) — tax year 2026 cap and maximum', source_url: CALEITC_2026.source_url, as_of: CALEITC_2026.as_of },
  ];
  const earnedAnnualUsd = Number(earnedAnnualCents / 100n);
  if (earnedAnnualCents > 0n && earnedAnnualUsd <= CALEITC_2026.earnedIncomeCap) {
    results.push({
      ...calCommon,
      screening: 'likely_qualify',
      estimatedBenefit: null, // FTB table — no closed-form parameters published; never guess
      computation: [
        { label: 'Earned income (annualized)', value: earnedAnnualUsd },
        { label: 'CalEITC earned-income cap (TY2026)', value: CALEITC_2026.earnedIncomeCap },
      ],
      assumptions: [`Exact amount depends on the FTB credit table — up to $${CALEITC_2026.maxCredit3PlusKids} for families with 3+ children; use the FTB CalEITC calculator for the precise figure.`],
      reason: `Earned income is within the CalEITC cap ($${CALEITC_2026.earnedIncomeCap}/yr): likely qualifies for an additional California credit on the state return, on top of the federal EITC.`,
      citations: calCitations,
    });
  } else {
    results.push({
      ...calCommon,
      screening: 'unlikely',
      estimatedBenefit: null,
      computation: [{ label: 'Earned income (annualized)', value: earnedAnnualUsd }],
      assumptions: [],
      reason:
        earnedAnnualCents <= 0n
          ? 'CalEITC requires earned income; none was stated.'
          : `Earned income exceeds the CalEITC cap of $${CALEITC_2026.earnedIncomeCap}/yr.`,
      citations: calCitations,
    });
  }

  return results;
}
