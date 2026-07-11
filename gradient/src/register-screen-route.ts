// Task A1.4 — register /screen as a function route on the food agent.
//
// CONSTRAINT (discovered from the DO OpenAPI spec via DoTs): Gradient function
// routes attach only to DigitalOcean Functions — the API takes faas_name +
// faas_namespace; there is no arbitrary-URL option. Wiring the live route
// therefore needs, once Person B's public SCREEN_URL exists:
//   1. A Functions namespace:  doctl serverless namespaces create --label bb --region tor1
//   2. A thin proxy function (packages/screen-proxy) that forwards its args as
//      POST SCREEN_URL and returns the ScreeningResult[] JSON.
//      Deploy: doctl serverless deploy packages/screen-proxy
//   3. Run this script with FAAS_NAMESPACE + FAAS_NAME set.
// Until then the orchestrator (run-graph.ts) performs the identical
// profile → /screen mapping locally against the mock.
//
// Usage: FAAS_NAMESPACE=fn-... FAAS_NAME=bb/screen-proxy tsx src/register-screen-route.ts

import { doFetch } from './do-client.js';
import { loadResources } from './agent-client.js';

const ns = process.env.FAAS_NAMESPACE;
const fn = process.env.FAAS_NAME;
if (!ns || !fn) {
  console.error('FAAS_NAMESPACE and FAAS_NAME must be set (see header comment for the doctl steps).');
  process.exit(1);
}

const res = loadResources();
const food = res.agents['bb-food-calfresh'];

const inputSchema = {
  parameters: [
    { name: 'householdSize', in_: 'query', schema: { type: 'number' }, required: true, description: 'People in the household' },
    { name: 'monthlyGrossIncome', in_: 'query', schema: { type: 'number' }, required: true, description: 'Monthly gross income, USD' },
    { name: 'earnedIncome', in_: 'query', schema: { type: 'number' }, required: true, description: 'Monthly earned (wage) income, USD' },
    { name: 'hasChildren', in_: 'query', schema: { type: 'boolean' }, required: true, description: 'Any children in the household' },
    { name: 'hasElderlyOrDisabled', in_: 'query', schema: { type: 'boolean' }, required: true, description: 'Any elderly (60+) or disabled member' },
    { name: 'isRenter', in_: 'query', schema: { type: 'boolean' }, required: true, description: 'Household rents its home' },
    { name: 'monthlyRent', in_: 'query', schema: { type: 'number' }, required: false, description: 'Monthly rent, USD' },
    { name: 'monthlyUtilities', in_: 'query', schema: { type: 'number' }, required: false, description: 'Monthly utilities, USD' },
    { name: 'countyFips', in_: 'query', schema: { type: 'string' }, required: true, description: 'County FIPS, 06075 = San Francisco' },
    { name: 'preferredLanguage', in_: 'query', schema: { type: 'string' }, required: true, description: 'Two-letter language code' },
  ],
};

async function main() {
  const r = await doFetch<{ agent?: unknown }>(`/v2/gen-ai/agents/${food.uuid}/functions`, {
    method: 'POST',
    body: {
      agent_uuid: food.uuid,
      function_name: 'screen_household',
      description:
        'Deterministic benefits screening. Send the extracted HouseholdProfile; returns ScreeningResult[] with eligibility screening, estimated benefit, computation cascade, citations and disclaimer. The ONLY source of eligibility outcomes and dollar amounts.',
      faas_namespace: ns,
      faas_name: fn,
      input_schema: inputSchema,
    },
  });
  if (r.status >= 300) throw new Error(`register function route → ${r.status}: ${JSON.stringify(r.data)}`);
  console.log('function route screen_household registered on bb-food-calfresh');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
