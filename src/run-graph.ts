/**
 * Orchestrated graph runner — intake (LLM) → /screen (code) → Food explain (LLM).
 * The deterministic screen always runs in our code, never through the model.
 * The Food agent's registered screen_calfresh function route remains on DO for
 * the Gradient surface; this path guarantees Gate A3 uses real engine output
 * when the agent runtime does not auto-invoke tools via the chat API.
 */
import type { HouseholdProfile, ScreeningResult } from './contracts.ts';
import { config } from './config.ts';
import { makeAgentClient } from './gradient.ts';
import { validateProfile } from './validate.ts';

export type GraphState = {
  intakeEndpoint: string;
  intakeAgentKey: string;
  foodEndpoint: string;
  foodAgentKey: string;
  routerEndpoint?: string;
  routerAgentKey?: string;
};

async function invokeAgent(endpoint: string, key: string, content: string): Promise<string> {
  const client = makeAgentClient(endpoint, key);
  const res: any = await client.agents.chat.completions.create({
    messages: [{ role: 'user', content }],
    stream: false,
  } as any);
  return res?.choices?.[0]?.message?.content ?? '';
}

export async function runIntake(state: GraphState, text: string): Promise<HouseholdProfile> {
  const out = await invokeAgent(state.intakeEndpoint, state.intakeAgentKey, text);
  const match = out.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Intake did not return JSON: ${out.slice(0, 200)}`);
  const profile = JSON.parse(match[0]) as HouseholdProfile;
  const shape = validateProfile(profile);
  if (!shape.ok) throw new Error(`Invalid profile: ${shape.errors.join('; ')}`);
  return profile;
}

export async function callScreen(profile: HouseholdProfile): Promise<ScreeningResult[]> {
  const res = await fetch(config.screenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(profile),
    signal: AbortSignal.timeout(30_000),
  });
  const data = await res.json();
  if (!res.ok) {
    const reason =
      typeof data === 'object' && data && 'details' in data
        ? (data as { details?: string[] }).details?.join('; ') ?? JSON.stringify(data)
        : JSON.stringify(data);
    return [
      {
        program: 'CalFresh',
        screening: 'need_more_info',
        estimatedBenefit: null,
        computation: [],
        assumptions: ['Screening engine rejected incomplete profile'],
        reason,
        citations: [
          {
            text: 'CalFresh eligibility information',
            source_url: 'https://www.cdss.ca.gov/calfresh',
            as_of: '2026-07-11',
          },
        ],
        applyUrl: 'https://www.getcalfresh.org/',
        disclaimer:
          'Estimate, not a determination. Confirm with San Francisco HSA when you apply.',
      },
    ];
  }
  return data as ScreeningResult[];
}

export async function explainResults(
  state: GraphState,
  profile: HouseholdProfile,
  results: ScreeningResult[],
): Promise<string> {
  const prompt = `The deterministic CalFresh screen already ran. Explain these ScreeningResult[] to the user in ${profile.preferredLanguage}. Include the disclaimer and every citation source_url from the results. Never invent dollar amounts or change screening outcomes.\n\n${JSON.stringify(results, null, 2)}`;
  return invokeAgent(state.foodEndpoint, state.foodAgentKey, prompt);
}

export async function runGraph(state: GraphState, text: string) {
  const profile = await runIntake(state, text);
  const results = await callScreen(profile);
  const explanation = await explainResults(state, profile, results);
  return { profile, results, explanation };
}

export async function invokeRouter(state: GraphState, text: string): Promise<string> {
  if (!state.routerEndpoint || !state.routerAgentKey) {
    throw new Error('Router endpoint/key missing from graph state');
  }
  return invokeAgent(state.routerEndpoint, state.routerAgentKey, text);
}
