// src/data/fplRules.ts
// Deterministic derivation of a monthly income limit from an annual FPL guideline.
// Integer/bigint only — no floats anywhere on the money path.
//
// A program's income test is expressed as a percentage of the annual FPL:
//   Medi-Cal (adults) = 138% -> pctBasisPoints 13800
//   CARE / CalFresh gross (CA BBCE) = 200% -> 20000
//   California LifeLine = ~150% -> 15000
//   CalFresh net = 100% -> 10000
//
// Rounding convention: monthly figure rounded UP to the next whole dollar, which matches
// how SNAP publishes its monthly income eligibility standards. If a derived value does not
// match a program's OFFICIAL published chart (e.g. CalFresh's CDSS chart), the published
// chart is authoritative and the mismatch should be surfaced by the cross-check in the
// sync/validation layer — do not silently trust the derivation for CalFresh.

export function deriveMonthlyLimitCents(annualUsd: number, pctBasisPoints: number): bigint {
  if (!Number.isInteger(annualUsd) || annualUsd <= 0) {
    throw new Error(`annualUsd must be a positive integer, got ${annualUsd}`);
  }
  if (!Number.isInteger(pctBasisPoints) || pctBasisPoints <= 0) {
    throw new Error(`pctBasisPoints must be a positive integer, got ${pctBasisPoints}`);
  }
  const numerator = BigInt(annualUsd) * BigInt(pctBasisPoints); // dollars * basis points
  const denom = 10000n * 12n; // basis-point scale (10000) * months (12)
  const floorDollars = numerator / denom;
  const monthlyDollars = numerator % denom === 0n ? floorDollars : floorDollars + 1n; // round up
  return monthlyDollars * 100n; // cents
}

export function centsToUsd(cents: bigint): number {
  return Number(cents) / 100;
}
