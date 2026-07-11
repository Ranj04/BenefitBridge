// Phase A1 provisioning — idempotent: lists existing resources first and only
// creates what's missing (state reconciliation per standing rules).
// Creates: bb-intake, bb-food-calfresh (KB attached), bb-router (+ child route),
// starts KB indexing, ensures per-agent access keys, sets deployment visibility.
// Run: npm run provision   (reads DO_API_TOKEN from env; see .env.example)
//
// REST via native fetch (do-client.ts): the DoTs SDK covers these operations,
// but its kiota builders add serialization ceremony for zero benefit in a
// throwaway provisioning script; bodies below match the same OpenAPI spec
// DoTs is generated from. Listing (read path) uses DoTs in list-resources.ts.

import { writeFileSync } from 'node:fs';
import { doFetch } from './do-client.js';

const KB_UUID = '5fc08ddd-7ce2-11f1-aee4-4e013e2ddde4'; // bb-kb-food-calfresh (pre-existing)
const PROJECT_ID = 'e41d102e-74c5-43c2-a613-f4a8fb112750'; // from the KB (same project)
const REGION = 'tor1'; // same region as the KB, per plan (latency)
const EMBEDDING_MODEL_UUID = 'bb3ab4ee-d9b5-11f0-b074-4e013e2ddde4'; // from the existing KB
// GLM-5.2 — creating agents with agreement-gated models (Claude, Llama 3.3)
// returns 403 until the team accepts the license, which is CONSOLE-ONLY:
// Control Panel → Agent Platform → Agents → Create Agent → select the model
// → accept terms once. After that, swap MODEL_UUID (Claude Sonnet 4.6:
// c4811790-0c4e-11f1-b074-4e013e2ddde4) and re-run provisioning.
const MODEL_UUID = 'f90f901f-6e99-11f1-aee4-4e013e2ddde4';
const KB_SOURCES = [
  'https://www.sfhsa.org/services/health-food/calfresh',
  'https://www.cdss.ca.gov/calfresh',
];

const CONTRACT = `{
  householdSize: number|null; monthlyGrossIncome: number|null; earnedIncome: number|null;
  hasChildren: boolean|null; childrenAges: number[]|null; hasElderlyOrDisabled: boolean|null;
  isRenter: boolean|null; monthlyRent: number|null; monthlyUtilities: number|null;
  dependentCareCost: number|null; medicalExpenses: number|null;
  countyFips: string|null; immigrationStatus: 'citizen'|'lpr'|'other'|null; preferredLanguage: string;
}`;

const INTAKE_INSTRUCTION = `You are the intake extractor for BenefitBridge, a public-benefits screener.
Your ONLY job: convert the user's free-text description of their life situation (written in ANY language) into ONE strict JSON object with exactly these fields:
${CONTRACT}
Rules:
- Output ONLY the JSON object. No prose, no markdown fences, no explanations.
- Extract only what is stated. Every field not clearly stated must be null. NEVER infer, assume, or guess a value.
- householdSize: the number of people in the household when explicitly describable (e.g. "me and my two kids" = 3). Otherwise null.
- Normalize income to MONTHLY US dollars, rounded to the nearest dollar: "$650 a week" means 650 x 52 / 12 = 2817. "about $2,800 a month" means 2800. If a monthly figure cannot be determined from what is stated, use null.
- earnedIncome: the monthly portion that comes from work or wages. If all stated income is clearly wages, set earnedIncome equal to monthlyGrossIncome. If the earned/unearned split is unclear, use null.
- preferredLanguage: the two-letter code of the language the user wrote in ("en", "es", "zh", ...). This field is always set.
- countyFips: "06075" when San Francisco / SF is stated. Otherwise null.
- Booleans only when stated: "renting"/"my rent is..." makes isRenter true. Unknown means null.
- You never assert eligibility, never mention dollar benefits, never add fields.`;

const FOOD_INSTRUCTION = `You are the Food (CalFresh) domain agent for BenefitBridge, a public-benefits screener.
You receive a structured HouseholdProfile (JSON) together with a ScreeningResult (JSON) computed by the deterministic screening engine. The engine is the ONLY source of eligibility decisions and dollar amounts. (When your /screen function route is enabled, call it with the HouseholdProfile to obtain the ScreeningResult yourself.)
Your job: explain the ScreeningResult in warm, plain language at roughly an 8th-grade reading level, in the user's preferredLanguage.
Hard rules — never break these:
1. NEVER state or imply a guarantee. "Guaranteed", "you will receive", "you are entitled to" are forbidden. Use "estimated", "you may qualify", "based on what you told us".
2. Repeat ONLY numbers that appear in the ScreeningResult. Never compute, adjust, round differently, or invent any number, threshold, or dollar figure.
3. ALWAYS end with the ScreeningResult's disclaimer field, verbatim.
4. ALWAYS list the citations from the result (text and source_url) so the person can verify.
5. If screening is "need_more_info": say exactly what is missing and ask for it. Do not estimate anything.
6. For factual CalFresh questions, answer only from your attached knowledge base, with citations.
7. Do not repeat sensitive details (immigration status, exact income) back to the user unless they ask.`;

