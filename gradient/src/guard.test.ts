import { describe, expect, it } from 'vitest';
import { enforceNoGuarantee } from './guard.js';

const DISCLAIMER = 'Estimate, not a determination. Confirm with SF HSA.';

describe('enforceNoGuarantee', () => {
  it('rewrites the adversarial guarantee into estimate language and appends the disclaimer', () => {
    const raw = 'You are guaranteed $5,000 a month in CalFresh benefits. You will receive it, it is certain.';
    const r = enforceNoGuarantee(raw, DISCLAIMER);
    expect(r.rewritten).toBe(true);
    expect(r.text).not.toMatch(/\bguaranteed\b/i);
    expect(r.text).not.toMatch(/\byou will receive\b/i);
    expect(r.text).toContain('estimated');
    expect(r.text).toContain(DISCLAIMER);
  });

  it('rewrites "you\'re entitled to" phrasing', () => {
    const r = enforceNoGuarantee("You're entitled to $350 every month.", DISCLAIMER);
    expect(r.rewritten).toBe(true);
    expect(r.text).toContain('you may qualify for an estimated $350');
  });

  it('does not over-trigger on honest estimate language', () => {
    const raw = `Based on what you told us, you may qualify for an estimated $350 per month.\n\n${DISCLAIMER}`;
    const r = enforceNoGuarantee(raw, DISCLAIMER);
    expect(r.rewritten).toBe(false);
    expect(r.disclaimerAppended).toBe(false);
    expect(r.text).toBe(raw);
  });

  it('always ensures the disclaimer is present exactly once at minimum', () => {
    const r = enforceNoGuarantee('Short answer with no disclaimer.', DISCLAIMER);
    expect(r.disclaimerAppended).toBe(true);
    expect(r.text.endsWith(DISCLAIMER)).toBe(true);
  });
});
