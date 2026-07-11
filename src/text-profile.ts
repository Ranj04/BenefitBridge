/**
 * Deterministic free-text → profile-field extraction.
 *
 * The intake agent is the primary extractor. This is the floor under it: a pure,
 * testable parser that catches the phrasings a hurried person actually types
 * ("3k month", "only me in th house", "no kids no husband"). It backfills fields
 * the agent left null and stands alone when the agent returns prose or times out,
 * so a user who DID state their income never gets asked for it again.
 *
 * Discipline is unchanged: this reads language, it does not decide eligibility or
 * compute a benefit. Anything not stated stays absent — nothing is guessed. Every
 * field it supplies is surfaced to the user as a read-back assumption.
 */
import type { NullableProfile } from './chat.ts';

export type ExtractedProfile = Partial<NullableProfile>;

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

/** "3", "3.5", "2,800" → number. */
function toNumber(raw: string): number {
  return Number(raw.replace(/,/g, ''));
}

function countFrom(token: string): number | null {
  const w = WORD_NUMBERS[token.toLowerCase()];
  if (w != null) return w;
  const n = Number(token);
  return Number.isFinite(n) ? n : null;
}

const COUNT = '(\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)';

/** Periods we can normalize to a month. Values are the per-month multiplier. */
const PERIOD_TO_MONTHLY: Record<string, number> = {
  hour: (40 * 52) / 12, hr: (40 * 52) / 12, hourly: (40 * 52) / 12,
  week: 52 / 12, wk: 52 / 12, weekly: 52 / 12,
  biweekly: 26 / 12, fortnight: 26 / 12,
  month: 1, mo: 1, monthly: 1, mth: 1,
  year: 1 / 12, yr: 1 / 12, yearly: 1 / 12, annually: 1 / 12, annual: 1 / 12,
};

const AMOUNT = '\\$?\\s*(\\d[\\d,]*(?:\\.\\d+)?)\\s*(k|thousand)?';
const PERIOD = '(hourly|hour|hr|weekly|week|wk|biweekly|fortnight|monthly|month|mth|mo|yearly|year|yr|annually|annual)';

function normalize(rawAmount: string, kSuffix: string | undefined, period: string): number | null {
  const amount = toNumber(rawAmount) * (kSuffix ? 1000 : 1);
  const factor = PERIOD_TO_MONTHLY[period.toLowerCase()];
  if (!Number.isFinite(amount) || amount < 0 || factor == null) return null;
  return Math.round(amount * factor);
}

/**
 * Income. Requires an explicit amount. A stated period is normalized to monthly;
 * an amount with no period is only accepted when it is unambiguously a wage
 * figure (an earning verb, and small enough that it cannot be an annual salary) —
 * otherwise we would be guessing between $3,000/mo and $3,000/yr, and we do not
 * guess.
 */
export function extractMonthlyIncome(text: string): number | null {
  // "3k month", "$2,800 a month", "650 a week", "40k/yr", "$45,000 per year"
  const forward = text.match(
    new RegExp(`${AMOUNT}\\s*(?:dollars?|bucks|usd)?\\s*(?:\\/|\\s*(?:a|an|per|each|every)\\s+|\\s+)${PERIOD}\\b`, 'i'),
  );
  if (forward) return normalize(forward[1]!, forward[2], forward[3]!);

  // "monthly income of $3,000", "a month I get 3k"
  const backward = text.match(new RegExp(`${PERIOD}\\b[^.!?\\n]{0,25}?${AMOUNT}`, 'i'));
  if (backward) return normalize(backward[2]!, backward[3], backward[1]!);

  // No period stated: only safe as a monthly wage when the figure is too small to
  // plausibly be an annual salary.
  const bare = text.match(
    new RegExp(`\\b(?:makes?|earns?|earning|bring home|take home|get paid|income is|income of)\\b[^.!?\\n]{0,15}?${AMOUNT}`, 'i'),
  );
  if (bare) {
    const amount = toNumber(bare[1]!) * (bare[2] ? 1000 : 1);
    if (amount > 0 && amount < 15_000) return Math.round(amount);
  }
  return null;
}