const ROUTER_INSTRUCTION = `You are the router for BenefitBridge, a public-benefits screener. Classify what the user needs and route to the correct domain agent.
Route to the "food" agent for anything about food assistance: CalFresh, SNAP, food stamps, EBT, groceries, feeding a family.
More domains are coming (health coverage, utility discounts, cash aid, tax credits); if the request doesn't match an available route, say which programs are coming soon and invite the user to describe any food needs.
You never answer eligibility questions, never mention dollar amounts, and never guess.`;

type Agent = { uuid: string; name: string; deployment?: { url?: string; status?: string; visibility?: string } };

async function listAgents(): Promise<Agent[]> {
  const r = await doFetch<{ agents?: Agent[] }>('/v2/gen-ai/agents?per_page=200');
  return r.data.agents ?? [];
}

async function ensureAgent(existing: Agent[], name: string, instruction: string, kbUuids?: string[]): Promise<Agent> {
  const found = existing.find((a) => a.name === name);
  if (found) {
    console.log(`= agent ${name} exists (${found.uuid}) — reusing`);
    return found;
  }
  const body: Record<string, unknown> = {
    name,
    instruction,
    model_uuid: MODEL_UUID,
    project_id: PROJECT_ID,
    region: REGION,
    tags: ['benefitbridge', 'p2'],
  };
  if (kbUuids) body.knowledge_base_uuid = kbUuids;
  const r = await doFetch<{ agent?: Agent }>('/v2/gen-ai/agents', { method: 'POST', body });
  if (r.status >= 300 || !r.data.agent) {
    throw new Error(`create agent ${name} → ${r.status}: ${JSON.stringify(r.data)}`);
  }
  console.log(`+ created agent ${name} (${r.data.agent.uuid})`);
  return r.data.agent;
}

async function ensureChildRoute(parent: Agent, child: Agent, routeName: string, ifCase: string) {
  const detail = await doFetch<{ agent?: { child_agents?: { uuid: string }[] } }>(`/v2/gen-ai/agents/${parent.uuid}`);
  const already = detail.data.agent?.child_agents?.some((c) => c.uuid === child.uuid);
  if (already) {
    console.log(`= route ${parent.name} → ${child.name} exists — reusing`);
    return;
  }
  const r = await doFetch(`/v2/gen-ai/agents/${parent.uuid}/child_agents/${child.uuid}`, {
    method: 'POST',
    body: {
      parent_agent_uuid: parent.uuid,
      child_agent_uuid: child.uuid,
      route_name: routeName,
      if_case: ifCase,
    },
  });
  if (r.status >= 300) throw new Error(`link ${routeName} → ${r.status}: ${JSON.stringify(r.data)}`);
  console.log(`+ routed ${parent.name} → ${child.name} (${routeName})`);
}

// Returns the KB uuid the food agent should use. Tries to index the existing
// KB; if its backing database is broken ("failed to get db creds"), creates a
// replacement KB with the same crawl sources and lets DO provision a fresh DB.
async function ensureIndexedKb(): Promise<string> {
  const jobs = await doFetch<{ jobs?: { uuid: string; status: string }[] }>(
    `/v2/gen-ai/knowledge_bases/${KB_UUID}/indexing_jobs`,
  );
  const active = (jobs.data.jobs ?? []).find((j) =>
    ['INDEX_JOB_STATUS_PENDING', 'INDEX_JOB_STATUS_IN_PROGRESS'].includes(j.status),
  );
  if (active) {
    console.log(`= indexing job already ${active.status} — reusing KB ${KB_UUID}`);
    return KB_UUID;
  }
  const r = await doFetch<{ job?: { uuid: string; status: string }; message?: string }>('/v2/gen-ai/indexing_jobs', {
    method: 'POST',
    body: { knowledge_base_uuid: KB_UUID, data_source_uuids: [] },
  });
  if (r.status < 300) {
    console.log(`+ indexing job started on existing KB: ${r.data.job?.uuid} (${r.data.job?.status})`);
    return KB_UUID;
  }
  console.warn(`! indexing existing KB failed (${r.status}: ${r.data.message}) — creating replacement KB`);

  const existing = await doFetch<{ knowledge_bases?: { uuid: string; name: string }[] }>(
    '/v2/gen-ai/knowledge_bases?per_page=200',
  );
  const v2 = (existing.data.knowledge_bases ?? []).find((kb) => kb.name === 'bb-kb-food-calfresh-v2');
  if (v2) {
    console.log(`= replacement KB exists (${v2.uuid}) — reusing`);
    return v2.uuid;
  }
  const created = await doFetch<{ knowledge_base?: { uuid: string } }>('/v2/gen-ai/knowledge_bases', {
    method: 'POST',
    body: {
      name: 'bb-kb-food-calfresh-v2',
      project_id: PROJECT_ID,
      region: REGION,
      embedding_model_uuid: EMBEDDING_MODEL_UUID,
      datasources: KB_SOURCES.map((base_url) => ({
        web_crawler_data_source: { base_url, crawling_option: 'SCOPED', embed_media: false },
      })),
    },
  });
  if (created.status >= 300 || !created.data.knowledge_base) {
    throw new Error(`create replacement KB → ${created.status}: ${JSON.stringify(created.data)}`);
  }
  const uuid = created.data.knowledge_base.uuid;
  console.log(`+ created replacement KB bb-kb-food-calfresh-v2 (${uuid})`);
  const job = await doFetch<{ job?: { uuid: string; status: string } }>('/v2/gen-ai/indexing_jobs', {
    method: 'POST',
    body: { knowledge_base_uuid: uuid, data_source_uuids: [] },
  });
  if (job.status < 300) console.log(`+ indexing started: ${job.data.job?.uuid} (${job.data.job?.status})`);
  else console.warn(`! indexing on new KB → ${job.status} (creation may auto-index; check status)`);
  return uuid;
}

