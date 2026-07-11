import type { ScreeningResult } from '../types';

// Pure presentation math over the engine's results. Nothing here computes
// eligibility — it only summarizes numbers the deterministic engine returned.

export type HeroTotals = {
  monthly: number; // sum of likely_qualify monthly estimates (low end of ranges)
  annual: number; // sum of likely_qualify annual estimates (tax credits)
  likelyCount: number; // programs marked likely_qualify, including $-less ones
  approximate: boolean; // true when any summed amount was a range
};

export function heroTotals(results: ScreeningResult[]): HeroTotals {
  let monthly = 0;
  let annual = 0;
  let approximate = false;
  let likelyCount = 0;
  for (const r of results) {
    if (r.screening !== 'likely_qualify') continue;
    likelyCount++;
    const b = r.estimatedBenefit;
    if (!b) continue;
    const amt = typeof b.amount === 'number' ? b.amount : (approximate = true, b.amount.low);
    if (b.period === 'monthly') monthly += amt;
    else if (b.period === 'annual') annual += amt;
  }
  return { monthly, annual, likelyCount, approximate };
}

/**
 * The categorical cascade: programs the household unlocks BECAUSE the screen
 * found it likely qualifies for CalFresh (the engine states this in the
 * result's reason — we surface it, we never infer it ourselves).
 */
export function cascadeFrom(results: ScreeningResult[]): { root: ScreeningResult; unlocked: ScreeningResult[] } | null {
  const root = results.find((r) => r.program === 'CalFresh' && r.screening === 'likely_qualify');
  if (!root) return null;
  const unlocked = results.filter(
    (r) => r.program !== 'CalFresh' && r.screening === 'likely_qualify' && /calfresh/i.test(r.reason),
  );
  return unlocked.length ? { root, unlocked } : null;
}

export function fmtUsd(n: number): string {
  return `$${n.toLocaleString('en-US')}`;
}

export function amountLabel(b: NonNullable<ScreeningResult['estimatedBenefit']>): string {
  return typeof b.amount === 'number' ? fmtUsd(b.amount) : `${fmtUsd(b.amount.low)}–${fmtUsd(b.amount.high)}`;
}
