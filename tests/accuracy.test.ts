/**
 * Prompt 6 — screening-accuracy eval harness.
 * 12 labeled personas with hand-computed correct outcomes (from the verified
 * FY2026 constants). Prints an accuracy %; every miss fails the suite. The
 * engine is deterministic, so the value of this harness is the LABELS: each
 * expectation was derived independently on paper from the official numbers.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { HouseholdProfile, ScreeningResult } from '../src/contracts.ts';
import { screenAll } from '../src/server.ts';
import { resetDataCache } from '../src/data/runtime.ts';

beforeAll(() => {
  resetDataCache();
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network disabled — last-good store'); }));
});
afterAll(() => vi.unstubAllGlobals());

type Label = {
  name: string;
  profile: HouseholdProfile;
  expect: { program: string; screening: ScreeningResult['screening']; amount?: number; period?: string }[];
};

const p = (over: Partial<HouseholdProfile>): HouseholdProfile => ({
  householdSize: 1,
  monthlyGrossIncome: 1000,
  earnedIncome: 1000,
  hasChildren: false,
  hasElderlyOrDisabled: false,
  isRenter: false,
  countyFips: '06075',
  preferredLanguage: 'en',
  ...over,
});

const LABELED: Label[] = [
  {
    name: 'single parent hh2, $2,800 earned, rent $1,800 (the demo persona)',
    profile: p({ householdSize: 2, monthlyGrossIncome: 2800, earnedIncome: 2800, hasChildren: true, childrenAges: [4], isRenter: true, monthlyRent: 1800 }),
    expect: [
      { program: 'CalFresh', screening: 'likely_qualify', amount: 159, period: 'monthly' },
      { program: 'EITC (federal)', screening: 'likely_qualify', amount: 2875, period: 'annual' },
      { program: 'CalEITC', screening: 'unlikely' }, // $33,600/yr > $32,900 cap
      { program: 'California LifeLine', screening: 'likely_qualify' }, // categorical via CalFresh
    ],
  },
  {
    name: 'senior alone, $1,900 unearned, rent $1,500 (elderly path, uncapped shelter)',
    profile: p({ monthlyGrossIncome: 1900, earnedIncome: 0, hasElderlyOrDisabled: true, isRenter: true, monthlyRent: 1500 }),
    expect: [{ program: 'CalFresh', screening: 'likely_qualify', amount: 185, period: 'monthly' }],
  },
  {
    name: 'over-threshold single, $2,700 earned (honest unlikely)',
    profile: p({ monthlyGrossIncome: 2700, earnedIncome: 2700 }),
    expect: [
      { program: 'CalFresh', screening: 'unlikely' },
      { program: 'CalEITC', screening: 'likely_qualify' }, // $32,400 ≤ $32,900
    ],
  },
  {
    name: 'gross exactly at the hh1 limit ($2,610) — passes gross, fails net',
    profile: p({ monthlyGrossIncome: 2610, earnedIncome: 2610 }),
    expect: [{ program: 'CalFresh', screening: 'unlikely' }], // net 1879 > 1305
  },
  {
    name: 'hh4, $4,200 earned, rent $2,600 — shelter cap pulls net under',
    profile: p({ householdSize: 4, monthlyGrossIncome: 4200, earnedIncome: 4200, hasChildren: true, childrenAges: [3, 7], isRenter: true, monthlyRent: 2600 }),
    expect: [{ program: 'CalFresh', screening: 'likely_qualify', amount: 276, period: 'monthly' }],
  },
  {
    name: 'deep poverty hh1, $300 earned, rent $800 — net floors at 0, full allotment',
    profile: p({ monthlyGrossIncome: 300, earnedIncome: 300, isRenter: true, monthlyRent: 800 }),
    expect: [{ program: 'CalFresh', screening: 'likely_qualify', amount: 298, period: 'monthly' }],
  },
  {
    name: 'hh1, $1,129 unearned — computed $22 rises to the $24 minimum',
    profile: p({ monthlyGrossIncome: 1129, earnedIncome: 0 }),
    expect: [{ program: 'CalFresh', screening: 'likely_qualify', amount: 24, period: 'monthly' }],
  },
  {
    name: 'renter with unknown rent — need_more_info, never a guess',
    profile: p({ householdSize: 2, monthlyGrossIncome: 2000, earnedIncome: 2000, isRenter: true }),
    expect: [{ program: 'CalFresh', screening: 'need_more_info' }],
  },
  {
    name: 'unknown earned/unearned split — need_more_info',
    profile: p({ householdSize: 3, monthlyGrossIncome: 2500, earnedIncome: null as unknown as number }),
    expect: [
      { program: 'CalFresh', screening: 'need_more_info' },
      { program: 'EITC (federal)', screening: 'need_more_info' },
    ],
  },
  {
    // The deliberately-hard persona: elderly + medical deduction + uncapped shelter.
    name: 'HARD: elderly hh2, $2,200 unearned, rent $1,400, $250 medical',
    profile: p({ householdSize: 2, monthlyGrossIncome: 2200, earnedIncome: 0, hasElderlyOrDisabled: true, isRenter: true, monthlyRent: 1400, medicalExpenses: 250 }),
    // medical = max($150, 250−35) = $215; adjusted 2200−209−215 = 1776;
    // shelter 1400+663 = 2063; excess 2063−888 = 1175 (uncapped); net 601;
    // 30% = 180.30 → 181; 546−181 = 365.
    expect: [{ program: 'CalFresh', screening: 'likely_qualify', amount: 365, period: 'monthly' }],
  },
  {
    name: 'high-income elderly — gross-exempt but fails net honestly',
    profile: p({ monthlyGrossIncome: 5000, earnedIncome: 5000, hasElderlyOrDisabled: true }),
    expect: [{ program: 'CalFresh', screening: 'unlikely' }],
  },
  {
    name: 'hh6, $4,000 earned, rent $2,200',
    profile: p({ householdSize: 6, monthlyGrossIncome: 4000, earnedIncome: 4000, hasChildren: true, childrenAges: [2, 5, 8, 11], isRenter: true, monthlyRent: 2200 }),
    // adjusted 4000−800−299 = 2901; shelter 2863; excess capped 744; net 2157;
    // 30% = 647.10 → 648; 1421−648 = 773.
    expect: [{ program: 'CalFresh', screening: 'likely_qualify', amount: 773, period: 'monthly' }],
  },
];

describe('screening accuracy — labeled persona eval harness', () => {
  it('every labeled outcome matches the engine (prints accuracy %)', async () => {
    let checks = 0;
    let hits = 0;
    const misses: string[] = [];
    for (const label of LABELED) {
      const results = await screenAll(label.profile);
      for (const exp of label.expect) {
        checks++;
        const r = results.find((x) => x.program === exp.program);
        const screeningOk = r?.screening === exp.screening;
        const amountOk =
          exp.amount === undefined ||
          (r?.estimatedBenefit && typeof r.estimatedBenefit.amount === 'number' && r.estimatedBenefit.amount === exp.amount && r.estimatedBenefit.period === exp.period);
        if (screeningOk && amountOk) hits++;
        else misses.push(`${label.name} → ${exp.program}: expected ${exp.screening}${exp.amount ? ` $${exp.amount}/${exp.period}` : ''}, got ${r?.screening}${r?.estimatedBenefit ? ` $${JSON.stringify(r.estimatedBenefit.amount)}/${r.estimatedBenefit.period}` : ''}`);
      }
    }
    const pct = ((hits / checks) * 100).toFixed(1);
    // eslint-disable-next-line no-console
    console.log(`\n=== SCREENING ACCURACY: ${hits}/${checks} labeled outcomes correct (${pct}%) across ${LABELED.length} personas ===\n`);
    if (misses.length) console.log('MISSES:\n' + misses.join('\n'));
    expect(misses).toEqual([]);
    expect(hits).toBe(checks);
  });
});
