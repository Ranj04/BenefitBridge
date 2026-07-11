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
 * Amounts that belong to another anchor are not income. "my rent is 1.3k a
 * month and i make 6k a month" must never read 1300 as the wage — blank the
 * rent/utility-anchored amounts (preserving length) before the income scan.
 */
function maskNonIncomeAmounts(text: string): string {
  return text
    .replace(
      /\b(rent|rents|renting|lease|utilities|utility)\b([^.!?\n]{0,15}?)(\$?\s*\d[\d,]*(?:\.\d+)?\s*(?:k|thousand)?)/gi,
      (_m, a: string, b: string, c: string) => a + b + ' '.repeat(c.length),
    )
    .replace(
      /(\$?\s*\d[\d,]*(?:\.\d+)?\s*(?:k|thousand)?)([^.!?\n]{0,15}?\b(?:rent|lease)\b)/gi,
      (_m, a: string, b: string) => ' '.repeat(a.length) + b,
    );
}

/**
 * Income. Requires an explicit amount. A stated period is normalized to monthly;
 * an amount with no period is only accepted when it is unambiguously a wage
 * figure (an earning verb, and small enough that it cannot be an annual salary) —
 * otherwise we would be guessing between $3,000/mo and $3,000/yr, and we do not
 * guess.
 */