async function ensureApiKey(agent: Agent): Promise<string | null> {
  const list = await doFetch<{ api_key_infos?: { name: string; secret_key?: string }[] }>(
    `/v2/gen-ai/agents/${agent.uuid}/api_keys`,
  );
  if ((list.data.api_key_infos ?? []).some((k) => k.name === 'bb-e2e')) {
    console.log(`= api key for ${agent.name} exists (secret only shown at creation — reuse yours from .env)`);
    return null;
  }
  const r = await doFetch<{ api_key_info?: { secret_key?: string } }>(`/v2/gen-ai/agents/${agent.uuid}/api_keys`, {
    method: 'POST',
    body: { agent_uuid: agent.uuid, name: 'bb-e2e' },
  });
  if (r.status >= 300) throw new Error(`api key ${agent.name} → ${r.status}: ${JSON.stringify(r.data)}`);
  console.log(`+ api key created for ${agent.name}`);
  return r.data.api_key_info?.secret_key ?? null;
}

async function setVisibility(agent: Agent) {
  if (agent.deployment?.visibility === 'VISIBILITY_PUBLIC') {
    console.log(`= ${agent.name} already VISIBILITY_PUBLIC`);
    return;
  }
  const r = await doFetch(`/v2/gen-ai/agents/${agent.uuid}/deployment_visibility`, {
    method: 'PUT',
    body: { uuid: agent.uuid, visibility: 'VISIBILITY_PUBLIC' },
  });
  if (r.status >= 300) console.warn(`! visibility ${agent.name} → ${r.status} (endpoint may still provision)`);
  else console.log(`+ ${agent.name} deployment set VISIBILITY_PUBLIC`);
}

async function main() {
  const kbUuid = await ensureIndexedKb();
  const existing = await listAgents();

  const intake = await ensureAgent(existing, 'bb-intake', INTAKE_INSTRUCTION);
  const food = await ensureAgent(existing, 'bb-food-calfresh', FOOD_INSTRUCTION, [kbUuid]);
  const router = await ensureAgent(existing, 'bb-router', ROUTER_INSTRUCTION);

  await ensureChildRoute(
    router,
    food,
    'food',
    'use this when the user needs food assistance: CalFresh, SNAP, food stamps, EBT, groceries, feeding their family',
  );

  const keys: Record<string, string> = {};
  for (const a of [intake, food, router]) {
    await setVisibility(a);
    const secret = await ensureApiKey(a);
    if (secret) keys[a.name] = secret;
  }

  // Re-read for deployment URLs (they provision asynchronously).
  const after = await listAgents();
  const out = Object.fromEntries(
    after
      .filter((a) => ['bb-intake', 'bb-food-calfresh', 'bb-router'].includes(a.name))
      .map((a) => [a.name, { uuid: a.uuid, endpoint: a.deployment?.url ?? null, status: a.deployment?.status ?? null }]),
  );
  writeFileSync(new URL('../resources.json', import.meta.url), JSON.stringify({ kb: kbUuid, agents: out }, null, 2));
  console.log('\nresources.json written:', JSON.stringify(out, null, 2));

  if (Object.keys(keys).length) {
    console.log('\nNEW AGENT ACCESS KEYS (add to gradient/.env — never commit):');
    for (const [name, secret] of Object.entries(keys)) {
      const envName = `AGENT_KEY_${name.replace('bb-', '').replace(/-/g, '_').toUpperCase()}`;
      console.log(`${envName}=${secret}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
