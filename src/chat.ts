/**
 * POST /chat orchestration: free text → intake agent → deterministic /screen
 * → food-agent explanation → code-level no-guarantee guard. The browser never
 * sees agent keys; they live in server env:
 *   AGENT_INTAKE_URL / AGENT_INTAKE_KEY — intake agent (endpoint base URL)
 *   AGENT_FOOD_URL   / AGENT_FOOD_KEY   — food/router agent for explanations
 * Swap to the canonical agents (CANONICAL.md) by changing env only.
 * The model does language; every number in the response comes from screenAll.
 */
import type { HouseholdProfile, ScreeningResult } from './contracts.ts';
import { existsSync, readFileSync } from 'node:fs';
import { validateProfile } from './validate.ts';
import { enforceNoGuarantee } from './guard.ts';
import { extractProfileFromText, mergeProfiles } from './text-profile.ts';

export type NullableProfile = { [K in keyof HouseholdProfile]: HouseholdProfile[K] | null };

export type ChatResponse = {
  profile: NullableProfile | null;
  results: ScreeningResult[] | null;
  explanation: string | null;
  guard: { rewritten: boolean; disclaimerAppended: boolean } | null;
  needMoreInfo: string[] | null;
  agentLayer: 'live' | 'unconfigured';
};

// Bound each agent call so the two sequential calls stay well under the DO App
// Platform gateway request timeout (~60s) — otherwise a slow agent turns into a
// 504 HTML page at the gateway before Fastify can reply. Intake is load-bearing
// (no profile without it); the food-agent EXPLANATION is optional prose over
// numbers the deterministic engine already produced, so it gets a tight budget
// and degrades to a templated explanation on timeout.
const INTAKE_TIMEOUT_MS = 30_000;
const FOOD_TIMEOUT_MS = 15_000;

async function chatCompletion(baseUrl: string, key: string, content: string, timeoutMs: number): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/v1/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content }], stream: false }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`agent ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('agent returned no content');
    return text;
  } finally {
    clearTimeout(timer);
  }
}

export function parseProfileJson(raw: string): NullableProfile {
  const cleaned = raw.replace(/```(?:json)?/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('no JSON object in intake output');
  return JSON.parse(cleaned.slice(start, end + 1)) as NullableProfile;
}

export function agentConfig() {
  const { AGENT_INTAKE_URL, AGENT_INTAKE_KEY, AGENT_FOOD_URL, AGENT_FOOD_KEY } = process.env;
  if (AGENT_INTAKE_URL && AGENT_INTAKE_KEY) {
    return {
      intake: { url: AGENT_INTAKE_URL, key: AGENT_INTAKE_KEY },
      food: AGENT_FOOD_URL && AGENT_FOOD_KEY ? { url: AGENT_FOOD_URL, key: AGENT_FOOD_KEY } : null,
    };
  }

  // Local provisioning writes this gitignored, server-side-only state file.
  // Production and tests require explicit env vars; they never read local keys.
  if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test') return null;
  const statePath = new URL('../.gradient-state.json', import.meta.url);
  if (!existsSync(statePath)) return null;
  try {
    const state = JSON.parse(readFileSync(statePath, 'utf8')) as {
      intakeEndpoint?: string;
      intakeAgentKey?: string;
      foodEndpoint?: string;
      foodAgentKey?: string;
    };
    if (!state.intakeEndpoint || !state.intakeAgentKey) return null;
    return {
      intake: { url: state.intakeEndpoint, key: state.intakeAgentKey },
      food: state.foodEndpoint && state.foodAgentKey ? { url: state.foodEndpoint, key: state.foodAgentKey } : null,
    };
  } catch {
    return null;
  }
}

/** Coercions mirror gradient run-graph: each one is surfaced as an assumption. */
export function completeProfile(p: NullableProfile): { profile: HouseholdProfile; assumptions: string[] } | { missing: string[] } {
  const missing: string[] = [];
  if (p.householdSize == null) missing.push('householdSize');
  if (p.monthlyGrossIncome == null) missing.push('monthlyGrossIncome');
  if (missing.length) return { missing };
  const assumptions: string[] = [];
  const coerce = <T>(v: T | null | undefined, fallback: T, note: string): T => {
    if (v != null) return v;
    assumptions.push(note);
    return fallback;
  };
  return {
    assumptions,
    profile: {
      householdSize: p.householdSize!,
      monthlyGrossIncome: p.monthlyGrossIncome!,
      earnedIncome: coerce(p.earnedIncome, p.monthlyGrossIncome!, 'assumed all income is earned (wages) — confirm'),
      hasChildren: coerce(p.hasChildren, false, 'assumed no children (not stated)'),
      ...(p.childrenAges ? { childrenAges: p.childrenAges } : {}),
      hasElderlyOrDisabled: coerce(p.hasElderlyOrDisabled, false, 'assumed no elderly/disabled member (not stated)'),
      isRenter: coerce(p.isRenter, false, 'assumed not renting (not stated)'),
      ...(p.monthlyRent != null ? { monthlyRent: p.monthlyRent } : {}),
      ...(p.monthlyUtilities != null ? { monthlyUtilities: p.monthlyUtilities } : {}),
      ...(p.dependentCareCost != null ? { dependentCareCost: p.dependentCareCost } : {}),
      ...(p.medicalExpenses != null ? { medicalExpenses: p.medicalExpenses } : {}),
      countyFips: coerce(p.countyFips, '06075', 'assumed San Francisco county — confirm'),
      preferredLanguage: p.preferredLanguage ?? 'en',
    },
  };
}

