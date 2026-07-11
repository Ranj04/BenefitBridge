/**
 * Task A0.1 — state reconciliation. Authenticates and lists existing Gradient
 * resources (agents, knowledge bases, models) so provisioning never duplicates.
 * Run: npm run resources:list   (requires DO_API_TOKEN)
 */
import { makeClient } from '../src/gradient.ts';

async function main() {
  const client = makeClient();

  console.log('# Authenticating against DigitalOcean Gradient…\n');

  const agents = await client.agents.list().catch((e) => {
    throw new Error(`agents.list failed — check DO_API_TOKEN has GenAI scope. (${e})`);
  });
  const kbs = await client.knowledgeBases.list().catch(() => null);
  const models = await client.models.list().catch(() => null);

  const agentList = (agents as any)?.agents ?? [];
  console.log(`## Agents (${agentList.length})`);
  for (const a of agentList) {
    console.log(`- ${a.name}  [${a.uuid}]  model=${a.model?.name ?? '?'}  deployment=${a.deployment?.url ?? a.deployment?.status ?? '—'}`);
  }

  const kbList = (kbs as any)?.knowledge_bases ?? [];
  console.log(`\n## Knowledge bases (${kbList.length})`);
  for (const k of kbList) {
    console.log(`- ${k.name}  [${k.uuid}]  region=${k.region ?? '?'}`);
  }

  const modelList = (models as any)?.models ?? [];
  console.log(`\n## Models (${modelList.length}) — for picking agent + embedding model UUIDs`);
  for (const m of modelList) {
    const kind = m.is_foundational ? 'foundation' : (m.usecases?.join(',') ?? '');
    console.log(`- ${m.name}  [${m.uuid}]  ${kind}`);
  }
}

main().catch((e) => {
  console.error('\n[list-resources] ERROR:', e.message ?? e);
  process.exit(1);
});
