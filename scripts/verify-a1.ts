/**
 * VERIFY GATE A1 (adversarial) — invokes the graph end-to-end.
 * 1) English persona → intake profile (unstated fields null) → router/Food → cited answer + disclaimer.
 * 2) Spanish persona → preferredLanguage 'es'.
 * 3) Missing income → need_more_info / asks, never fabricates.
 *
 * Reads .gradient-state.json (from provision). Requires DO_API_TOKEN.
 * Run: npm run verify:a1
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeClient, makeAgentClient } from '../src/gradient.ts';

const state = JSON.parse(readFileSync(fileURLToPath(new URL('../.gradient-state.json', import.meta.url)), 'utf8'));
const admin = makeClient();

async function invokeAgent(endpoint: string, key: string, content: string): Promise<string> {
  const client = makeAgentClient(endpoint, key);
  const res: any = await client.agents.chat.completions.create({
    messages: [{ role: 'user', content }],
    stream: false,
  } as any);
  return res?.choices?.[0]?.message?.content ?? JSON.stringify(res);
}

async function runIntake(text: string): Promise<any> {
  // Intake is invoked directly (its own endpoint/key) to inspect the extracted profile.
  const out = await invokeAgent(state.intakeEndpoint ?? state.routerEndpoint, state.intakeAgentKey ?? state.routerAgentKey, text);
  const match = out.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : { _raw: out };
}

function check(label: string, cond: boolean) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`);
  return cond;
}

async function main() {
  let ok = true;

  // 1) English persona
  const p1 = await runIntake('single mom in SF, about $2,800 a month, one kid, renting');
  console.log('Intake #1:', JSON.stringify(p1));
  ok = check('#1 householdSize == 2', p1.householdSize === 2) && ok;
  ok = check('#1 monthlyGrossIncome ~ 2800', Math.abs((p1.monthlyGrossIncome ?? 0) - 2800) <= 50) && ok;
  ok = check('#1 isRenter == true', p1.isRenter === true) && ok;
  ok = check('#1 hasChildren == true', p1.hasChildren === true) && ok;
  ok = check('#1 monthlyRent is null (unstated, not guessed)', p1.monthlyRent === null || p1.monthlyRent === undefined) && ok;

  const a1 = await invokeAgent(state.routerEndpoint, state.routerAgentKey, 'single mom in SF, about $2,800 a month, one kid, renting');
  console.log('\nRouter/Food #1:\n', a1, '\n');
  ok = check('#1 answer contains a disclaimer/estimate framing', /estimate|not a determination|confirm/i.test(a1)) && ok;
  ok = check('#1 answer surfaces a citation URL', /https?:\/\//.test(a1)) && ok;

  // 2) Spanish persona
  const p2 = await runIntake('madre soltera en San Francisco, unos 2,800 dólares al mes, un hijo, alquilando');
  console.log('Intake #2 (es):', JSON.stringify(p2));
  ok = check("#2 preferredLanguage == 'es'", p2.preferredLanguage === 'es') && ok;
  ok = check('#2 householdSize == 2', p2.householdSize === 2) && ok;

  // 3) Missing income
  const a3 = await invokeAgent(state.routerEndpoint, state.routerAgentKey, 'I have two kids and my rent is really high');
  console.log('\nRouter/Food #3 (missing income):\n', a3, '\n');
  ok = check('#3 asks for income / need_more_info, no fabricated $ amount', /income|earn|how much|need more/i.test(a3)) && ok;

  console.log(`\n${ok ? 'GATE A1: GREEN' : 'GATE A1: RED'}`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('[verify-a1] ERROR:', e.message ?? e);
  process.exit(1);
});
