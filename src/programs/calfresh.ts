/**
 * CalFresh (SNAP, California/BBCE) deterministic screening cascade.
 * Pure functions. Money is integer cents in bigint end to end — dollars enter
 * once at the boundary (toCents) and leave once at formatting (toDollars).
 * No LLM anywhere. Real SNAP rounding: the 30%-of-net figure rounds UP to the
 * next whole dollar; the benefit is whole dollars.
 */
import type { HouseholdProfile, ScreeningResult, Citation } from '../contracts.ts';
import {
  APPLY_URL,
  CA_STANDARD_MEDICAL_DEDUCTION,
  CA_SUA,
  DISCLAIMER,
  GROSS_LIMIT,
  MAX_ALLOTMENT,
  MEDICAL_THRESHOLD,
  MINIMUM_BENEFIT_1_2,
  NET_LIMIT,
  SHELTER_CAP,
  STANDARD_DEDUCTION,
  grossLimitFor,
  maxAllotmentFor,
  netLimitFor,
  standardDeductionFor,
} from './constants.ts';

/** Boundary: USD number → integer cents (bigint). The only place floats touch money. */
export function toCents(usd: number): bigint {
  return BigInt(Math.round(usd * 100));
}
/** Boundary: cents → USD number for the computation[] display. */
export function toDollars(cents: bigint): number {
  return Number(cents) / 100;
}
const ZERO = 0n;
const maxBig = (a: bigint, b: bigint) => (a > b ? a : b);
/** Dollars (whole) from cents, rounding UP any fraction of a dollar. */
const ceilToDollars = (cents: bigint): bigint => (cents + 99n) / 100n;

const CITATIONS: Citation[] = [
  {
    text: 'CalFresh income limits FY2026 (200% FPL gross / 100% FPL net, CA BBCE)',
    source_url: GROSS_LIMIT.source_url,
    as_of: GROSS_LIMIT.as_of,
  },
  {
    text: 'USDA FNS SNAP FY2026 maximum allotments and deductions (48 states & DC)',
    source_url: MAX_ALLOTMENT.source_url,
    as_of: MAX_ALLOTMENT.as_of,
  },
  {
    text: 'CalFresh FFY2026 COLA values incl. Standard Utility Allowance (ACIN I-46-25)',
    source_url: CA_SUA.source_url,
    as_of: CA_SUA.as_of,
  },
];

function result(partial: Omit<ScreeningResult, 'program' | 'citations' | 'applyUrl' | 'disclaimer'>): ScreeningResult {
  return { program: 'CalFresh', citations: CITATIONS, applyUrl: APPLY_URL, disclaimer: DISCLAIMER, ...partial };
}

