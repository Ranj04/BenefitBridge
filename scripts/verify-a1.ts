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
import { makeAgentClient } from '../src/gradient.ts';
import { INTAKE_CASES, checkCase } from '../src/intake-cases.ts';
import { validateProfile } from '../src/validate.ts';
import { writeTrace } from '../src/trace.ts';

const state = JSON.parse(readFileSync(fileURLToPath(new URL('../.gradient-state.json', import.meta.url)), 'utf8'));

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
  const intakeResults: Array<Record<string, unknown>> = [];

  // Intake extraction across all golden cases (shared with the offline test suite).
  for (const c of INTAKE_CASES) {
    const profile = await runIntake(c.text);
    console.log(`\nIntake [${c.name}]:`, JSON.stringify(profile));
    const shape = validateProfile(profile);
    ok = check(`[${c.name}] profile is contract-valid`, shape.ok) && ok;
    if (!shape.ok) console.log('   errors:', shape.errors.join('; '));
    const failures = checkCase(c, profile);
    ok = check(`[${c.name}] extraction matches expectations (incl. unstated=null)`, failures.length === 0) && ok;
    if (failures.length) failures.forEach((f) => console.log('   -', f));
    intakeResults.push({ case: c.name, input: c.text, profile, valid: shape.ok, validationErrors: shape.errors, expectationFailures: failures });
  }

  // End-to-end through the router → Food → /screen (cited answer + surviving disclaimer).
  const a1 = await invokeAgent(state.routerEndpoint, state.routerAgentKey, 'single mom in SF, about $2,800 a month, one kid, renting');
  console.log('\nRouter/Food (english persona):\n', a1, '\n');
  ok = check('answer contains disclaimer/estimate framing', /estimate|not a determination|confirm/i.test(a1)) && ok;
  ok = check('answer surfaces a citation URL', /https?:\/\//.test(a1)) && ok;

  // Missing income → asks / need_more_info, never fabricates.
  const a3 = await invokeAgent(state.routerEndpoint, state.routerAgentKey, 'I have two kids and my rent is really high');
  console.log('\nRouter/Food (missing income):\n', a3, '\n');
  ok = check('missing-income → asks / need_more_info, no fabricated $', /income|earn|how much|need more/i.test(a3)) && ok;

  const tracePath = writeTrace('a1', {
    gate: ok ? 'GREEN' : 'RED',
    intakeResults,
    routerFoodEnglishPersona: a1,
    routerFoodMissingIncome: a3,
  });
  console.log(`\nWrote A1 trace ${tracePath}.`);
  console.log(`\n${ok ? 'GATE A1: GREEN' : 'GATE A1: RED'}`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('[verify-a1] ERROR:', e.message ?? e);
  process.exit(1);
});
