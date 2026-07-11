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
  chat: (text: string) => post<ChatResponse>('/chat', { text }),
  screen: (profile: NullableProfile) => post<ScreeningResult[]>('/screen', profile),
  fill: (profile: NullableProfile) => post<FilledApplication>('/fill', { profile, program: 'CalFresh' }),
  adversarial: () => post<AdversarialResult>('/adversarial-test', {}),
};
