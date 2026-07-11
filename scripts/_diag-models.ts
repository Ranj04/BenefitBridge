/** TEMP diagnostic — inspect the Food agent's registered functions + deployment. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeClient } from '../src/gradient.ts';

const state = JSON.parse(readFileSync(fileURLToPath(new URL('../.gradient-state.json', import.meta.url)), 'utf8'));

async function main() {
  const client = makeClient();
  const a: any = await client.agents.retrieve(state.foodAgentUuid);
  const agent = a?.agent ?? a;
  console.log('model:', agent?.model?.name);
  console.log('deployment status:', agent?.deployment?.status ?? agent?.deployment?.visibility);
  const fns = agent?.functions ?? [];
  console.log('functions count:', fns.length);
  console.log(JSON.stringify(fns, null, 2).slice(0, 2500));
  const kbs = agent?.knowledge_bases ?? [];
  console.log('KBs:', kbs.map((k: any) => k.name ?? k.uuid));
}
main().catch((e) => console.error('[diag] fatal', e?.error?.message ?? e?.message ?? e));
