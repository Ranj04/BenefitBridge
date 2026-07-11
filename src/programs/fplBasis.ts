/**
 * FPL basis handed to the FPL-percentage programs (Medi-Cal, CARE, LifeLine).
 * Built from the live versioned store (see runtime.getFplBasis) — these
 * programs have NO hardcoded fallback chart by design: without live FPL data
 * they answer need_more_info rather than invent a threshold.
 */
import type { Provenance } from '../data/provenance.ts';
import { deriveMonthlyLimitCents } from '../data/fplRules.ts';

export type FplBasis = {
  year: number;
  /** Annual FPL USD for household sizes 1..8 (plus live >8 extrapolation). */
  annualUsdFor: (householdSize: number) => number;
  provenance: Provenance;
};

/** Monthly income limit in whole USD for a % of FPL (basis points). */
export function monthlyLimitUsd(basis: FplBasis, householdSize: number, pctBasisPoints: number): number {
  return Number(deriveMonthlyLimitCents(basis.annualUsdFor(householdSize), pctBasisPoints) / 100n);
}
