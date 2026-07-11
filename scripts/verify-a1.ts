/**
 * VERIFY GATE A1 (adversarial) — invokes the graph end-to-end.
 * 1) Intake golden cases (profile shape + unstated=null discipline).
 * 2) Orchestrated graph: intake → real /screen → Food explain (cited + disclaimed).
 * 3) Router handoff (best-effort; DO child-route may not return Food output via chat API).
 *
 * Reads .gradient-state.json (from provision). Requires DO_API_TOKEN + SCREEN_URL.
 * Run: npm run verify:a1
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { INTAKE_CASES, checkCase } from '../src/intake-cases.ts';
import { validateProfile } from '../src/validate.ts';
import { writeTrace } from '../src/trace.ts';
import { runGraph, invokeRouter, type GraphState } from '../src/run-graph.ts';
import { makeAgentClient } from '../src/gradient.ts';

const state = JSON.parse(readFileSync(fileURLToPath(new URL('../.gradient-state.json', import.meta.url)), 'utf8')) as GraphState;

async function runIntakeDirect(text: string): Promise<any> {
  const client = makeAgentClient(state.intakeEndpoint, state.intakeAgentKey);
  const res: any = await client.agents.chat.completions.create({
    messages: [{ role: 'user', content: text }],
    stream: false,
  } as any);
  const raw = res?.choices?.[0]?.message?.content ?? '';
  const match = raw.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : { _raw: raw };
}

function check(label: string, cond: boolean) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`);
  return cond;
}

async function main() {
  let ok = true;
  const intakeResults: Array<Record<string, unknown>> = [];

  for (const c of INTAKE_CASES) {
    const profile = await runIntakeDirect(c.text);
    console.log(`\nIntake [${c.name}]:`, JSON.stringify(profile));
    const shape = validateProfile(profile);
    ok = check(`[${c.name}] profile is contract-valid`, shape.ok) && ok;
    if (!shape.ok) console.log('   errors:', shape.errors.join('; '));
    const failures = checkCase(c, profile);
    ok = check(`[${c.name}] extraction matches expectations (incl. unstated=null)`, failures.length === 0) && ok;
    if (failures.length) failures.forEach((f) => console.log('   -', f));
    intakeResults.push({ case: c.name, input: c.text, profile, valid: shape.ok, validationErrors: shape.errors, expectationFailures: failures });
  }

  // Orchestrated e2e: intake → deterministic /screen → Food explain (real citations).
  const english = await runGraph(
    state,
    'single mom in SF, I earn about $2,800 a month at my job, one kid, rent is $1900',
  );
  console.log('\nGraph (english persona, real /screen):\n', english.explanation, '\n');
  ok = check('graph: disclaimer/estimate framing', /estimate|not a determination|confirm/i.test(english.explanation)) && ok;
  ok = check('graph: surfaces a citation URL from real screen', /https?:\/\//.test(english.explanation)) && ok;
  ok = check(
    'graph: real screen returned likely_qualify CalFresh with monthly benefit',
    english.results.some(
      (r) =>
        r.program === 'CalFresh' &&
        r.screening === 'likely_qualify' &&
        r.estimatedBenefit?.period === 'monthly',
    ),
  ) && ok;

  const missing = await runGraph(state, 'I have two kids and my rent is really high');
  console.log('\nGraph (missing income):\n', missing.explanation, '\n');
  ok = check('graph missing-income → asks / need_more_info, no fabricated $', /income|earn|how much|need more|more information/i.test(missing.explanation)) && ok;
  ok = check('graph missing-income: screening need_more_info from engine', missing.results.every((r) => r.screening === 'need_more_info')) && ok;

  // Router handoff — informational; child route may not bubble Food output through chat API.
  const routerOut = await invokeRouter(state, 'single mom in SF, about $2,800 a month, one kid, renting, rent 1900');
  console.log('\nRouter handoff (informational):\n', routerOut, '\n');
  const routerOk = /https?:\/\//.test(routerOut) && /estimate|not a determination|confirm/i.test(routerOut);
  check('router handoff (informational): cited + disclaimed', routerOk);

  const tracePath = writeTrace('a1', {
    gate: ok ? 'GREEN' : 'RED',
    intakeResults,
    graphEnglish: english,
    graphMissingIncome: missing,
    routerHandoff: routerOut,
  });
  console.log(`\nWrote A1 trace ${tracePath}.`);
  console.log(`\n${ok ? 'GATE A1: GREEN' : 'GATE A1: RED'}`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('[verify-a1] ERROR:', e.message ?? e);
  process.exit(1);
});