export async function runChat(
  freeText: string,
  screenAll: (p: HouseholdProfile) => Promise<ScreeningResult[]>,
): Promise<ChatResponse> {
  const cfg = agentConfig();
  if (!cfg) {
    return { profile: null, results: null, explanation: null, guard: null, needMoreInfo: null, agentLayer: 'unconfigured' };
  }

  // Deterministic read of the raw text, always. The agent is the primary
  // extractor, but it can return prose, drop a field, or time out — and when it
  // does we must not turn around and ask the user for something they already
  // told us ("3k month", "only me in th house"). This is the floor under it.
  const local = extractProfileFromText(freeText);

  let fromAgent: NullableProfile | null = null;
  try {
    const candidate = parseProfileJson(await chatCompletion(cfg.intake.url, cfg.intake.key, freeText, INTAKE_TIMEOUT_MS));
    if (validateProfile(candidate).ok) fromAgent = candidate;
  } catch {
    fromAgent = null; // non-JSON, refusal, timeout, or a 5xx from the agent
  }

  // Agent values win where present; the local read fills only the holes.
  const { profile: parsed, assumptions: readBacks } = mergeProfiles(fromAgent, local);

  const completed = completeProfile(parsed);
  if ('missing' in completed) {
    return { profile: parsed, results: null, explanation: null, guard: null, needMoreInfo: completed.missing, agentLayer: 'live' };
  }

  const results = await screenAll(completed.profile);
  for (const r of results) r.assumptions.unshift(...readBacks, ...completed.assumptions);

  const calfresh = results.find((r) => r.program === 'CalFresh') ?? results[0];
  let explanation: string | null = null;
  let guard: ChatResponse['guard'] = null;
  if (cfg.food) {
    const prompt = `HouseholdProfile:\n${JSON.stringify(completed.profile)}\n\nScreeningResult (from the deterministic engine):\n${JSON.stringify(calfresh)}\n\nExplain this result to the user in their preferred language (${completed.profile.preferredLanguage}).`;
    try {
      // Best-effort prose: on timeout/error we still return the real numbers with
      // a deterministic explanation, so /chat never hangs into a gateway 504.
      const raw = await chatCompletion(cfg.food.url, cfg.food.key, prompt, FOOD_TIMEOUT_MS);
      const guarded = enforceNoGuarantee(raw, calfresh.disclaimer);
      explanation = guarded.text;
      guard = { rewritten: guarded.rewritten, disclaimerAppended: guarded.disclaimerAppended };
    } catch {
      explanation = deterministicExplanation(results, calfresh.disclaimer);
    }
  } else {
    explanation = deterministicExplanation(results, calfresh.disclaimer);
  }

  return { profile: parsed, results, explanation, guard, needMoreInfo: null, agentLayer: 'live' };
}

/**
 * Fallback explanation built purely from the deterministic results — used when
 * the food agent is unconfigured or too slow. Numbers only ever come from the
 * engine; this just narrates them. Still labeled as an estimate.
 */
export function deterministicExplanation(results: ScreeningResult[], disclaimer: string): string {
  const money = (b: ScreeningResult['estimatedBenefit']): string => {
    if (!b) return '';
    const amt = typeof b.amount === 'number' ? `$${b.amount}` : `$${b.amount.low}–$${b.amount.high}`;
    return ` (est. ${amt}/${b.period === 'annual' ? 'year' : b.period === 'one_time' ? 'one-time' : 'month'})`;
  };
  const lines = results.map((r) => {
    const label =
      r.screening === 'likely_qualify' ? 'likely qualifies' : r.screening === 'unlikely' ? 'unlikely to qualify' : 'needs more info';
    return `• ${r.program}: ${label}${money(r.estimatedBenefit)}`;
  });
  return `Here's what your answers suggest:\n${lines.join('\n')}\n\n${disclaimer}`;
}
