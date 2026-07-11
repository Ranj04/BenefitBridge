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
import { validateProfile } from './validate.ts';
import { enforceNoGuarantee } from './guard.ts';

export type NullableProfile = { [K in keyof HouseholdProfile]: HouseholdProfile[K] | null };

export type ChatResponse = {
  profile: NullableProfile | null;
  results: ScreeningResult[] | null;
  explanation: string | null;
  guard: { rewritten: boolean; disclaimerAppended: boolean } | null;
  needMoreInfo: string[] | null;
  agentLayer: 'live' | 'unconfigured';
};

const TIMEOUT_MS = 90_000;

async function chatCompletion(baseUrl: string, key: string, content: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
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
  if (!AGENT_INTAKE_URL || !AGENT_INTAKE_KEY) return null;
  return {
    intake: { url: AGENT_INTAKE_URL, key: AGENT_INTAKE_KEY },
    food: AGENT_FOOD_URL && AGENT_FOOD_KEY ? { url: AGENT_FOOD_URL, key: AGENT_FOOD_KEY } : null,
  };
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

  const intakeRaw = await chatCompletion(cfg.intake.url, cfg.intake.key, freeText);
  const parsed = parseProfileJson(intakeRaw);
  const v = validateProfile(parsed);
  if (!v.ok) throw new Error(`intake produced an invalid profile: ${v.errors.join('; ')}`);

  const completed = completeProfile(parsed);
  if ('missing' in completed) {
    return { profile: parsed, results: null, explanation: null, guard: null, needMoreInfo: completed.missing, agentLayer: 'live' };
  }

  const results = await screenAll(completed.profile);
  for (const r of results) r.assumptions.unshift(...completed.assumptions);

  let explanation: string | null = null;
  let guard: ChatResponse['guard'] = null;
  if (cfg.food) {
    const calfresh = results.find((r) => r.program === 'CalFresh') ?? results[0];
    const prompt = `HouseholdProfile:\n${JSON.stringify(completed.profile)}\n\nScreeningResult (from the deterministic engine):\n${JSON.stringify(calfresh)}\n\nExplain this result to the user in their preferred language (${completed.profile.preferredLanguage}).`;
    const raw = await chatCompletion(cfg.food.url, cfg.food.key, prompt);
    const guarded = enforceNoGuarantee(raw, calfresh.disclaimer);
    explanation = guarded.text;
    guard = { rewritten: guarded.rewritten, disclaimerAppended: guarded.disclaimerAppended };
  }

  return { profile: parsed, results, explanation, guard, needMoreInfo: null, agentLayer: 'live' };
}