export function extractMonthlyIncome(rawText: string): number | null {
  const text = maskNonIncomeAmounts(rawText);
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

/** Non-capturing count, for patterns that scan rather than pull a single group. */
const COUNT_NC = '(?:\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)';

/** Everyone a household roster can name, besides the speaker. */
const PERSON =
  '(?:kids?|children|child|sons?|daughters?|babies|baby|toddlers?|newborns?|infants?|teens?|teenagers?' +
  '|grand(?:kids?|children|child|parents?|ma|mother|pa|father)|parents?|moms?|mothers?|mums?|dads?|fathers?' +
  '|husbands?|wives|wife|spouses?|partners?|girlfriends?|boyfriends?|fiancees?|fiances?' +
  '|roommates?|housemates?|siblings?|brothers?|sisters?|cousins?|nieces?|nephews?|aunts?|uncles?' +
  '|stepkids?|stepsons?|stepdaughters?|dependents?|adults?|grownups?|relatives?)';

const SELF = '(?:me|myself|i)';
const SELF_SET = new Set(['me', 'myself', 'i']);

/** Plural nouns that denote a specific number of people by ordinary meaning. */
const PAIR: Record<string, number> = { parents: 2, grandparents: 2 };

/** "kids" / "children" / "wives" — a count we were not given. */
function isPlural(token: string): boolean {
  return /(?:s|children|wives)$/.test(token);
}

/** One roster entry: an optional count, an optional determiner, and a person. */
const ITEM = `\\b(?:(?:my|our|the)\\s+)?(?:(no|${COUNT_NC})\\s+)?(?:(?:my|our|the)\\s+)?(${PERSON}|${SELF})\\b`;
const ITEM_NC = ITEM.replace(/\((?!\?)/g, '(?:');
/** Roster entries run together with commas, "and", or nothing at all ("me my mom and my 2 brothers"). */
const SEP = '\\s*(?:,\\s*and|,|;|&|\\+|and|plus)?\\s*';

type Scan = { total: number; named: boolean; self: boolean; ambiguous: boolean; allCounted: boolean };

/**
 * Read the people a clause names. The speaker is tallied separately, so a text
 * that names them twice ("i live with 3 kids and myself") still counts them once.
 *
 * A plural with no number ("my kids", "roommates") is a count we were NOT given.
 * We do not settle it at 1 — we mark it ambiguous and let the caller ask, because
 * inventing a household size is inventing a benefit amount.
 */
function scanPeople(clause: string): Scan {
  const scan: Scan = { total: 0, named: false, self: false, ambiguous: false, allCounted: true };

  for (const m of clause.matchAll(new RegExp(ITEM, 'gi'))) {
    const qty = m[1]?.toLowerCase();
    const token = m[2]!.toLowerCase();

    if (SELF_SET.has(token)) {
      scan.self = true;
      continue;
    }
    if (qty === 'no') continue; // "no kids", "no husband" → nobody

    if (qty) {
      const n = countFrom(qty);
      if (n == null || n < 0 || n > 19) {
        scan.ambiguous = true;
        continue;
      }
      scan.total += n;
      scan.named = true;
      continue;
    }
    if (PAIR[token] != null) {
      scan.total += PAIR[token]!;
      scan.named = true;
      scan.allCounted = false;
      continue;
    }
    if (isPlural(token)) {
      scan.ambiguous = true; // "my kids" — how many? Never assume.
      scan.allCounted = false;
      continue;
    }
    scan.total += 1; // a singular person: "my wife", "my son"
    scan.named = true;
    scan.allCounted = false;
  }
  return scan;
}

/** Turn a scan into a household total, counting the speaker at most once. */
function totalFrom(scan: Scan, speakerImplied: boolean): number | null {
  if (scan.ambiguous) return null; // an unstated count is a question, not a guess
  if (!scan.named) return null;
  const total = scan.total + (speakerImplied || scan.self ? 1 : 0);
  return total >= 1 && total <= 20 ? total : null;
}

/**
 * People type run-on sentences: "i live with 3 kids and myself i make 5k a month".
 * The roster ends where the next statement begins, not at a period they never typed.
 */
function clauseFrom(rest: string): string {
  const stop = rest.search(
    /[.!?\n;]|\b(?:i|we)\s+(?:make|makes|earn|earns|get|gets|am|need|needs|want|wants|work|works|live|lives|rent|rents|pay|pays|have|has|call|called)\b/i,
  );
  return stop === -1 ? rest : rest.slice(0, stop);
}

/** Household size. "only me in th house" → 1. "i live with 3 kids and myself" → 4. */
export function extractHouseholdSize(text: string): number | null {
  const t = text.toLowerCase();

  // 1. An explicit total wins over any inference.
  const explicit =
    t.match(new RegExp(`\\b(?:household|family)\\s+(?:size\\s+)?(?:is\\s+|of\\s+|:\\s*)${COUNT}\\b`, 'i')) ??
    t.match(new RegExp(`\\b(?:household|family|home|house)\\s+of\\s+${COUNT}\\b`, 'i')) ??
    t.match(new RegExp(`\\b${COUNT}\\s+(?:people|persons?|of us|total|in\\s+(?:my|the|th)\\s+(?:house|home|household|apartment|place))\\b`, 'i')) ??
    t.match(new RegExp(`\\bwe(?:'re| are)\\s+${COUNT}\\b`, 'i'));
  if (explicit) {
    const n = countFrom(explicit[1]!);
    if (n != null && n >= 1 && n <= 20) return n;
  }

  // 2. "single mother of 3", "dad of two" — the parent is in the household too.
  const parentOf = t.match(
    new RegExp(`\\b(?:single\\s+)?(?:mom|mother|mum|dad|father|parent)\\s+(?:of|to)\\s+${COUNT}\\b`, 'i'),
  );
  if (parentOf) {
    const n = countFrom(parentOf[1]!);
    if (n != null && n >= 1 && n <= 19) return n + 1;
  }

  // 2b. "single dad … 3 kids" without an "of": the count may sit across a comma
  //     or a relative clause ("with 3 kids who live with me"). Only when nobody
  //     else is named in the span — "single mom, my sister has two kids" must
  //     not count the sister's children into this household.
  const soloKids = t.match(
    new RegExp(`\\b(?:single|solo)\\s+(?:mom|mother|mum|dad|father|parent)\\b([^.!?\\n]{0,40}?)\\b${COUNT}\\s+(?:kids?|children|child)\\b`, 'i'),
  );
  if (soloKids && !new RegExp(PERSON, 'i').test(soloKids[1]!)) {
    const n = countFrom(soloKids[2]!);
    if (n != null && n >= 1 && n <= 19) return n + 1;
  }

  // 3. A roster introduced by who they live with / support / have.
  //    "i live with 3 kids and myself", "raising 2 kids", "i have 3 kids", "single dad with 2 kids"
  //    Every anchor is tried: the first to yield an actual count wins. A regex
  //    match whose clause names nobody countable ("…who live with ME…") must not
  //    shadow a later anchor that has the real roster.
  const ANCHORS = [
    /\b(?:(?:live|living|lives|stay|staying|reside|residing)\s+(?:with|w\/)|raising|supporting|caring\s+for|looking\s+after|taking\s+care\s+of)\s+([^]*)/i,
    /\b(?:i\s+have|i've\s+got|ive\s+got|i\s+got|we\s+have|there(?:'s| is| are)|it'?s)\s+([^]*)/i,
    /\b(?:single\s+(?:dad|mom|mum|mother|father|parent)|widow(?:er)?)\b[^.!?\n]{0,30}?\bwith\s+([^]*)/i,
  ];
  let sawAmbiguous = false;
  for (const anchor of ANCHORS) {
    const m = t.match(anchor);
    if (!m) continue;
    const scan = scanPeople(clauseFrom(m[1]!));
    if (scan.ambiguous) {
      sawAmbiguous = true; // they named people but not how many — a question, unless another anchor has the count
      continue;
    }
    const n = totalFrom(scan, true);
    if (n != null) return n;
  }
  if (sawAmbiguous) return null;

  // 4. A bare roster: a coordinated list of people, with or without the speaker in it.
  //    "me, my wife, and our three kids" / "my husband and me" / "2 adults and 3 children"
  const list = t.match(new RegExp(`${ITEM_NC}(?:${SEP}${ITEM_NC})+`, 'i'));
  if (list) {
    const scan = scanPeople(list[0]);
    if (scan.ambiguous) return null;
    if (scan.named && (scan.self || scan.allCounted)) {
      const n = totalFrom(scan, false);
      if (n != null && n >= 2) return n;
    }
  }

  // 5. Living alone, however it gets phrased.
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
