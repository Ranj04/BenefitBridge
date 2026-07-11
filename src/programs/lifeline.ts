/**
 * California LifeLine (discounted/free phone service) screening.
 * Two deterministic paths, per CPUC:
 *  - program-based: a household member in CalFresh, Medi-Cal, SSI, etc.
 *    (encoded here as: this same screen found CalFresh or Medi-Cal likely)
 *  - income-based: household income ≤ 150% FPL.
 * The discount amount varies by carrier, so the screen reports eligibility.
 */
import type { HouseholdProfile, ScreeningResult } from '../contracts.ts';
import type { ScreenDataContext } from '../data/runtime.ts';
import { type FplBasis, monthlyLimitUsd } from './fplBasis.ts';

const CPUC_URL =
  'https://www.cpuc.ca.gov/consumer-support/financial-assistance-savings-and-discounts/lifeline/california-lifeline-eligibility';
const DISCLAIMER =
  'Estimated screening based on what you told us. This is an estimate, not a determination — confirm when you apply.';
const LIFELINE_BP = 15000; // ≤ 150% FPL income method, per CPUC

export function screenLifeline(
  p: HouseholdProfile,
  basis: FplBasis | null,
  categorical: { calfreshLikely: boolean; mediCalLikely: boolean },
  data?: ScreenDataContext,
): ScreeningResult {
  const common = {
    program: 'California LifeLine',
    estimatedBenefit: null,
    applyUrl: 'https://www.californialifeline.com/',
    disclaimer: DISCLAIMER,
    ...(data ? { data_freshness: data.freshness, dataVersion: data.version } : {}),
  };
  const citations = [
    { text: 'California LifeLine eligibility: qualifying programs or income ≤ 150% FPL (CPUC)', source_url: CPUC_URL, as_of: '2026' },
    ...(basis
      ? [{
          text: `FPL basis pulled live from the HHS ASPE Poverty Guidelines API${data ? ` (store v${data.version})` : ''}`,
          source_url: basis.provenance.source_url,
          as_of: basis.provenance.as_of,
        }]
      : []),
  ];

  // Categorical (program-based) path — deterministic from this run's screens.
  if (categorical.calfreshLikely || categorical.mediCalLikely) {
    const via = [categorical.calfreshLikely ? 'CalFresh' : null, categorical.mediCalLikely ? 'Medi-Cal' : null]
      .filter(Boolean)
      .join(' / ');
    return {
      ...common,
      screening: 'likely_qualify',
      computation: [],
      assumptions: [`Program-based eligibility: once enrolled in ${via}, LifeLine enrollment uses that as proof — no income documentation needed.`],
      reason: `This screening found the household likely qualifies for ${via}; enrollment in either program qualifies the household for California LifeLine (discounted or free phone service).`,
      citations,
    };
  }

  if (!basis) {
    return {
      ...common,
      screening: 'need_more_info',
      computation: [],
      assumptions: [],
      reason: 'Live FPL data is unavailable right now, so the LifeLine income limit cannot be derived. Try again shortly.',
      citations,
    };
  }

  const limit = monthlyLimitUsd(basis, p.householdSize, LIFELINE_BP);
  const computation = [
    { label: 'Gross monthly income', value: p.monthlyGrossIncome },
    { label: `LifeLine limit (150% FPL ${basis.year}, household of ${p.householdSize})`, value: limit },
  ];
  if (p.monthlyGrossIncome <= limit) {
    return {
      ...common,
      screening: 'likely_qualify',
      computation,
      assumptions: [`Income limit derived live from the ${basis.year} federal poverty guidelines (HHS ASPE API); the CPUC publishes its own chart on a June–May cycle — confirm when applying.`],
      reason: `Household income is within 150% FPL ($${limit}/mo for ${p.householdSize}): likely qualifies for discounted or free phone service.`,
      citations,
    };
  }
  return {
    ...common,
    screening: 'unlikely',
    computation,
    assumptions: [],
    reason: `Household income exceeds the LifeLine income limit of $${limit}/mo and no qualifying-program path was found by this screening.`,
    citations,
  };
}
