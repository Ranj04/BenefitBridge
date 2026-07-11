import type { ChatResponse, FilledApplication, ScreeningResult, AdversarialResult, NullableProfile } from './types';

// Same-origin in production (static site + API share the App Platform domain).
// Local web development runs Expo on :8081 and the Fastify engine on :8080.
const BASE = process.env.EXPO_PUBLIC_API_URL ?? (__DEV__ ? 'http://localhost:8080' : '');

export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const contentType = res.headers.get('content-type') ?? '';
    const payload = contentType.includes('application/json') ? ((await res.json()) as { code?: unknown }) : null;
    const code = typeof payload?.code === 'string' ? payload.code : 'request_failed';
    throw new ApiError(code, res.status);
  }
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(`${path} returned an unexpected response`);
  }
  return (await res.json()) as T;
}

export const api = {
  // preferredLanguage rides inside the free text (a stated preference the
  // intake agent extracts into HouseholdProfile.preferredLanguage) — a pure
  // frontend pass-through; /chat's contract ({ text }) is unchanged, no
  // backend edit. The agent already explains results in that language.
  chat: (text: string, preferredLanguageHint?: string) =>
    post<ChatResponse>('/chat', {
      text: preferredLanguageHint ? `${text}\n\n(My preferred language is ${preferredLanguageHint}.)` : text,
    }),
  screen: (profile: NullableProfile) => post<ScreeningResult[]>('/screen', profile),
  fill: (profile: NullableProfile) => post<FilledApplication>('/fill', { profile, program: 'CalFresh' }),
  adversarial: () => post<AdversarialResult>('/adversarial-test', {}),
};
