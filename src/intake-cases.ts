/**
 * Golden intake cases — free text → expected HouseholdProfile fields.
 * Shared by tests (offline, assert the expectation logic) and scripts/verify-a1.ts
 * (online, run the real intake agent and assert against these).
 *
 * Expectations are expressed as assertions so both callers agree on what "correct"
 * means. `null`-valued expectations enforce the unstated-is-null discipline.
 */

export type IntakeCase = {
  name: string;
  text: string;
  /** exact field expectations; a value of `null` asserts the field is null/absent */
  expect: Record<string, number | boolean | string | null>;
  /** numeric fields allowed a small tolerance (currency normalization rounding) */
  tolerance?: Record<string, number>;
};

export const INTAKE_CASES: IntakeCase[] = [
  {
    name: 'english-single-mom',
    text: 'single mom in SF, about $2,800 a month, one kid, renting',
    expect: {
      householdSize: 2,
      monthlyGrossIncome: 2800,
      hasChildren: true,
      isRenter: true,
      hasElderlyOrDisabled: false,
      monthlyRent: null, // amount not stated → must not be guessed
      preferredLanguage: 'en',
      countyFips: '06075',
    },
    tolerance: { monthlyGrossIncome: 50 },
  },
  {
    name: 'spanish-single-mom',
    text: 'madre soltera en San Francisco, unos 2,800 dólares al mes, un hijo, alquilando',
    expect: {
      householdSize: 2,
      monthlyGrossIncome: 2800,
      isRenter: true,
      preferredLanguage: 'es',
    },
    tolerance: { monthlyGrossIncome: 50 },
  },
  {
    name: 'weekly-wage-normalization',
    text: 'I make $650 a week working full time, just me',
    expect: {
      householdSize: 1,
      monthlyGrossIncome: 2817, // 650 * 52 / 12
      preferredLanguage: 'en',
    },
    tolerance: { monthlyGrossIncome: 30 },
  },
  {
    name: 'missing-income',
    text: 'I have two kids and my rent is really high',
    expect: {
      hasChildren: true,
      isRenter: true,
      monthlyGrossIncome: null, // must NOT fabricate a number
      preferredLanguage: 'en',
    },
  },
  {
    name: 'senior-elderly-path',
    text: "I'm 72, live alone, get about $1,900 a month from Social Security",
    expect: {
      householdSize: 1,
      hasElderlyOrDisabled: true,
      monthlyGrossIncome: 1900,
      preferredLanguage: 'en',
    },
    tolerance: { monthlyGrossIncome: 50 },
  },
];

/** Assert one parsed profile against a case. Returns a list of failure strings (empty = pass). */
export function checkCase(c: IntakeCase, profile: Record<string, unknown>): string[] {
  const failures: string[] = [];
  for (const [key, want] of Object.entries(c.expect)) {
    const got = profile[key];
    if (want === null) {
      if (got !== null && got !== undefined) failures.push(`${key}: expected null/absent, got ${JSON.stringify(got)}`);
      continue;
    }
    if (typeof want === 'number') {
      const tol = c.tolerance?.[key] ?? 0;
      if (typeof got !== 'number' || Math.abs(got - want) > tol) {
        failures.push(`${key}: expected ${want}±${tol}, got ${JSON.stringify(got)}`);
      }
      continue;
    }
    if (got !== want) failures.push(`${key}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
  }
  return failures;
}