/** People a roster clause can name, besides the speaker. */
const PERSON =
  '(?:kids?|children|child|sons?|daughters?|baby|babies|toddlers?|newborns?|grand(?:kids?|children)' +
  '|parents?|mom|mother|dad|father|husband|wife|spouse|partner|roommates?|siblings?|brothers?|sisters?' +
  '|cousins?|dependents?)';

/**
 * People type run-on sentences: "i live with 3 kids and myself i make 5k a month".
 * The roster ends where the next statement begins, not at a period they never typed.
 */
function clauseFrom(rest: string): string {
  const stop = rest.search(
    /[.!?\n;]|\b(?:i|we)\s+(?:make|makes|earn|earns|get|gets|am|need|needs|want|wants|work|works|live|lives|rent|rents|pay|pays|have|has)\b/i,
  );
  return stop === -1 ? rest : rest.slice(0, stop);
}

/**
 * Sum the people a clause names, plus the speaker when they are one of them.
 * "3 kids and myself" → 4. "my 2 kids" (speaker implied by "I live with") → 3.
 * A negated term ("no kids") contributes nobody. Nothing named → null.
 */
function countRoster(clause: string, speakerLivesThere: boolean): number | null {
  const re = new RegExp(`(?:(?:my|our|the)\\s+)?(?:(no|${COUNT})\\s+)?(?:(?:my|our|the)\\s+)?${PERSON}\\b`, 'gi');
  let total = 0;
  let named = false;

  for (const m of clause.matchAll(re)) {
    const qty = m[1]?.toLowerCase();
    if (qty === 'no') continue; // "no kids" names nobody
    const n = qty ? countFrom(qty) : 1;
    if (n == null || n < 0 || n > 19) return null;
    total += n;
    named = true;
  }

  const speaker = speakerLivesThere || /\b(?:me|myself|i)\b/i.test(clause);
  if (!named && !speaker) return null;
  total += speaker ? 1 : 0;
  return total >= 1 && total <= 20 ? total : null;
}

/** Household size. "only me in th house" → 1. "i live with 3 kids and myself" → 4. */
export function extractHouseholdSize(text: string): number | null {
  const t = text.toLowerCase();

  // Explicit counts win over inference.
  const explicit =
    t.match(new RegExp(`\\b(?:household|family|home|house)\\s+of\\s+${COUNT}\\b`, 'i')) ??
    t.match(new RegExp(`\\b${COUNT}\\s+(?:people|persons?|of us|in (?:my|the|th) (?:house|home|household|apartment))\\b`, 'i')) ??
    t.match(new RegExp(`\\bwe(?:'re| are)\\s+${COUNT}\\b`, 'i'));
  if (explicit) {
    const n = countFrom(explicit[1]!);
    if (n != null && n >= 1 && n <= 20) return n;
  }

  // A roster of who lives there, in whatever order it gets said.
  // "i live with 3 kids and myself" / "single dad with 3 kids" / "raising 2 kids"
  const lives = t.match(
    /\b(?:(?:live|living|lives|stay|staying)\s+with|raising|supporting)\s+([^]*)/i,
  ) ?? t.match(/\b(?:single\s+(?:dad|mom|mum|mother|father|parent)|widow(?:er)?)\b[^.!?\n]{0,30}?\bwith\s+([^]*)/i);
  if (lives) {
    const n = countRoster(clauseFrom(lives[1]!), true);
    if (n != null) return n;
  }

  // "me and my 2 kids", "just me and my son", and the reverse: "3 kids and myself".
  const roster =
    t.match(/\b(?:me|myself)\s+and\s+([^]*)/i) ??
    t.match(new RegExp(`\\b(${COUNT}\\s+(?:my\\s+)?${PERSON}\\b[^.!?\\n]{0,15}?and\\s+(?:me|myself))`, 'i'));
  if (roster) {
    const n = countRoster(`me and ${clauseFrom(roster[1]!)}`, false);
    if (n != null && n >= 2) return n;
  }

  // Living alone, however it gets phrased.
  if (/\b(?:live|living|lives|stay|staying)\s+(?:by\s+myself|alone)\b/.test(t)) return 1;
  if (/\b(?:only|just)\s+me\b/.test(t)) return 1;
  if (/\bby\s+myself\b/.test(t)) return 1;
  if (/\bno\s+one\s+else\b/.test(t)) return 1;
  if (/\b(?:single|one)[-\s]person\s+(?:household|home)\b/.test(t)) return 1;

  return null;
}

