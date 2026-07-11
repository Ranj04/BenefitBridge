/**
 * CalFresh FY2026 constants (effective 2025-10-01 through 2026-09-30).
 * EVERY value verified against the cited official source — no invented numbers.
 * Whole US dollars unless noted; convert to cents (bigint) in the engine.
 */

export type Sourced<T> = { value: T; source_url: string; as_of: string };

/** Gross income limit, 200% FPL (CA BBCE), monthly USD by household size 1..7. */
export const GROSS_LIMIT: Sourced<Record<number, number>> = {
  value: { 1: 2610, 2: 3526, 3: 4442, 4: 5360, 5: 6276, 6: 7192, 7: 8110 },
  source_url: 'https://www.cdss.ca.gov/inforesources/calfresh/eligibility-and-issuance-requirements',
  as_of: '2026-07-10', // provided verified in the build plan (CDSS / USDA FNS FY2026)
};
export const GROSS_LIMIT_EACH_ADDL = 918; // per member beyond 7

/** Net income limit, 100% FPL, monthly USD by household size 1..7. */
export const NET_LIMIT: Sourced<Record<number, number>> = {
  value: { 1: 1305, 2: 1763, 3: 2221, 4: 2680, 5: 3138, 6: 3596, 7: 4055 },
  source_url: 'https://www.cdss.ca.gov/inforesources/calfresh/eligibility-and-issuance-requirements',
  as_of: '2026-07-10',
};
export const NET_LIMIT_EACH_ADDL = 459;

/** Maximum monthly allotment, 48 states & DC, USD by household size 1..8. */
export const MAX_ALLOTMENT: Sourced<Record<number, number>> = {
  value: { 1: 298, 2: 546, 3: 785, 4: 994, 5: 1183, 6: 1421, 7: 1571, 8: 1789 },
  source_url: 'https://fns-prod.azureedge.us/sites/default/files/resource-files/snap-fy26maximumAllotments-deductions.pdf',
  as_of: '2026-07-11',
};
export const MAX_ALLOTMENT_EACH_ADDL = 218; // per member beyond 8

/** Standard deduction, 48 states & DC, USD: hh 1-3 $209, 4 $223, 5 $261, 6+ $299. */
export const STANDARD_DEDUCTION: Sourced<Record<number, number>> = {
  value: { 1: 209, 2: 209, 3: 209, 4: 223, 5: 261, 6: 299 },
  source_url: 'https://fns-prod.azureedge.us/sites/default/files/resource-files/snap-fy26maximumAllotments-deductions.pdf',
  as_of: '2026-07-11',
};

/** Excess shelter deduction cap (48 states & DC); uncapped for elderly/disabled. */
export const SHELTER_CAP: Sourced<number> = {
  value: 744,
  source_url: 'https://fns-prod.azureedge.us/sites/default/files/resource-files/snap-fy26maximumAllotments-deductions.pdf',
  as_of: '2026-07-11',
};

/** Minimum monthly benefit for eligible 1-2 person households (48 states & DC). */
export const MINIMUM_BENEFIT_1_2: Sourced<number> = {
  value: 24,
  source_url: 'https://www.usda.gov/sites/default/files/guidance-documents/fns.snap-cola-fy26memo.pdf',
  as_of: '2026-07-11',
};

/** Medical expense threshold (elderly/disabled), statutory. */
export const MEDICAL_THRESHOLD: Sourced<number> = {
  value: 35,
  source_url: 'https://my.dpss.lacounty.gov/public/en/home/epolicy/program/calfresh/calfresh-cola.html',
  as_of: '2026-07-11',
};

/**
 * California Standard Medical Deduction: expenses over $35/mo → standard $150
 * deduction; actual − $35 when that exceeds $150 (i.e. expenses > $185).
 */
export const CA_STANDARD_MEDICAL_DEDUCTION: Sourced<number> = {
  value: 150,
  source_url: 'https://my.dpss.lacounty.gov/public/en/home/epolicy/program/calfresh/calfresh-cola.html',
  as_of: '2026-07-11',
};

/** California Standard Utility Allowance (mandatory-SUA state), ACIN I-46-25. */
export const CA_SUA: Sourced<number> = {
  value: 663,
  source_url: 'https://my.dpss.lacounty.gov/public/en/home/epolicy/program/calfresh/calfresh-cola.html',
  as_of: '2026-07-11',
};

export const APPLY_URL = 'https://www.getcalfresh.org/';
export const DISCLAIMER =
  'Estimated amount based on what you told us. This is an estimate, not a determination — confirm with San Francisco HSA when you apply.';

export function grossLimitFor(hh: number): number {
  return hh <= 7 ? GROSS_LIMIT.value[hh] : GROSS_LIMIT.value[7] + (hh - 7) * GROSS_LIMIT_EACH_ADDL;
}
export function netLimitFor(hh: number): number {
  return hh <= 7 ? NET_LIMIT.value[hh] : NET_LIMIT.value[7] + (hh - 7) * NET_LIMIT_EACH_ADDL;
}
export function maxAllotmentFor(hh: number): number {
  return hh <= 8 ? MAX_ALLOTMENT.value[hh] : MAX_ALLOTMENT.value[8] + (hh - 8) * MAX_ALLOTMENT_EACH_ADDL;
}
export function standardDeductionFor(hh: number): number {
  return STANDARD_DEDUCTION.value[Math.min(hh, 6)];
}
