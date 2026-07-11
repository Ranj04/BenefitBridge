/**
 * THE REAL /screen ENGINE SERVER (Person B, Prompt 1) — not the mock.
 * POST /screen : HouseholdProfile → ScreeningResult[]  (deterministic, no LLM)
 *
 * Validation policy:
 *  - structural problems (wrong types, householdSize absent or < 1,
 *    monthlyGrossIncome absent) → 400
 *  - path-level gaps (renter with no rent, unknown earned split) → 200 with
 *    screening: 'need_more_info' — the engine never silently invents a value.
 */
import Fastify, { type FastifyInstance } from 'fastify';
import type { HouseholdProfile, ScreeningResult } from './contracts.ts';
import { validateProfile } from './validate.ts';
import { screenCalfresh } from './programs/calfresh.ts';

export function buildServer(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.post('/screen', async (req, reply) => {
    const v = validateProfile(req.body);
    if (!v.ok) return reply.code(400).send({ error: 'Invalid HouseholdProfile', details: v.errors });

    const p = req.body as HouseholdProfile;
    // Engine-required presence (validateProfile allows nulls for intake use):
    const engineErrors: string[] = [];
    if (p.householdSize == null) engineErrors.push('householdSize is required for screening');
    if (p.monthlyGrossIncome == null) engineErrors.push('monthlyGrossIncome is required for screening');
    if (engineErrors.length) return reply.code(400).send({ error: 'Invalid HouseholdProfile', details: engineErrors });

    const results: ScreeningResult[] = [screenCalfresh(p)];
    return reply.send(results);
  });

  app.get('/health', async () => ({ ok: true, engine: 'benefitbridge-screen', mock: false }));
  return app;
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const port = Number(process.env.PORT ?? 8080);
  buildServer()
    .listen({ port, host: '0.0.0.0' })
    .then(() => console.log(`[ENGINE /screen] listening on :${port}`))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
