// Pure core of opt-in on-device save/resume: encode/decode/expiry/exclusion
// logic with zero platform imports, so the privacy-critical rules are unit-
// testable from the repo's vitest suite. Platform wiring lives in
// localSession.ts. Nothing here (or there) touches the network; optional saved
// progress stays on the user's device. Screening requests are handled elsewhere.

export const SESSION_VERSION = 1 as const;

/** Single namespaced key — "Clear my information" deletes exactly this. */
export const SESSION_KEY = 'benefitbridge.session.v1';

/** Saved sessions self-expire: shared/library devices must not accumulate PII. */
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type FlowStep = 'welcome' | 'intake' | 'results';

/**
 * The whole persisted footprint. Inputs only — computed screening results are
 * never saved; resume re-runs /screen so numbers are always against live data.
 */
export type SavedSession = {
  v: typeof SESSION_VERSION;
  /** The intake agent's extracted HouseholdProfile (partial ok, null before first run). */
  profile: Record<string, unknown> | null;
  flowStep: FlowStep;
  /** The draft free-text answer — in this app, losing it IS losing intake progress. */
  intakeText: string;
  preferredLanguage: string;
  savedAt: string; // ISO 8601
};

export type SessionInput = Omit<SavedSession, 'v' | 'savedAt'>;

/**
 * LIMITATION (web): localStorage is not encrypted at rest, so on web the
 * immigrationStatus field is never written — it is re-asked/recomputed on
 * resume. (Native uses Keychain/Keystore via expo-secure-store, which is
 * encrypted, and keeps the field.) Note the free-text draft is saved as typed
 * on both platforms; it is the user's own wording and the price of resume.
 */
export function encodeSession(input: SessionInput, now: Date, opts: { excludeImmigrationStatus: boolean }): string {
  let profile = input.profile;
  if (profile && opts.excludeImmigrationStatus && 'immigrationStatus' in profile) {
    const { immigrationStatus: _dropped, ...rest } = profile;
    profile = rest;
  }
  const session: SavedSession = {
    v: SESSION_VERSION,
    profile,
    flowStep: input.flowStep,
    intakeText: input.intakeText,
    preferredLanguage: input.preferredLanguage,
    savedAt: now.toISOString(),
  };
  return JSON.stringify(session);
}

export type DecodeResult =
  | { ok: true; session: SavedSession }
  | { ok: false; reason: 'empty' | 'invalid' | 'expired' };

/** Strict decode: anything malformed, wrong-version, or stale is discarded (caller clears the store). */
export function decodeSession(raw: string | null | undefined, now: Date): DecodeResult {
  if (!raw) return { ok: false, reason: 'empty' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (typeof parsed !== 'object' || parsed === null) return { ok: false, reason: 'invalid' };
  const s = parsed as Partial<SavedSession>;
  if (
    s.v !== SESSION_VERSION ||
    typeof s.savedAt !== 'string' ||
    typeof s.intakeText !== 'string' ||
    typeof s.preferredLanguage !== 'string' ||
    (s.flowStep !== 'welcome' && s.flowStep !== 'intake' && s.flowStep !== 'results') ||
    (s.profile !== null && (typeof s.profile !== 'object' || Array.isArray(s.profile)))
  ) {
    return { ok: false, reason: 'invalid' };
  }
  const savedAt = Date.parse(s.savedAt);
  if (Number.isNaN(savedAt)) return { ok: false, reason: 'invalid' };
  const age = now.getTime() - savedAt;
  if (age > MAX_AGE_MS || age < 0) return { ok: false, reason: 'expired' };
  return { ok: true, session: s as SavedSession };
}

/** Only offer "Resume?" when there is something worth restoring. */
export function hasMeaningfulProgress(session: SavedSession): boolean {
  return session.intakeText.trim().length > 0 || session.profile !== null;
}