export function extractHasChildren(text: string): boolean | null {
  const t = text.toLowerCase();
  if (/\bno\s+(?:kids?|children|child|dependents?)\b/.test(t)) return false;
  if (/\b(?:kids?|children|child|son|daughter|baby|babies|toddler|newborn)\b/.test(t)) return true;
  return null;
}

export function extractIsRenter(text: string): boolean | null {
  const t = text.toLowerCase();
  if (/\bi\s+own\s+(?:my|the)\s+(?:home|house|place)\b/.test(t)) return false;
  if (/\b(?:rent|rents|renting|renter|landlord|lease|leasing)\b/.test(t)) return true;
  if (/\bsection\s*8\b/.test(t)) return true;
  return null;
}

/** Rent amount, only when the number is anchored to the word "rent". */
export function extractMonthlyRent(text: string): number | null {
  const m =
    text.match(/\brent\b[^.!?\n]{0,15}?\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(k)?/i) ??
    text.match(/\$\s*(\d[\d,]*(?:\.\d+)?)\s*(k)?[^.!?\n]{0,15}?\brent\b/i);
  if (!m) return null;
  const amount = toNumber(m[1]!) * (m[2] ? 1000 : 1);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 20_000) return null;
  return Math.round(amount);
}

export function extractElderlyOrDisabled(text: string): boolean | null {
  const t = text.toLowerCase();
  if (/\b(?:disabled|disability|ssdi|ssi|elderly|senior citizen|on social security)\b/.test(t)) return true;
  const age = t.match(/\b(?:i'm|i am|im|aged?)\s+(\d{2})\b(?!\s*k\b)/i);
  if (age) {
    const n = Number(age[1]);
    if (n >= 60 && n <= 120) return true;
    if (n >= 18 && n < 60) return false;
  }
  return null;
}

/** Extract every field we can defend from the raw text. Unstated stays absent. */
export function extractProfileFromText(text: string): ExtractedProfile {
  const out: ExtractedProfile = {};
  const put = <K extends keyof NullableProfile>(k: K, v: NullableProfile[K] | null) => {
    if (v !== null) out[k] = v;
  };
  put('householdSize', extractHouseholdSize(text));
  put('monthlyGrossIncome', extractMonthlyIncome(text));
  put('hasChildren', extractHasChildren(text));
  put('isRenter', extractIsRenter(text));
  put('monthlyRent', extractMonthlyRent(text));
  put('hasElderlyOrDisabled', extractElderlyOrDisabled(text));
  return out;
}

/**
 * Agent output is authoritative; the local read fills only the holes it left.
 * Every locally-filled field becomes a read-back the user can correct.
 */
export function mergeProfiles(
  agent: NullableProfile | null,
  local: ExtractedProfile,
): { profile: NullableProfile; assumptions: string[] } {
  const profile = { ...(agent ?? {}) } as NullableProfile;

  const readBack: Record<string, (v: unknown) => string> = {
    householdSize: (v) => `read from what you wrote: household of ${v} — correct me if that's off`,
    monthlyGrossIncome: (v) => `read from what you wrote: about $${v}/month before taxes — correct me if that's off`,
    monthlyRent: (v) => `read from what you wrote: $${v}/month in rent — correct me if that's off`,
    hasChildren: (v) => `read from what you wrote: ${v ? 'children in the household' : 'no children'}`,
    isRenter: (v) => `read from what you wrote: ${v ? 'you rent' : 'you do not rent'}`,
    hasElderlyOrDisabled: (v) => `read from what you wrote: ${v ? 'an elderly or disabled member' : 'no elderly or disabled member'}`,
  };

  const assumptions: string[] = [];
  for (const [key, value] of Object.entries(local)) {
    const k = key as keyof NullableProfile;
    if (profile[k] != null || value == null) continue;
    (profile as Record<string, unknown>)[k] = value;
    assumptions.push(readBack[key]?.(value) ?? `read from what you wrote: ${key} = ${String(value)}`);
  }
  return { profile, assumptions };
}
