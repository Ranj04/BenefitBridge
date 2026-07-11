// ⚠️ MOCK — local stand-in for Person B's POST /screen (Prompt 1).
// Returns a canned, contract-valid ScreeningResult[] so the Gradient graph is
// buildable before B's live SCREEN_URL exists. Every response is marked [MOCK].
// Swap: point the agent function route at the real SCREEN_URL and stop running this.

import Fastify from 'fastify';
import type { HouseholdProfile, ScreeningResult } from './contracts.js';

const app = Fastify({ logger: true });

const profileSchema = {
  type: 'object',
  required: [
    'householdSize',
    'monthlyGrossIncome',
    'earnedIncome',
    'hasChildren',
    'hasElderlyOrDisabled',
    'isRenter',
    'countyFips',
    'preferredLanguage',
  ],
  properties: {
    householdSize: { type: 'integer', minimum: 1 },
    monthlyGrossIncome: { type: 'number', minimum: 0 },
    earnedIncome: { type: 'number', minimum: 0 },
    hasChildren: { type: 'boolean' },
    childrenAges: { type: 'array', items: { type: 'integer', minimum: 0 } },
    hasElderlyOrDisabled: { type: 'boolean' },
    isRenter: { type: 'boolean' },
    monthlyRent: { type: 'number', minimum: 0 },
    monthlyUtilities: { type: 'number', minimum: 0 },
    dependentCareCost: { type: 'number', minimum: 0 },
    medicalExpenses: { type: 'number', minimum: 0 },
    countyFips: { type: 'string', pattern: '^\\d{5}$' },
    immigrationStatus: { type: 'string', enum: ['citizen', 'lpr', 'other'] },
    preferredLanguage: { type: 'string', minLength: 2 },
  },
  additionalProperties: false,
} as const;

app.post<{ Body: HouseholdProfile }>(
  '/screen',
  { schema: { body: profileSchema } },
  async (req, reply) => {
    const p = req.body;
    const result: ScreeningResult[] = [
      {
        program: 'CalFresh',
        screening: 'likely_qualify',
        estimatedBenefit: { amount: 350, period: 'monthly' },
        computation: [
          { label: '[MOCK] Gross monthly income', value: p.monthlyGrossIncome },
          { label: '[MOCK] Gross limit, household of ' + p.householdSize, value: p.householdSize === 2 ? 3526 : 0 },
          { label: '[MOCK] Estimated monthly benefit', value: 350 },
        ],
        assumptions: [
          '[MOCK] Canned response from the local mock — no real cascade was computed.',
          '[MOCK] Replace with the live /screen (Person B) before any demo.',
        ],
        reason:
          '[MOCK] Canned CalFresh result for graph development. Real screening comes from the deterministic engine at SCREEN_URL.',
        citations: [
          {
            text: 'CalFresh income limits (FY2026), California Department of Social Services',
            source_url: 'https://www.cdss.ca.gov/inforesources/calfresh/eligibility-and-issuance-requirements',
            as_of: '2026-07-10',
          },
        ],
        applyUrl: 'https://www.getcalfresh.org/',
        disclaimer:
          'Estimate, not a determination. Confirm with SF HSA. (MOCK response — for development only.)',
      },
    ];
    reply.header('x-benefitbridge-mock', 'true');
    return result;
  },
);

const port = Number(process.env.MOCK_PORT ?? 8787);
app.listen({ port, host: '0.0.0.0' }).then(() => {
  console.log(`[MOCK] /screen listening on :${port} — this is NOT the real engine`);
});
