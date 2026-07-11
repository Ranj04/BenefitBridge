import type { ChatResponse, FilledApplication, ScreeningResult, AdversarialResult, NullableProfile } from './types';

// Same-origin in production (static site + API share the App Platform domain);
// EXPO_PUBLIC_API_URL for local dev against a local engine.
const BASE = process.env.EXPO_PUBLIC_API_URL ?? '';

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`${path} → ${res.status}: ${detail.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export const api = {
  // preferredLanguage rides inside the free text (a stated preference the
  // intake agent extracts into HouseholdProfile.preferredLanguage) — a pure
  // frontend pass-through; /chat's contract ({ text }) is unchanged, no
  // backend edit. The agent already explains results in that language.
  chat: (text: string, preferredLanguage?: string) =>
    post<ChatResponse>('/chat', {
      text: preferredLanguage ? `${text}\n\n(My preferred language is "${preferredLanguage}".)` : text,
    }),
  screen: (profile: NullableProfile) => post<ScreeningResult[]>('/screen', profile),
  fill: (profile: NullableProfile) => post<FilledApplication>('/fill', { profile, program: 'CalFresh' }),
  adversarial: () => post<AdversarialResult>('/adversarial-test', {}),
};
