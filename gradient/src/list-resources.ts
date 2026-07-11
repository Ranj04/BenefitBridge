// Task A0.1 — auth check + state reconciliation via the official DoTs SDK.
// Lists existing Gradient (GenAI) agents and knowledge bases so provisioning
// never creates duplicates. Run: DO_API_TOKEN=... npm run list

import { FetchRequestAdapter } from '@microsoft/kiota-http-fetchlibrary';
import {
  createDigitalOceanClient,
  DigitalOceanApiKeyAuthenticationProvider,
} from '@digitalocean/dots';
import { requireToken } from './do-client.js';

async function main() {
  const token = requireToken();
  const adapter = new FetchRequestAdapter(new DigitalOceanApiKeyAuthenticationProvider(token));
  const client = createDigitalOceanClient(adapter);

  const agents = await client.v2.genAi.agents.get();
  console.log('== Existing Gradient agents ==');
  for (const a of agents?.agents ?? []) {
    console.log(`- ${a.name}  (${a.uuid})${a.deployment?.url ? `  ${a.deployment.url}` : ''}`);
  }
  if (!agents?.agents?.length) console.log('(none)');

  const kbs = await client.v2.genAi.knowledge_bases.get();
  console.log('\n== Existing knowledge bases ==');
  for (const kb of kbs?.knowledgeBases ?? []) {
    console.log(
      `- ${kb.name}  (${kb.uuid})  indexing: ${kb.lastIndexingJob?.status ?? 'unknown'}`,
    );
  }
  if (!kbs?.knowledgeBases?.length) console.log('(none)');

  console.log('\nAuth OK.');
}

main().catch((err) => {
  console.error('Auth/list failed:', err?.message ?? err);
  process.exit(1);
});
