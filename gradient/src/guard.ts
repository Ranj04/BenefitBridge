// Deterministic no-guarantee guard — CODE, not a model.
// DO Gradient's attachable guardrail types are prebuilt classifiers
// (jailbreak / sensitive-data / content-moderation); none does a custom
// "rewrite guarantees into estimate language" transform. Per the project's
// model-does-language-code-does-math rule, the rewrite lives here, applied to
// every agent response at the boundary before it reaches a user.

export type GuardResult = { text: string; rewritten: boolean; disclaimerAppended: boolean };

const REWRITES: [RegExp, string][] = [
  [/\bguaranteed to (?:get|receive)\b/gi, 'estimated to be eligible for'],
  [/\bguarantees?\b/gi, 'estimates'],
  [/\bguaranteed\b/gi, 'estimated'],
  [/\byou (?:will|are going to) (?:get|receive)\b/gi, 'you may be able to receive an estimated'],
  [/\b(?:you are|you're) entitled to\b/gi, 'you may qualify for an estimated'],
  [/\bcertain(?:ly)? (?:eligible|qualify)\b/gi, 'likely to qualify, based on what you told us,'],
];

export function enforceNoGuarantee(raw: string, disclaimer: string): GuardResult {
  let text = raw;
  for (const [pattern, replacement] of REWRITES) text = text.replace(pattern, replacement);
  const rewritten = text !== raw;
  const disclaimerAppended = !text.includes(disclaimer);
  if (disclaimerAppended) text = `${text.trimEnd()}\n\n${disclaimer}`;
  return { text, rewritten, disclaimerAppended };
}