export function screenCalfresh(p: HouseholdProfile): ScreeningResult {
  const hh = p.householdSize;
  const computation: { label: string; value: number }[] = [];
  const assumptions: string[] = [];

  const grossCents = toCents(p.monthlyGrossIncome);
  const grossLimitCents = toCents(grossLimitFor(hh));
  computation.push({ label: 'Gross monthly income', value: toDollars(grossCents) });
  computation.push({ label: `Gross income limit (200% FPL, household of ${hh})`, value: grossLimitFor(hh) });

  // 1. Gross test — elderly/disabled households are exempt (skip to net).
  if (!p.hasElderlyOrDisabled && grossCents > grossLimitCents) {
    return result({
      screening: 'unlikely',
      estimatedBenefit: null,
      computation,
      assumptions,
      reason: `Gross monthly income exceeds the 200% FPL limit of $${grossLimitFor(hh)} for a household of ${hh}.`,
    });
  }
  if (p.hasElderlyOrDisabled) assumptions.push('Household has an elderly (60+) or disabled member: gross income test waived, shelter deduction uncapped, medical deduction applied.');

  // 2. Deductions. Earned/unearned split is load-bearing (20% earned deduction).
  if (p.earnedIncome == null) {
    return result({
      screening: 'need_more_info',
      estimatedBenefit: null,
      computation,
      assumptions,
      reason: 'Need the earned (wage) portion of the income — the 20% earned-income deduction depends on it.',
    });
  }
  const earnedCents = toCents(Math.min(p.earnedIncome, p.monthlyGrossIncome));
  const earnedDeduction = (earnedCents * 20n) / 100n;
  const stdDeduction = toCents(standardDeductionFor(hh));
  const depCare = p.dependentCareCost != null ? toCents(p.dependentCareCost) : ZERO;
  if (p.dependentCareCost == null) assumptions.push('No dependent-care costs counted (none stated).');

  let medical = ZERO;
  if (p.hasElderlyOrDisabled) {
    if (p.medicalExpenses != null && toCents(p.medicalExpenses) > toCents(MEDICAL_THRESHOLD.value)) {
      const actualMinus35 = toCents(p.medicalExpenses) - toCents(MEDICAL_THRESHOLD.value);
      medical = maxBig(toCents(CA_STANDARD_MEDICAL_DEDUCTION.value), actualMinus35);
      assumptions.push(`CA Standard Medical Deduction applied (expenses over $${MEDICAL_THRESHOLD.value}/mo).`);
    } else if (p.medicalExpenses == null) {
      assumptions.push('No medical expenses counted (none stated) — stating them could raise the benefit.');
    }
  }

  computation.push({ label: 'Earned income deduction (20% of earned)', value: toDollars(earnedDeduction) });
  computation.push({ label: `Standard deduction (household of ${hh})`, value: toDollars(stdDeduction) });
  if (depCare > ZERO) computation.push({ label: 'Dependent care deduction', value: toDollars(depCare) });
  if (medical > ZERO) computation.push({ label: 'Medical deduction (elderly/disabled)', value: toDollars(medical) });

  const adjusted = maxBig(ZERO, grossCents - earnedDeduction - stdDeduction - depCare - medical);
  computation.push({ label: 'Adjusted income after deductions', value: toDollars(adjusted) });

  // 3. Shelter. CA is a mandatory-SUA state: renters get rent + SUA.
  let shelterCosts = ZERO;
  if (p.isRenter) {
    if (p.monthlyRent == null) {
      return result({
        screening: 'need_more_info',
        estimatedBenefit: null,
        computation,
        assumptions,
        reason: 'You rent, but the monthly rent amount is missing — the shelter deduction depends on it.',
      });
    }
    shelterCosts = toCents(p.monthlyRent) + toCents(CA_SUA.value);
    assumptions.push(`Standard Utility Allowance of $${CA_SUA.value} applied (California mandatory SUA — actual utility bills are not used).`);
    computation.push({ label: `Shelter costs (rent + $${CA_SUA.value} SUA)`, value: toDollars(shelterCosts) });
  } else {
    assumptions.push('No shelter costs counted (household not renting; homeowner costs not collected in this screen).');
  }

  let excessShelter = maxBig(ZERO, shelterCosts - adjusted / 2n);
  if (!p.hasElderlyOrDisabled) {
    const cap = toCents(SHELTER_CAP.value);
    if (excessShelter > cap) {
      excessShelter = cap;
      assumptions.push(`Excess shelter deduction capped at $${SHELTER_CAP.value} (uncapped only for elderly/disabled households).`);
    }
  }
  computation.push({ label: 'Excess shelter deduction (over 50% of adjusted income)', value: toDollars(excessShelter) });

  const net = maxBig(ZERO, adjusted - excessShelter);
  const netLimitCents = toCents(netLimitFor(hh));
  computation.push({ label: 'Net monthly income', value: toDollars(net) });
  computation.push({ label: `Net income limit (100% FPL, household of ${hh})`, value: netLimitFor(hh) });

  // 4. Net test.
  if (net > netLimitCents) {
    return result({
      screening: 'unlikely',
      estimatedBenefit: null,
      computation,
      assumptions,
      reason: `Net monthly income after deductions exceeds the 100% FPL limit of $${netLimitFor(hh)} for a household of ${hh}.`,
    });
  }

  // 5. Benefit = max allotment − 30% of net (30% rounds UP to the whole dollar).
  const allotmentDollars = BigInt(maxAllotmentFor(hh));
  const thirtyPctDollars = ceilToDollars((net * 30n) / 100n);
  let benefitDollars = allotmentDollars - thirtyPctDollars;
  computation.push({ label: `Maximum allotment (household of ${hh})`, value: maxAllotmentFor(hh) });
  computation.push({ label: '30% of net income (rounded up)', value: Number(thirtyPctDollars) });

  if (benefitDollars <= 0n) {
    computation.push({ label: 'Estimated monthly benefit', value: 0 });
    return result({
      screening: 'unlikely',
      estimatedBenefit: null,
      computation,
      assumptions,
      reason: 'Income passes the screening limits, but the computed monthly allotment is $0.',
    });
  }
  if (hh <= 2 && benefitDollars < BigInt(MINIMUM_BENEFIT_1_2.value)) {
    benefitDollars = BigInt(MINIMUM_BENEFIT_1_2.value);
    assumptions.push(`Minimum benefit of $${MINIMUM_BENEFIT_1_2.value} applied (1-2 person households).`);
  }
  computation.push({ label: 'Estimated monthly benefit', value: Number(benefitDollars) });

  return result({
    screening: 'likely_qualify',
    estimatedBenefit: { amount: Number(benefitDollars), period: 'monthly' },
    computation,
    assumptions,
    reason: `Household of ${hh} passes the FY2026 gross and net income tests; estimated $${Number(benefitDollars)}/month.`,
  });
}
