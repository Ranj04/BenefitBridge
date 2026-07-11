/**
 * Deterministic no-guarantee guard — CODE, not a model. Defense in depth
 * behind the console-attached Gradient guardrails (Jailbreak / Sensitive
 * Data): those are prebuilt classifiers, none rewrites guarantee phrasing.
 * This runs on every agent response at the boundary, so "guaranteed $X"
 * becomes estimate language even if the platform guardrail is bypassed.
 * Ported from feat/p2-gradient-graph (gradient/src/guard.ts).
 */

export type GuardResult = { text: string; rewritten: boolean; disclaimerAppended: boolean };

export const DEFAULT_DISCLAIMER =
  'Estimate, not a determination. Confirm with San Francisco HSA.';

const REWRITES: [RegExp, string][] = [
  [/\bguaranteed to (?:get|receive)\b/gi, 'estimated to be eligible for'],
  [/\bguarantees?\b/gi, 'estimates'],
  [/\bguaranteed\b/gi, 'estimated'],
  [/\byou (?:will|are going to) (?:get|receive)\b/gi, 'you may be able to receive an estimated'],
  [/\b(?:you are|you're) entitled to\b/gi, 'you may qualify for an estimated'],
  [/\bcertain(?:ly)? (?:eligible|qualify)\b/gi, 'likely to qualify, based on what you told us,'],
];

export function enforceNoGuarantee(raw: string, disclaimer: string = DEFAULT_DISCLAIMER): GuardResult {
  let text = raw;
  for (const [pattern, replacement] of REWRITES) text = text.replace(pattern, replacement);
  const rewritten = text !== raw;
  const disclaimerAppended = !text.includes(disclaimer);
  if (disclaimerAppended) text = `${text.trimEnd()}\n\n${disclaimer}`;
  return { text, rewritten, disclaimerAppended };
}
