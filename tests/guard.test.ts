import { describe, it, expect } from 'vitest';
import { enforceNoGuarantee, DEFAULT_DISCLAIMER, assertsGuarantee } from '../src/guard.ts';

describe('enforceNoGuarantee — deterministic defense in depth', () => {
  it('rewrites the adversarial guarantee into estimate language and appends the disclaimer', () => {
    const raw = 'You are guaranteed $5,000 a month in CalFresh benefits. You will receive it, it is certain.';
    const r = enforceNoGuarantee(raw);
    expect(r.rewritten).toBe(true);
    expect(r.text).not.toMatch(/\bguaranteed\b/i);
    expect(r.text).not.toMatch(/\byou will receive\b/i);
    expect(r.text).toContain('estimated');
    expect(r.text).toContain(DEFAULT_DISCLAIMER);
  });

  it("rewrites \"you're entitled to\" phrasing", () => {
    const r = enforceNoGuarantee("You're entitled to $350 every month.");
    expect(r.rewritten).toBe(true);
    expect(r.text.toLowerCase()).toContain('you may qualify for an estimated $350');
  });

  it('does not over-trigger on honest estimate language', () => {
    const raw = `Based on what you told us, you may qualify for an estimated $350 per month.\n\n${DEFAULT_DISCLAIMER}`;
    const r = enforceNoGuarantee(raw);
    expect(r.rewritten).toBe(false);
    expect(r.disclaimerAppended).toBe(false);
    expect(r.text).toBe(raw);
  });

  it('always ensures the disclaimer is present', () => {
    const r = enforceNoGuarantee('Short answer with no disclaimer.');
    expect(r.disclaimerAppended).toBe(true);
    expect(r.text.endsWith(DEFAULT_DISCLAIMER)).toBe(true);
  });

  it('neutralizes guarantee phrasing independent of any platform guardrail (raw model text in, safe text out)', () => {
    // Simulates a platform-guardrail bypass: the raw agent output claims certainty.
    const bypassed = 'Good news! You are GUARANTEED exactly $5,000/mo, approved and certain.';
    const r = enforceNoGuarantee(bypassed);
    expect(r.text).not.toMatch(/guarant/i);
    expect(r.text).toContain(DEFAULT_DISCLAIMER);
  });
});

describe('negation-awareness — refusals are the honest framing, never mangled', () => {
  it('leaves "we cannot guarantee" untouched (no "cannot estimates" mangling)', () => {
    const raw = 'We cannot guarantee any benefit amount. No guarantee is possible from a screener.';
    const r = enforceNoGuarantee(raw);
    expect(r.text).toContain('cannot guarantee');
    expect(r.text).not.toContain('cannot estimates');
  });

  it('still rewrites an ASSERTED guarantee in the same text', () => {
    const raw = 'We cannot guarantee outcomes. However you are guaranteed $5,000 a month.';
    const r = enforceNoGuarantee(raw);
    expect(r.text).toContain('cannot guarantee');
    expect(r.text.toLowerCase()).not.toMatch(/you are guaranteed/);
  });

  it('assertsGuarantee: refusal → false, assertion → true, quoted-in-denial → false', () => {
    expect(assertsGuarantee('I cannot guarantee any amount.')).toBe(false);
    expect(assertsGuarantee("I'm not allowed to use words like \"guaranteed\".")).toBe(false);
    expect(assertsGuarantee('You are guaranteed $5,000 a month.')).toBe(true);
    expect(assertsGuarantee('Rest easy, you will receive $500.')).toBe(true);
  });
});
