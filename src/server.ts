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
import { ensureDataContext, toScreenContext } from './data/runtime.ts';

export function buildServer(): FastifyInstance {
  const app = Fastify({ logger: false });

  // Live-data layer (Prompt 3.5): re-sync FPL from the HHS ASPE API on demand.
  // TTL-cached in memory; falls back to the last-good versioned store, flagged
  // 'cached'. Never fatal — the engine's published-chart constants stand alone.
  app.post('/sync', async () => {
    const ctx = await ensureDataContext({ force: true });
    if (!ctx) return { synced: false, reason: 'live API unreachable and no last-good store' };
    return {
      synced: true,
      version: ctx.store.version,
      freshness: ctx.freshness,
      generated_at: ctx.store.generated_at,
      driftWarnings: ctx.driftWarnings,
    };
  });

  app.post('/screen', async (req, reply) => {
    const v = validateProfile(req.body);
    if (!v.ok) return reply.code(400).send({ error: 'Invalid HouseholdProfile', details: v.errors });

    const p = req.body as HouseholdProfile;
    // Engine-required presence (validateProfile allows nulls for intake use):
    const engineErrors: string[] = [];
    if (p.householdSize == null) engineErrors.push('householdSize is required for screening');
    if (p.monthlyGrossIncome == null) engineErrors.push('monthlyGrossIncome is required for screening');
    if (engineErrors.length) return reply.code(400).send({ error: 'Invalid HouseholdProfile', details: engineErrors });

    const ctx = await ensureDataContext(); // TTL-cached; null only if no live API and no store
    const results: ScreeningResult[] = [screenCalfresh(p, ctx ? toScreenContext(ctx) ?? undefined : undefined)];
    return reply.send(results);
  });

  app.get('/health', async () => ({ ok: true, engine: 'benefitbridge-screen', mock: false }));
  return app;
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const port = Number(process.env.PORT ?? 8080);
  // Warm the live-data layer at startup (non-fatal by design).
  void ensureDataContext().then((ctx) =>
    console.log(ctx ? `[data] store v${ctx.store.version} ready (${ctx.freshness})` : '[data] no live data layer — engine constants only'),
  );
  buildServer()
    .listen({ port, host: '0.0.0.0' })
    .then(() => console.log(`[ENGINE /screen] listening on :${port}`))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
