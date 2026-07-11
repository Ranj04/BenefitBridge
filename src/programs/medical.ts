/**
 * Medi-Cal (California Medicaid, MAGI) screening — deterministic, live FPL.
 * Adults 19-64: ≤ 138% FPL. Children 0-18: ≤ 266% FPL. (Pregnancy tier 213%
 * exists but pregnancy is not collected by this screen — noted in assumptions.)
 * Tiers per DHCS; monthly limits derived live from the HHS ASPE FPL basis.
 */
import type { HouseholdProfile, ScreeningResult } from '../contracts.ts';
import type { ScreenDataContext } from '../data/runtime.ts';
import { type FplBasis, monthlyLimitUsd } from './fplBasis.ts';

const DHCS_URL = 'https://www.dhcs.ca.gov/services/medi-cal/eligibility/Pages/DoYouQualifyForMedi-Cal.aspx';
const DISCLAIMER =
  'Estimated screening based on what you told us. This is an estimate, not a determination — confirm when you apply.';

const ADULT_BP = 13800; // 138% FPL (MAGI adults), per DHCS
const CHILD_BP = 26600; // 266% FPL (children 0-18), per DHCS

export function screenMediCal(p: HouseholdProfile, basis: FplBasis | null, data?: ScreenDataContext): ScreeningResult {
  const common = {
    program: 'Medi-Cal',
    estimatedBenefit: null,
    applyUrl: 'https://www.benefitscal.com/',
    disclaimer: DISCLAIMER,
    ...(data ? { data_freshness: data.freshness, dataVersion: data.version } : {}),
  };
  if (!basis) {
    return {
      ...common,
      screening: 'need_more_info',
      computation: [],
      assumptions: [],
      reason: 'Live FPL data is unavailable right now, so the Medi-Cal income limit cannot be derived. Try again shortly.',
      citations: [{ text: 'Medi-Cal MAGI income levels (DHCS)', source_url: DHCS_URL, as_of: '2026' }],
    };
  }

  const hh = p.householdSize;
  const adultLimit = monthlyLimitUsd(basis, hh, ADULT_BP);
  const childLimit = monthlyLimitUsd(basis, hh, CHILD_BP);
  const income = p.monthlyGrossIncome;

  const computation = [
    { label: 'Gross monthly income (MAGI proxy)', value: income },
    { label: `Adult limit (138% FPL ${basis.year}, household of ${hh})`, value: adultLimit },
    ...(p.hasChildren ? [{ label: `Children's limit (266% FPL ${basis.year})`, value: childLimit }] : []),
  ];
  const assumptions = [
    'Monthly gross income used as a MAGI proxy — actual MAGI may differ (pre-tax deductions, etc.).',
    `Income limits derived live from the ${basis.year} federal poverty guidelines (HHS ASPE API).`,
    'Pregnancy tier (213% FPL) not screened — pregnancy status is not collected here.',
  ];
  const citations = [
    { text: 'Medi-Cal MAGI tiers: adults 138% FPL, children 266% FPL (DHCS)', source_url: DHCS_URL, as_of: '2026' },
    {
      text: `FPL basis pulled live from the HHS ASPE Poverty Guidelines API${data ? ` (store v${data.version})` : ''}`,
      source_url: basis.provenance.source_url,
      as_of: basis.provenance.as_of,
    },
  ];

  if (income <= adultLimit) {
    return {
      ...common,
      screening: 'likely_qualify',
      computation,
      assumptions,
      reason: `Household income is within 138% FPL ($${adultLimit}/mo for ${hh}): adults and children likely qualify for full-scope, no-cost Medi-Cal coverage.`,
      citations,
    };
  }
  if (p.hasChildren && income <= childLimit) {
    return {
      ...common,
      screening: 'likely_qualify',
      computation,
      assumptions,
      reason: `Household income is over the adult limit but within 266% FPL ($${childLimit}/mo): the children likely qualify for Medi-Cal even though the adults may not.`,
      citations,
    };
  }
  return {
    ...common,
    screening: 'unlikely',
    computation,
    assumptions,
    reason: `Household income exceeds the Medi-Cal limits for a household of ${hh} (adults $${adultLimit}/mo${p.hasChildren ? `, children $${childLimit}/mo` : ''}).`,
    citations,
  };
}
