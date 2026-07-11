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

/**
 * Ordered most-specific first. Two invariants:
 *  1. Every replacement preserves the estimate-not-guarantee meaning and reads
 *     as clean English in place (amount phrasing after it is left standing).
 *  2. No replacement contains a word another pattern would need to rewrite
 *     (guarantee/certain/promise/approved/entitled/assured), so rewrites can
 *     never reintroduce what an earlier pattern removed.
 */
const REWRITES: [RegExp, string][] = [
  [/\bguaranteed to (?:get|receive)\b/gi, 'estimated to be eligible for'],
  [/\bguarantees?\b/gi, 'estimates'],
  [/\bguaranteed\b/gi, 'estimated'],
  // "you'll receive", "you will definitely receive", "you are going to get" —
  // tolerates intervening adverbs (definitely/certainly/absolutely/…) or "100%".
  [/\byou(?:'ll| will| are going to|'re going to)(?:\s+(?:\w+ly|100%))*\s+(?:get|receive)\b/gi, 'you may be able to receive'],
  [/\byou(?:'ll| will| are going to|'re going to)(?:\s+(?:\w+ly|100%))*\s+qualify\b/gi, 'you may qualify'],
  [/\b(?:you are|you're)(?:\s+\w+ly)*\s+entitled to\b/gi, 'you may qualify for an estimated'],
  [/\bentitled to\b/gi, 'potentially eligible for'],
  [/\b(?:you have been|you've been|you are|you're) approved\b/gi, 'you may be eligible'],
  [/\bapproved\b/gi, 'potentially eligible'],
  [/\brest assured\b/gi, 'please note'],
  [/\bassured\b/gi, 'estimated'],
  [/\bwe promise\b/gi, 'we estimate'],
  [/\bpromised\b/gi, 'estimated'],
  [/\bpromises?\b/gi, 'estimates'],
  [/\b100%\s+certain\b/gi, 'an estimate, not a certainty'],
  [/\b(?:it|this|that) is certain\b/gi, 'this is an estimate'],
  [/\bcertain(?:ly)?\s+(?:eligible|qualify)\b/gi, 'likely to qualify, based on what you told us,'],
  [/\bcertainly\b/gi, 'possibly'],
  [/\bdefinitely\s+(?:get|receive)\b/gi, 'may be able to receive'],
  [/\bdefinitely\s+qualify\b/gi, 'may qualify'],
  // Predicate-final certainty: "…, approved and certain." / "that is certain!"
  [/\bcertain\b(?=\s*(?:[.!?,;:]|$))/gi, 'estimated'],
];

/** Keep the rewrite grammatical: a match that started a sentence stays capitalized. */
function matchLeadingCase(source: string, replacement: string): string {
  return /^[A-Z]/.test(source) ? replacement.charAt(0).toUpperCase() + replacement.slice(1) : replacement;
}

export function enforceNoGuarantee(raw: string, disclaimer: string = DEFAULT_DISCLAIMER): GuardResult {
  let text = raw;
  for (const [pattern, replacement] of REWRITES) {
    text = text.replace(pattern, (m) => matchLeadingCase(m, replacement));
  }
  const rewritten = text !== raw;
  const disclaimerAppended = !text.includes(disclaimer);
  if (disclaimerAppended) text = `${text.trimEnd()}\n\n${disclaimer}`;
  return { text, rewritten, disclaimerAppended };
}
