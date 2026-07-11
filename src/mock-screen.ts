/**
 * Local mock of Person B's POST /screen (Task A0.2).
 * Returns a contract-valid ScreeningResult[] so the Gradient graph is fully
 * buildable before Person B deploys. CLEARLY A MOCK — swap for SCREEN_URL later.
 *
 * The numbers here are illustrative placeholders for wiring only. They are NOT a
 * real CalFresh computation and are labeled as such; the real engine is Person B's.
 */
import Fastify, { type FastifyInstance } from 'fastify';
import type { HouseholdProfile, ScreeningResult } from './contracts.ts';
import { config } from './config.ts';
import { writeScreenTrace } from './trace.ts';

export function mockCalfresh(p: HouseholdProfile): ScreeningResult {
  const disclaimer =
    'Estimate, not a determination. Confirm with San Francisco HSA. (MOCK DATA — wiring only.)';
  const citations = [
    {
      text: 'CalFresh income eligibility standards (MOCK)',
      source_url: 'https://www.cdss.ca.gov/calfresh',
      as_of: '2026-07-10',
    },
  ];

  // Renter with no rent amount -> need_more_info (mirrors the real engine's behavior).
  if (p.isRenter && (p.monthlyRent === undefined || p.monthlyRent === null)) {
    return {
      program: 'CalFresh',
      screening: 'need_more_info',
      estimatedBenefit: null,
      computation: [{ label: 'monthly gross income', value: p.monthlyGrossIncome }],
      assumptions: ['Renter but monthly rent not provided'],
      reason: 'Need the monthly rent amount to estimate the shelter deduction.',
      citations,
      applyUrl: 'https://www.getcalfresh.org/',
      disclaimer,
    };
  }

  // Crude over-threshold gate for the mock (real gross limits live in the engine).
  const grossLimitByOne = 2610; // FY2026 hh=1 gross limit, illustrative
  const roughLimit = grossLimitByOne * Math.max(1, p.householdSize);
  if (!p.hasElderlyOrDisabled && p.monthlyGrossIncome > roughLimit) {
    return {
      program: 'CalFresh',
      screening: 'unlikely',
      estimatedBenefit: null,
      computation: [
        { label: 'monthly gross income', value: p.monthlyGrossIncome },
        { label: 'approx gross limit', value: roughLimit },
      ],
      assumptions: ['MOCK gross-only screen'],
      reason: 'Gross income appears above the CalFresh limit for this household size.',
      citations,
      applyUrl: 'https://www.getcalfresh.org/',
      disclaimer,
    };
  }

  return {
    program: 'CalFresh',
    screening: 'likely_qualify',
    estimatedBenefit: { amount: 291, period: 'monthly' },
    computation: [
      { label: 'monthly gross income', value: p.monthlyGrossIncome },
      { label: 'estimated monthly benefit (MOCK)', value: 291 },
    ],
    assumptions: ['MOCK estimate for wiring only'],
    reason: 'Household appears within CalFresh income limits.',
    citations,
    applyUrl: 'https://www.getcalfresh.org/',
    disclaimer,
  };
}

/** Build the mock server. Exported so tests can use app.inject() without binding a port. */
export function buildMockApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.post('/screen', async (req, reply) => {
    const p = req.body as HouseholdProfile;
    if (!p || typeof p.householdSize !== 'number' || typeof p.monthlyGrossIncome !== 'number') {
      return reply
        .code(400)
        .send({ error: 'Invalid HouseholdProfile: householdSize and monthlyGrossIncome are required numbers.' });
    }
    const results: ScreeningResult[] = [mockCalfresh(p)];
    writeScreenTrace(p, results, true);
    return reply.send(results);
  });

  app.get('/health', async () => ({ ok: true, mock: true }));
  return app;
}

// Only bind a port when run directly (npm run mock), not when imported by tests.
const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const port = config.mockPort;
  buildMockApp()
    .listen({ port, host: '0.0.0.0' })
    .then(() => console.log(`[MOCK /screen] listening on http://localhost:${port}/screen  (NOT the real engine)`))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
