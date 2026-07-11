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
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { HouseholdProfile, ScreeningResult, FilledApplication } from './contracts.ts';
import { fillCf285 } from './filer/fillCf285.ts';
import { validateProfile } from './validate.ts';
import { screenCalfresh } from './programs/calfresh.ts';
import { screenMediCal } from './programs/medical.ts';
import { screenCare } from './programs/care.ts';
import { screenLifeline } from './programs/lifeline.ts';
import { screenEitc } from './programs/eitc.ts';
import { ensureDataContext, getFplBasis, toScreenContext } from './data/runtime.ts';

export function buildServer(): FastifyInstance {
  const app = Fastify({ logger: false, trustProxy: true });

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
    const screenCtx = ctx ? toScreenContext(ctx) ?? undefined : undefined;
    const basis = ctx ? getFplBasis(ctx) : null;

    const calfresh = screenCalfresh(p, screenCtx);
    const mediCal = screenMediCal(p, basis, screenCtx);
    const care = screenCare(p, basis, screenCtx);
    // Categorical: CalFresh / Medi-Cal likelihood feeds LifeLine deterministically.
    const lifeline = screenLifeline(
      p,
      basis,
      { calfreshLikely: calfresh.screening === 'likely_qualify', mediCalLikely: mediCal.screening === 'likely_qualify' },
      screenCtx,
    );
    const eitc = screenEitc(p, screenCtx); // federal (monthly→annual) + CalEITC

    const results: ScreeningResult[] = [calfresh, mediCal, care, lifeline, ...eitc];
    return reply.send(results);
  });

  // Prompt 4 — the filer. Prepares a review-ready filled CF 285; the HUMAN
  // submits. No code path here (or anywhere) POSTs to a government endpoint.
  const GENERATED_DIR = fileURLToPath(new URL('../generated/', import.meta.url));
  app.post('/fill', async (req, reply) => {
    const body = req.body as { profile?: HouseholdProfile; program?: string };
    if (!body?.profile || (body.program ?? 'CalFresh') !== 'CalFresh') {
      return reply.code(400).send({ error: "body must be { profile, program: 'CalFresh' }" });
    }
    const v = validateProfile(body.profile);
    if (!v.ok) return reply.code(400).send({ error: 'Invalid HouseholdProfile', details: v.errors });

    const { pdf, app: partial } = await fillCf285(body.profile);
    // PII care: random, unguessable file name; nothing about the household in it.
    const name = `cf285-${randomUUID()}.pdf`;
    await mkdir(GENERATED_DIR, { recursive: true });
    await writeFile(`${GENERATED_DIR}${name}`, pdf);
    // Audit trail stores a hash of the artifact, not its contents.
    app.log.info({ action: 'fill', program: 'CalFresh', sha256: createHash('sha256').update(pdf).digest('hex').slice(0, 16) });

    const base = `${req.protocol}://${req.headers.host}`;
    const result: FilledApplication = { ...partial, pdfUrl: `${base}/files/${name}` };
    return result;
  });

  app.get('/files/:name', async (req, reply) => {
    const { name } = req.params as { name: string };
    if (!/^cf285-[0-9a-f-]{36}\.pdf$/.test(name)) return reply.code(404).send({ error: 'not found' });
    try {
      const bytes = await readFile(`${GENERATED_DIR}${name}`);
      return reply.header('content-type', 'application/pdf').send(bytes);
    } catch {
      return reply.code(404).send({ error: 'not found' });
    }
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
