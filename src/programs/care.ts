/**
 * PG&E CARE (California Alternate Rates for Energy) screening.
 * Income-qualified at ≤ 200% FPL (per PG&E/CPUC); enrollees get a 20%+
 * discount on their energy bill. No bill amount is collected here, so the
 * screen reports eligibility, not a dollar figure.
 */
import type { HouseholdProfile, ScreeningResult } from '../contracts.ts';
import type { ScreenDataContext } from '../data/runtime.ts';
import { type FplBasis, monthlyLimitUsd } from './fplBasis.ts';

const PGE_URL =
  'https://www.pge.com/en/account/billing-and-assistance/financial-assistance/california-alternate-rates-for-energy-program.html';
const DISCLAIMER =
  'Estimated screening based on what you told us. This is an estimate, not a determination — confirm when you apply.';
const CARE_BP = 20000; // ≤ 200% FPL, per PG&E/CPUC

export function screenCare(p: HouseholdProfile, basis: FplBasis | null, data?: ScreenDataContext): ScreeningResult {
  const common = {
    program: 'PG&E CARE',
    estimatedBenefit: null,
    applyUrl: PGE_URL,
    disclaimer: DISCLAIMER,
    ...(data ? { data_freshness: data.freshness, dataVersion: data.version } : {}),
  };
  const citations = [
    { text: 'CARE program income guidelines (≤ 200% federal poverty guidelines), PG&E/CPUC', source_url: PGE_URL, as_of: '2026' },
    ...(basis
      ? [{
          text: `FPL basis pulled live from the HHS ASPE Poverty Guidelines API${data ? ` (store v${data.version})` : ''}`,
          source_url: basis.provenance.source_url,
          as_of: basis.provenance.as_of,
        }]
      : []),
  ];
  if (!basis) {
    return {
      ...common,
      screening: 'need_more_info',
      computation: [],
      assumptions: [],
      reason: 'Live FPL data is unavailable right now, so the CARE income limit cannot be derived. Try again shortly.',
      citations,
    };
  }

  const limit = monthlyLimitUsd(basis, p.householdSize, CARE_BP);
  const computation = [
    { label: 'Gross monthly income', value: p.monthlyGrossIncome },
    { label: `CARE limit (200% FPL ${basis.year}, household of ${p.householdSize})`, value: limit },
  ];
  const assumptions = [
    'Assumes the household is a PG&E customer (San Francisco). Other utilities run equivalent CARE programs.',
    `Income limit derived live from the ${basis.year} federal poverty guidelines (HHS ASPE API); PG&E publishes its own chart on a June–May cycle — confirm against it when applying.`,
  ];
  if (p.monthlyGrossIncome <= limit) {
    return {
      ...common,
      screening: 'likely_qualify',
      computation,
      assumptions,
      reason: `Household income is within 200% FPL ($${limit}/mo for ${p.householdSize}): likely qualifies for a 20%-or-more discount on the monthly energy bill.`,
      citations,
    };
  }
  return {
    ...common,
    screening: 'unlikely',
    computation,
    assumptions,
    reason: `Household income exceeds the CARE limit of $${limit}/mo for a household of ${p.householdSize}.`,
    citations,
  };
}
