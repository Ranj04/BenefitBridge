/**
 * DigitalOcean Function backing the Gradient "screen_calfresh" function route.
 * The Gradient agent invokes this with a HouseholdProfile; it forwards to Person B's
 * deterministic /screen (SCREEN_URL) and returns the ScreeningResult[] unchanged.
 *
 * This function does NO eligibility logic — it is a pure transport shim so the model
 * can reach the deterministic engine. All numbers come from SCREEN_URL.
 */
/**
 * Contract-valid MOCK ScreeningResult[] used only while SCREEN_URL is unset
 * (Person B's engine not yet deployed). Mirrors src/mock-screen.ts — same
 * illustrative placeholders, same need_more_info behavior. CLEARLY A MOCK:
 * once SCREEN_URL is set on the function, this path is never taken.
 */
function mockScreen(p) {
  const disclaimer =
    'Estimate, not a determination. Confirm with San Francisco HSA. (MOCK DATA — wiring only.)';
  const citations = [
    {
      text: 'CalFresh income eligibility standards (MOCK)',
      source_url: 'https://www.cdss.ca.gov/calfresh',
      as_of: '2026-07-10',
    },
  ];
  const applyUrl = 'https://www.getcalfresh.org/';

  if (typeof p.householdSize !== 'number' || typeof p.monthlyGrossIncome !== 'number') {
    return {
      statusCode: 400,
      body: { error: 'Invalid HouseholdProfile: householdSize and monthlyGrossIncome are required numbers.' },
    };
  }

  // Renter with no rent amount -> need_more_info (mirrors the real engine's behavior).
  if (p.isRenter && (p.monthlyRent === undefined || p.monthlyRent === null)) {
    return {
      statusCode: 200,
      body: [{
        program: 'CalFresh',
        screening: 'need_more_info',
        estimatedBenefit: null,
        computation: [{ label: 'monthly gross income', value: p.monthlyGrossIncome }],
        assumptions: ['Renter but monthly rent not provided'],
        reason: 'Need the monthly rent amount to estimate the shelter deduction.',
        citations, applyUrl, disclaimer,
      }],
    };
  }

  // Crude over-threshold gate for the mock (real gross limits live in the engine).
  const roughLimit = 2610 * Math.max(1, p.householdSize);
  if (!p.hasElderlyOrDisabled && p.monthlyGrossIncome > roughLimit) {
    return {
      statusCode: 200,
      body: [{
        program: 'CalFresh',
        screening: 'unlikely',
        estimatedBenefit: null,
        computation: [
          { label: 'monthly gross income', value: p.monthlyGrossIncome },
          { label: 'approx gross limit', value: roughLimit },
        ],
        assumptions: ['MOCK gross-only screen'],
        reason: 'Gross income appears above the CalFresh limit for this household size.',
        citations, applyUrl, disclaimer,
      }],
    };
  }

  return {
    statusCode: 200,
    body: [{
      program: 'CalFresh',
      screening: 'likely_qualify',
      estimatedBenefit: { amount: 291, period: 'monthly' },
      computation: [
        { label: 'monthly gross income', value: p.monthlyGrossIncome },
        { label: 'estimated monthly benefit (MOCK)', value: 291 },
      ],
      assumptions: ['MOCK estimate for wiring only'],
      reason: 'Household appears within CalFresh income limits.',
      citations, applyUrl, disclaimer,
    }],
  };
}

async function main(args) {
  const screenUrl = process.env.SCREEN_URL;

  // Gradient passes the function arguments as the profile fields (plus DO's own keys).
  if (!screenUrl) {
    const { __ow_method, __ow_headers, __ow_path, ...profile } = args || {};
    return mockScreen(profile);
  }

  const { __ow_method, __ow_headers, __ow_path, ...profile } = args || {};

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(screenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(profile),
      signal: controller.signal,
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: 'Non-JSON from /screen', raw: text };
    }
    return { statusCode: res.status, body: data };
  } catch (err) {
    return { statusCode: 502, body: { error: `Failed to reach /screen: ${err.message}` } };
  } finally {
    clearTimeout(timeout);
  }
}

exports.main = main;
