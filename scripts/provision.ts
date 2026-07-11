/**
 * Tasks A1.1–A1.5 — provision the Gradient graph, idempotently.
 * Reconcile-by-name: if a resource with our stable name exists, reuse it; never duplicate.
 * Writes discovered UUIDs/endpoints to .gradient-state.json for the verify scripts.
 *
 * Run: npm run provision   (requires DO_API_TOKEN)
 *
 * NOTE ON GUARDRAILS: the alpha SDK exposes no guardrail create/attach method.
 * Creating + attaching the no-guarantee/PII guardrails is a DO Control Panel step,
 * documented in README-personA.md. This script provisions everything else.
 *
 * NOTE ON THE FUNCTION ROUTE: Gradient function routes are backed by DigitalOcean
 * Functions (FaaS), not raw HTTP. Set FAAS_NAMESPACE + FAAS_NAME (the deployed
 * do-function/ proxy that forwards to SCREEN_URL) to register it; otherwise this
 * step is skipped and flagged.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeClient, pickUuid } from '../src/gradient.ts';
import { config, resolveProjectId, RESOURCE_NAMES } from '../src/config.ts';
import { INTAKE_INSTRUCTION, FOOD_INSTRUCTION, ROUTER_INSTRUCTION } from '../src/prompts.ts';
import { HouseholdProfileJsonSchema, ScreeningResultArrayJsonSchema } from '../src/schemas.ts';

const STATE_PATH = resolve(fileURLToPath(new URL('../.gradient-state.json', import.meta.url)));
const client = makeClient();

type State = Record<string, string>;
const state: State = {};

async function findAgentByName(name: string): Promise<any | undefined> {
  const res: any = await client.agents.list();
  return (res?.agents ?? []).find((a: any) => a.name === name);
}
async function findKbByName(name: string): Promise<any | undefined> {
  const res: any = await client.knowledgeBases.list();
  return (res?.knowledge_bases ?? []).find((k: any) => k.name === name);
}

/** Pick a foundation model + embedding model. Prefers active Claude; skips end-of-life models. */
async function pickModels() {
  const res: any = await client.models.list();
  const models: any[] = res?.models ?? [];
  const isActive = (m: any) => m.lifecycle_status !== 'end_of_life';
  const claudeCandidates = models.filter((m) => /claude/i.test(m.name) && m.is_foundational !== false && isActive(m));
  const claude =
    claudeCandidates.find((m) => /sonnet 4\.6|4\.5 sonnet/i.test(m.name)) ??
    claudeCandidates.find((m) => /sonnet 5|haiku 4\.5/i.test(m.name)) ??
    claudeCandidates[0];
  const fallbacks = [
    models.find((m) => /^MiMo V2\.5$/i.test(m.name) && isActive(m)),
    models.find((m) => /llama 3\.3 instruct \(70B\)/i.test(m.name) && isActive(m)),
    models.find((m) => /mistral nemo instruct/i.test(m.name) && isActive(m)),
  ].filter(Boolean) as any[];
  const embedCandidates = models.filter(
    (m) => /embed/i.test(m.name) || (m.usecases ?? []).some((u: string) => /embed/i.test(u)),
  );
  const embed =
    embedCandidates.find((m) => /gte large|e5 large|bge m3|multi qa mpnet/i.test(m.name)) ??
    embedCandidates[0];

  /** Probe agent-create once so we don't fail mid-provision on Anthropic terms (403). */
  async function canCreate(modelUuid: string): Promise<boolean> {
    try {
      const created: any = await client.agents.create({
        name: `bb-model-probe-${Date.now()}`,
        instruction: 'probe',
        model_uuid: modelUuid,
        region: config.region,
        project_id: (await resolveProjectId())!,
      });
      const uuid = pickUuid(created);
      if (uuid) await client.agents.delete(uuid).catch(() => undefined);
      return true;
    } catch {
      return false;
    }
  }

  let modelUuid: string;
  let modelName: string;
  if (claude && (await canCreate(claude.uuid))) {
    modelUuid = claude.uuid;
    modelName = claude.name;
  } else {
    let picked: any;
    for (const fb of fallbacks) {
      if (await canCreate(fb.uuid)) {
        picked = fb;
        break;
      }
    }
    if (!picked) {
      throw new Error(
        'No agent-compatible model found. In the DO console accept Anthropic model terms, or enable serverless inference.',
      );
    }
    modelUuid = picked.uuid;
    modelName = picked.name;
    console.warn(
      `[warn] Claude agents blocked (accept Anthropic terms: Gradient AI Platform → Models → Anthropic Claude → Accept). Using ${picked.name} for now.`,
    );
  }

  if (!embed) console.warn('[warn] No embedding model auto-detected; KB may need embedding_model_uuid set manually.');
  console.log(`Selected agent model: ${modelName}`);
  return { modelUuid, embedUuid: embed?.uuid as string | undefined };
}

