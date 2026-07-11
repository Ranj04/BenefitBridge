import type { ChatResponse, FilledApplication, ScreeningResult, AdversarialResult, NullableProfile } from './types';

// Same-origin in production (static site + API share the App Platform domain).
// Local web development runs Expo on :8081 and the Fastify engine on :8080.
const BASE = process.env.EXPO_PUBLIC_API_URL ?? (__DEV__ ? 'http://localhost:8080' : '');

// Per-endpoint budgets sized to the backend's own: /chat spends up to ~30s on
// intake extraction plus ~15s on the guarded explanation, so it gets headroom;
// the deterministic endpoints answer fast or not at all.
const CHAT_TIMEOUT_MS = 75_000;
const DEFAULT_TIMEOUT_MS = 30_000;

/** `code === 'timeout'` means we aborted a stalled request client-side.
 *  `details` carries the server's human-readable validation errors on 400. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly details?: string[],
  ) {
    super(code);
  }
}

async function post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  // Native fetch + AbortController (repo rule): a stalled connection surfaces
  // as ApiError('timeout') instead of spinning the skeleton forever.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const contentType = res.headers.get('content-type') ?? '';
      const payload = contentType.includes('application/json')
        ? ((await res.json()) as { code?: unknown; details?: unknown })
        : null;
      const code = typeof payload?.code === 'string' ? payload.code : 'request_failed';
      const details = Array.isArray(payload?.details)
        ? payload.details.filter((d): d is string => typeof d === 'string')
        : undefined;
      throw new ApiError(code, res.status, details);
    }
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      throw new Error(`${path} returned an unexpected response`);
    }
    return (await res.json()) as T;
  } catch (e) {
    if (controller.signal.aborted && !(e instanceof ApiError)) throw new ApiError('timeout', 0);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  // preferredLanguage rides inside the free text (a stated preference the
  // intake agent extracts into HouseholdProfile.preferredLanguage) — a pure
  // frontend pass-through; /chat's contract ({ text }) is unchanged, no
  // backend edit. The agent already explains results in that language.
  chat: (text: string, preferredLanguageHint?: string) =>
    post<ChatResponse>(
      '/chat',
      {
        text: preferredLanguageHint ? `${text}\n\n(My preferred language is ${preferredLanguageHint}.)` : text,
      },
      CHAT_TIMEOUT_MS,
    ),
  screen: (profile: NullableProfile) => post<ScreeningResult[]>('/screen', profile, DEFAULT_TIMEOUT_MS),
  fill: (profile: NullableProfile) => post<FilledApplication>('/fill', { profile, program: 'CalFresh' }, DEFAULT_TIMEOUT_MS),
  adversarial: () => post<AdversarialResult>('/adversarial-test', {}, DEFAULT_TIMEOUT_MS),
};
