// Gate A1 E2E orchestrator: free text → intake agent → HouseholdProfile →
// /screen (SCREEN_URL; the local mock until Person B deploys) → food agent
// explanation → deterministic no-guarantee guard. Also pings the router to
// prove the food child-route resolves.
//
// NOTE on the function route (Task A1.4): DO Gradient function routes attach
// only to DigitalOcean Functions (faas_name/faas_namespace) — there is no
// arbitrary-URL option, and a cloud faas cannot reach a localhost mock. The
// /screen call therefore runs here in the orchestrator (identical mapping);
// register-screen-route.ts performs the faas registration once Person B's
// public SCREEN_URL + a Functions proxy exist.
//
// Usage: tsx src/run-graph.ts "single mom in SF, about $2,800 a month, one kid, renting"

import { writeFileSync, mkdirSync } from 'node:fs';
import type { HouseholdProfile, ScreeningResult } from './contracts.js';
import { chat, loadResources, agentKey, parseJsonObject } from './agent-client.js';
import { enforceNoGuarantee } from './guard.js';

type NullableProfile = { [K in keyof HouseholdProfile]: HouseholdProfile[K] | null };

const freeText = process.argv.slice(2).join(' ').trim();
if (!freeText) {
  console.error('usage: tsx src/run-graph.ts "<free text describing a household>"');
  process.exit(1);
}

const SCREEN_URL = process.env.SCREEN_URL ?? 'http://localhost:8787/screen';
const res = loadResources();
const intake = res.agents['bb-intake'];
const food = res.agents['bb-food-calfresh'];
const router = res.agents['bb-router'];

async function callScreen(profile: HouseholdProfile): Promise<ScreeningResult[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const r = await fetch(SCREEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
      signal: controller.signal,
    });
    if (!r.ok) throw new Error(`/screen → ${r.status}: ${(await r.text()).slice(0, 300)}`);
    return (await r.json()) as ScreeningResult[];
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const trace: Record<string, unknown> = { input: freeText, screen_url: SCREEN_URL };

  // 1. Intake: free text → profile (missing → null, never guessed)
  const intakeRaw = await chat(intake.endpoint!, agentKey('AGENT_KEY_INTAKE'), freeText);
  const profile = parseJsonObject<NullableProfile>(intakeRaw);
  trace.profile = profile;
  console.log('— intake profile —\n' + JSON.stringify(profile, null, 2));

  // 2. Router sanity ping (server-side child routing to the food agent)
  const routerReply = await chat(router.endpoint!, agentKey('AGENT_KEY_ROUTER'), freeText, 120_000);
  trace.router_reply = routerReply;
  console.log('\n— router reply (child route) —\n' + routerReply.slice(0, 400));

  // 3. Screening needs real income + household size — no fabrication, ever.
  const missing: string[] = [];
  if (profile.householdSize == null) missing.push('householdSize');
  if (profile.monthlyGrossIncome == null) missing.push('monthlyGrossIncome');
  if (missing.length) {
    trace.outcome = { screening: 'need_more_info', missing };
    console.log(`\n— outcome — need_more_info (missing: ${missing.join(', ')}) — no number invented`);
    save(trace);
    return;
  }

  // Coercions for contract-required fields, each surfaced as an assumption.
  const assumptions: string[] = [];
  const coerce = <T>(v: T | null, fallback: T, note: string): T => {
    if (v != null) return v;
    assumptions.push(note);
    return fallback;
  };
  const full: HouseholdProfile = {
    householdSize: profile.householdSize,
    monthlyGrossIncome: profile.monthlyGrossIncome,
    earnedIncome: coerce(profile.earnedIncome, profile.monthlyGrossIncome, 'assumed all income is earned (wages) — confirm'),
    hasChildren: coerce(profile.hasChildren, false, 'assumed no children (not stated)'),
    ...(profile.childrenAges ? { childrenAges: profile.childrenAges } : {}),
    hasElderlyOrDisabled: coerce(profile.hasElderlyOrDisabled, false, 'assumed no elderly/disabled member (not stated)'),
    isRenter: coerce(profile.isRenter, false, 'assumed not renting (not stated)'),
    ...(profile.monthlyRent != null ? { monthlyRent: profile.monthlyRent } : {}),
    ...(profile.monthlyUtilities != null ? { monthlyUtilities: profile.monthlyUtilities } : {}),
    countyFips: coerce(profile.countyFips, '06075', 'assumed San Francisco county — confirm'),
    preferredLanguage: profile.preferredLanguage ?? 'en',
  };
  trace.coercion_assumptions = assumptions;

  // 4. Deterministic screen (mock or live engine — same contract)
  const screening = await callScreen(full);
  trace.screening = screening;
  console.log('\n— /screen result —\n' + JSON.stringify(screening.map((s) => ({ program: s.program, screening: s.screening, estimate: s.estimatedBenefit })), null, 2));

  // 5. Food agent explains; guard enforces estimate language + disclaimer
  const foodPrompt = `HouseholdProfile:\n${JSON.stringify(full)}\n\nScreeningResult (from the deterministic engine):\n${JSON.stringify(screening[0])}\n\nExplain this result to the user in their preferred language (${full.preferredLanguage}).`;
  const foodRaw = await chat(food.endpoint!, agentKey('AGENT_KEY_FOOD_CALFRESH'), foodPrompt, 120_000);
  const guarded = enforceNoGuarantee(foodRaw, screening[0].disclaimer);
  trace.food_raw = foodRaw;
  trace.final = guarded;
  console.log(`\n— final answer (guard: rewritten=${guarded.rewritten}, disclaimerAppended=${guarded.disclaimerAppended}) —\n${guarded.text}`);
  save(trace);
}

function save(trace: Record<string, unknown>) {
  mkdirSync(new URL('../traces/', import.meta.url), { recursive: true });
  const file = new URL(`../traces/run-${Date.now()}.json`, import.meta.url);
  writeFileSync(file, JSON.stringify(trace, null, 2));
  console.log(`\ntrace saved: ${file.pathname}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