async function ensureAgent(
  name: string,
  instruction: string,
  modelUuid: string,
  projectId: string,
) {
  const existing = await findAgentByName(name);
  if (existing) {
    console.log(`= agent "${name}" exists [${existing.uuid}] — updating instruction`);
    await client.agents.update(existing.uuid, { instruction, model_uuid: modelUuid });
    return existing.uuid as string;
  }
  const created: any = await client.agents.create({
    name,
    instruction,
    model_uuid: modelUuid,
    region: config.region,
    project_id: projectId,
  });
  const uuid = pickUuid(created)!;
  console.log(`+ created agent "${name}" [${uuid}]`);
  return uuid;
}

async function main() {
  const projectId = (await resolveProjectId()) ?? config.projectId;
  if (!projectId) {
    throw new Error(
      'Could not resolve DO project id. Set DO_PROJECT_ID in .env (DigitalOcean → Projects → copy id from URL).',
    );
  }
  console.log(`Using project ${projectId}, region ${config.region}`);

  const { modelUuid, embedUuid } = await pickModels();
  console.log(`Using model ${modelUuid}${embedUuid ? `, embedding ${embedUuid}` : ''}\n`);

  // --- A1.2 Food/CalFresh Knowledge Base + start indexing ---
  let kb = await findKbByName(RESOURCE_NAMES.foodKB);
  if (!kb) {
    const createdKb: any = await client.knowledgeBases.create({
      name: RESOURCE_NAMES.foodKB,
      region: config.region,
      project_id: projectId,
      embedding_model_uuid: embedUuid,
      datasources: [
        { web_crawler_data_source: { base_url: 'https://www.sfhsa.org/services/health-food/calfresh', crawling_option: 'DOMAIN' } },
        { web_crawler_data_source: { base_url: 'https://www.cdss.ca.gov/calfresh', crawling_option: 'DOMAIN' } },
      ] as any,
    });
    kb = createdKb?.knowledge_base ?? createdKb;
    console.log(`+ created KB "${RESOURCE_NAMES.foodKB}" [${kb.uuid}]`);
  } else {
    console.log(`= KB "${RESOURCE_NAMES.foodKB}" exists [${kb.uuid}]`);
  }
  state.foodKbUuid = kb.uuid;

  // Start indexing now so it finishes while the rest is built.
  try {
    const job: any = await client.knowledgeBases.indexingJobs.create({ knowledge_base_uuid: kb.uuid } as any);
    console.log(`  → indexing job started [${pickUuid(job) ?? 'ok'}]`);
  } catch (e: any) {
    console.warn(`  [warn] could not auto-start indexing (${e.message}); trigger it in the console: Gradient → Knowledge Bases → ${RESOURCE_NAMES.foodKB} → Index.`);
  }

  // --- A1.1 Intake agent ---
  state.intakeAgentUuid = await ensureAgent(RESOURCE_NAMES.intakeAgent, INTAKE_INSTRUCTION, modelUuid, projectId);

  // --- A1.3 Food domain agent (KB attached after create — KB DB may still be provisioning) ---
  state.foodAgentUuid = await ensureAgent(RESOURCE_NAMES.foodAgent, FOOD_INSTRUCTION, modelUuid, projectId);
  try {
    await client.agents.knowledgeBases.attachSingle(kb.uuid, { agent_uuid: state.foodAgentUuid });
    console.log('+ attached food KB to Food agent');
  } catch (e: any) {
    console.warn(
      `  [warn] could not attach KB yet (${e.message}); attach in console once indexing is ready: Agents → ${RESOURCE_NAMES.foodAgent} → Knowledge Bases.`,
    );
  }

  // --- A1.4 Function route: register /screen (via FaaS proxy) on the Food agent ---
  const faasNamespace = process.env.FAAS_NAMESPACE?.trim();
  const faasName = process.env.FAAS_NAME?.trim();
  if (faasNamespace && faasName) {
    try {
      await client.agents.functions.create(state.foodAgentUuid, {
        function_name: RESOURCE_NAMES.screenFunction,
        description: 'Deterministic CalFresh screen. Input: HouseholdProfile. Output: ScreeningResult[]. The ONLY source of eligibility outcomes and dollar amounts.',
        faas_namespace: faasNamespace,
        faas_name: faasName,
        input_schema: HouseholdProfileJsonSchema,
        output_schema: ScreeningResultArrayJsonSchema,
      });
      console.log(`+ registered function route "${RESOURCE_NAMES.screenFunction}" on Food agent`);
      state.functionRoute = `${faasNamespace}/${faasName}`;
    } catch (e: any) {
      console.warn(`  [warn] function route create failed: ${e.message}`);
    }
  } else {
    console.warn(
      `  [SKIP + FLAG] Function route not registered: set FAAS_NAMESPACE + FAAS_NAME to the deployed do-function/ proxy (see README-personA.md §Function route). The proxy forwards to SCREEN_URL=${config.screenUrl}.`,
    );
  }

  // --- A1.5 Router agent + route to Food ---
  state.routerAgentUuid = await ensureAgent(RESOURCE_NAMES.routerAgent, ROUTER_INSTRUCTION, modelUuid, projectId);
  try {
    await client.agents.routes.add(state.foodAgentUuid, {
      path_parent_agent_uuid: state.routerAgentUuid,
      body_parent_agent_uuid: state.routerAgentUuid,
      body_child_agent_uuid: state.foodAgentUuid,
      route_name: 'food_calfresh',
      if_case: 'the request is about food, groceries, nutrition, CalFresh, SNAP, food stamps, or is a general/ambiguous benefits question',
    });
    console.log('+ routed Router → Food agent');
  } catch (e: any) {
    console.warn(`  [warn] route add failed (may already exist): ${e.message}`);
  }

  // Capture intake + router deployment endpoints and API keys for verify scripts.
  for (const [label, uuidKey, endpointKey, secretKey, keyDisplayName] of [
    ['intake', 'intakeAgentUuid', 'intakeEndpoint', 'intakeAgentKey', 'bb-intake-key'],
    ['router', 'routerAgentUuid', 'routerEndpoint', 'routerAgentKey', 'bb-router-key'],
  ] as const) {
    const uuid = state[uuidKey];
    const agent: any = await client.agents.retrieve(uuid);
    state[endpointKey] = agent?.agent?.deployment?.url ?? agent?.deployment?.url ?? '';
    try {
      const key: any = await client.agents.apiKeys.create(uuid, { name: keyDisplayName } as any);
      state[secretKey] = key?.api_key_info?.secret_key ?? key?.secret_key ?? '';
    } catch (e: any) {
      console.warn(`  [warn] could not mint ${label} API key: ${e.message}`);
    }
  }

  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  console.log(`\nWrote ${STATE_PATH}`);
  console.log('\nGuardrails: attach in the console (see README-personA.md §Guardrails) — no SDK support in this alpha.');
}

main().catch((e) => {
  const detail = e?.error?.message ?? e?.message ?? String(e);
  console.error('\n[provision] ERROR:', detail);
  if (e?.error) console.error(JSON.stringify(e.error, null, 2));
  process.exit(1);
});
