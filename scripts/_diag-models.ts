/** TEMP diagnostic — switch Food agent to GPT-5.2 to test function-route execution. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeClient } from '../src/gradient.ts';

const state = JSON.parse(readFileSync(fileURLToPath(new URL('../.gradient-state.json', import.meta.url)), 'utf8'));

async function main() {
  const client = makeClient();
  const res: any = await client.models.list();
  const models: any[] = res?.models ?? [];
  const gpt = models.find((m) => /^OpenAI GPT-5\.2$/i.test(m.name));
  if (!gpt) throw new Error('GPT-5.2 not found');
  console.log(`Switching Food agent ${state.foodAgentUuid} → ${gpt.name} [${gpt.uuid}]`);
  await client.agents.update(state.foodAgentUuid, { model_uuid: gpt.uuid });
  console.log('Updated. Waiting 20s for deployment...');
  await new Promise((r) => setTimeout(r, 20000));
  console.log('done');
}
main().catch((e) => console.error('[diag] fatal', e?.error?.message ?? e?.message ?? e));
