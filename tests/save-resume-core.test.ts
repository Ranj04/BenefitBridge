import { describe, it, expect } from 'vitest';
import {
  SESSION_KEY,
  SESSION_VERSION,
  MAX_AGE_MS,
  encodeSession,
  decodeSession,
  hasMeaningfulProgress,
  type SessionInput,
} from '../app/src/lib/localSession.core';

// Adversarial gates for the save/resume storage core (frontend, on-device
// only). The platform wiring and UI consent gating are exercised end-to-end
// in a real browser by scripts/verify-save-resume.mjs; this file pins the
// pure rules: web field exclusion (gate D), 7-day expiry (gate E), and that
// nothing but inputs is ever encoded.

const NOW = new Date('2026-07-11T12:00:00Z');

const INPUT: SessionInput = {
  profile: {
    householdSize: 2,
    monthlyIncomeCents: 280000n.toString(),
    immigrationStatus: 'lawful_permanent_resident',
    zip: '94110',
  },
  flowStep: 'intake',
  intakeText: "single mom in SF, about $2,800 a month, one kid, renting for $1,800",
  preferredLanguage: 'es',
};

describe('encodeSession', () => {
  it('gate D: web encoding never writes immigrationStatus, other fields intact', () => {
    const raw = encodeSession(INPUT, NOW, { excludeImmigrationStatus: true });
    expect(raw).not.toContain('immigrationStatus');
    expect(raw).not.toContain('lawful_permanent_resident');
    const parsed = JSON.parse(raw);
    expect(parsed.profile).toEqual({ householdSize: 2, monthlyIncomeCents: '280000', zip: '94110' });
  });

  it('native encoding (encrypted at rest) keeps immigrationStatus', () => {
    const parsed = JSON.parse(encodeSession(INPUT, NOW, { excludeImmigrationStatus: false }));
    expect(parsed.profile.immigrationStatus).toBe('lawful_permanent_resident');
  });

  it('exclusion does not mutate the caller’s in-memory profile (re-ask on resume still works this session)', () => {
    encodeSession(INPUT, NOW, { excludeImmigrationStatus: true });
    expect(INPUT.profile).toHaveProperty('immigrationStatus');
  });

  it('persists inputs only: version, profile, flowStep, intakeText, preferredLanguage, savedAt — never results', () => {
    const parsed = JSON.parse(encodeSession(INPUT, NOW, { excludeImmigrationStatus: false }));
    expect(Object.keys(parsed).sort()).toEqual(['flowStep', 'intakeText', 'preferredLanguage', 'profile', 'savedAt', 'v']);
    expect(parsed.v).toBe(SESSION_VERSION);
    expect(parsed.savedAt).toBe(NOW.toISOString());
  });

  it('handles a null profile (saved before the first agent run)', () => {
    const parsed = JSON.parse(encodeSession({ ...INPUT, profile: null }, NOW, { excludeImmigrationStatus: true }));
    expect(parsed.profile).toBeNull();
  });
});

describe('decodeSession (gate E: expiry, plus hostile blobs)', () => {
  const encoded = (savedAt: Date) => encodeSession(INPUT, savedAt, { excludeImmigrationStatus: false });

  it('round-trips a fresh session', () => {
    const r = decodeSession(encoded(NOW), NOW);
    expect(r.ok && r.session.intakeText).toBe(INPUT.intakeText);
    expect(r.ok && r.session.preferredLanguage).toBe('es');
  });

  it('accepts a session exactly at the 7-day boundary', () => {
    const r = decodeSession(encoded(new Date(NOW.getTime() - MAX_AGE_MS)), NOW);
    expect(r.ok).toBe(true);
  });

  it('gate E: discards a session 8 days old', () => {
    const r = decodeSession(encoded(new Date(NOW.getTime() - 8 * 24 * 60 * 60 * 1000)), NOW);
    expect(r).toEqual({ ok: false, reason: 'expired' });
  });

  it('discards one millisecond past the boundary', () => {
    const r = decodeSession(encoded(new Date(NOW.getTime() - MAX_AGE_MS - 1)), NOW);
    expect(r).toEqual({ ok: false, reason: 'expired' });
  });

  it('discards a savedAt in the future (clock rolled back on a shared machine)', () => {
    const r = decodeSession(encoded(new Date(NOW.getTime() + 60_000)), NOW);
    expect(r).toEqual({ ok: false, reason: 'expired' });
  });

  it('discards empty, junk, wrong-version, and shape-violating blobs', () => {
    expect(decodeSession(null, NOW)).toEqual({ ok: false, reason: 'empty' });
    expect(decodeSession('', NOW)).toEqual({ ok: false, reason: 'empty' });
    expect(decodeSession('not json{', NOW)).toEqual({ ok: false, reason: 'invalid' });
    expect(decodeSession('"a string"', NOW)).toEqual({ ok: false, reason: 'invalid' });
    expect(decodeSession(JSON.stringify({ v: 999, savedAt: NOW.toISOString() }), NOW)).toEqual({ ok: false, reason: 'invalid' });
    const good = JSON.parse(encoded(NOW));
    expect(decodeSession(JSON.stringify({ ...good, flowStep: 'admin' }), NOW)).toEqual({ ok: false, reason: 'invalid' });
    expect(decodeSession(JSON.stringify({ ...good, profile: [1, 2] }), NOW)).toEqual({ ok: false, reason: 'invalid' });
    expect(decodeSession(JSON.stringify({ ...good, savedAt: 'yesterday-ish' }), NOW)).toEqual({ ok: false, reason: 'invalid' });
  });
});

describe('hasMeaningfulProgress', () => {
  const base = { v: SESSION_VERSION, flowStep: 'intake', preferredLanguage: 'en', savedAt: NOW.toISOString() } as const;
  it('no resume prompt for an empty session', () => {
    expect(hasMeaningfulProgress({ ...base, profile: null, intakeText: '   ' })).toBe(false);
  });
  it('draft text alone is worth resuming', () => {
    expect(hasMeaningfulProgress({ ...base, profile: null, intakeText: 'two kids' })).toBe(true);
  });
  it('a profile alone is worth resuming', () => {
    expect(hasMeaningfulProgress({ ...base, profile: { householdSize: 1 }, intakeText: '' })).toBe(true);
  });
});

describe('storage key', () => {
  it('is a single namespaced versioned key (what "Clear my information" deletes)', () => {
    expect(SESSION_KEY).toBe('benefitbridge.session.v1');
  });
});
