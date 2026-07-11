/**
 * HouseholdProfile → CF 285 (8/21) field mapping. THE RULE: map only what the
 * profile actually states; anything else lands in blankFields for the human.
 * Never fabricate — no invented names, employers, dates, or amounts.
 *
 * Field ids were extracted from the official fillable PDF (CDSS CF 285 (8/21),
 * https://cdss.ca.gov/Portals/9/Additional-Resources/Forms-and-Brochures/2020/A-D/CF285.pdf)
 * and verified visually against the rendered pages. Ids contain TWO spaces.
 */
import type { HouseholdProfile } from '../contracts.ts';

export type Cf285Fill = {
  text: Record<string, string>; // field id → value
  check: string[]; // checkbox field ids to check
  filled: Record<string, string>; // human-readable label → value (for FilledApplication.fields)
  blankFields: string[]; // required items the human must complete
  notes: string[];
};

const LANGUAGES: Record<string, string> = {
  es: 'Spanish', zh: 'Chinese', vi: 'Vietnamese', tl: 'Tagalog', ru: 'Russian', ko: 'Korean',
};

export const CF285 = {
  langRead: 'CF 285  22',
  langSpeak: 'CF 285  23',
  unearnedYes: 'CF 285  219',
  unearnedNo: 'CF 285  220',
  unearnedRow1Amount: 'CF 285  245',
  unearnedRow1Freq: 'CF 285  246',
  earnedYes: 'CF 285  269',
  earnedNo: 'CF 285  270',
  earnedRow1Freq: 'CF 285  276',
  earnedRow1MonthTotal: 'CF 285  277',
  careYes: 'CF 285  355',
  careNo: 'CF 285  356',
  careRow1Amount: 'CF 285  359',
  careRow1Freq: 'CF 285  360',
  expensesYes: 'CF 285  393',
  rentYes: 'CF 285  395',
  rentAmount: 'CF 285  398',
  rentFreq: 'CF 285  399',
  utilitiesYes: 'CF 285  408', // gas/electric/fuel row; amount cell is a set allowance (no field on the form)
  utilitiesFreq: 'CF 285  411',
} as const;

const usd = (n: number) => n.toFixed(2).replace(/\.00$/, '');

export function mapProfileToCf285(p: HouseholdProfile): Cf285Fill {
  const text: Record<string, string> = {};
  const check: string[] = [];
  const filled: Record<string, string> = {};
  const notes: string[] = [];

  // Identity and household items the profile does not carry — the human completes these.
  const blankFields = [
    'Name (first, middle, last) — question 1',
    'Social Security Number(s)',
    'Home address, city, state, ZIP',
    'Phone / email contact information',
    'Household members table (names, birthdates, relationships) — question 3',
    'Citizenship/immigration documentation section',
    'Signature and date (page 1) — MUST be signed by the applicant, never by this system',
  ];

  // Preferred language (form asks only "if not English").
  if (p.preferredLanguage && p.preferredLanguage !== 'en') {
    const lang = LANGUAGES[p.preferredLanguage] ?? p.preferredLanguage;
    text[CF285.langRead] = lang;
    text[CF285.langSpeak] = lang;
    filled['Preferred language to read/speak'] = lang;
  }

  // §8 Earned income.
  if (p.earnedIncome != null) {
    if (p.earnedIncome > 0) {
      check.push(CF285.earnedYes);
      text[CF285.earnedRow1MonthTotal] = usd(p.earnedIncome);
      text[CF285.earnedRow1Freq] = 'Monthly';
      filled['§8 Earned income — total gross this month'] = `$${usd(p.earnedIncome)} (Monthly)`;
      blankFields.push('§8 row 1: person working + employer name/address (not collected)');
    } else {
      check.push(CF285.earnedNo);
      filled['§8 Earned income'] = 'No';
    }
  } else {
    blankFields.push('§8 Earned income (earned/unearned split unknown)');
  }

  // §7 Unearned income = stated gross − earned (only when both are known).
  if (p.earnedIncome != null) {
    const unearned = Math.max(0, p.monthlyGrossIncome - p.earnedIncome);
    if (unearned > 0) {
      check.push(CF285.unearnedYes);
      text[CF285.unearnedRow1Amount] = usd(unearned);
      text[CF285.unearnedRow1Freq] = 'Monthly';
      filled['§7 Unearned income — amount'] = `$${usd(unearned)} (Monthly)`;
      blankFields.push('§7 row 1: person receiving + source of the unearned income (not collected)');
    } else {
      check.push(CF285.unearnedNo);
      filled['§7 Unearned income'] = 'No';
    }
  }

  // §9 Child/adult care expenses.
  if (p.dependentCareCost != null) {
    if (p.dependentCareCost > 0) {
      check.push(CF285.careYes);
      text[CF285.careRow1Amount] = usd(p.dependentCareCost);
      text[CF285.careRow1Freq] = 'Monthly';
      filled['§9 Child/adult care — amount paid'] = `$${usd(p.dependentCareCost)} (Monthly)`;
      blankFields.push('§9 row 1: who gets care / who gives care (not collected)');
    } else {
      check.push(CF285.careNo);
      filled['§9 Child/adult care expenses'] = 'No';
    }
  }

  // §11 Household expenses — rent + utilities.
  const hasRent = p.isRenter && p.monthlyRent != null;
  const hasUtilities = p.monthlyUtilities != null && p.monthlyUtilities > 0;
  if (hasRent || hasUtilities) {
    check.push(CF285.expensesYes);
    filled['§11 Household expenses'] = 'Yes';
  }
  if (hasRent) {
    check.push(CF285.rentYes);
    text[CF285.rentAmount] = usd(p.monthlyRent!);
    text[CF285.rentFreq] = 'Monthly';
    filled['§11 Rent — amount owed'] = `$${usd(p.monthlyRent!)} (Monthly)`;
    blankFields.push('§11 rent row: who pays (not collected — likely the applicant)');
  } else if (p.isRenter) {
    blankFields.push('§11 Rent amount (renter, but rent amount not collected)');
  }
  if (hasUtilities) {
    check.push(CF285.utilitiesYes);
    text[CF285.utilitiesFreq] = 'Monthly';
    filled['§11 Utilities (gas/electric/fuel)'] = 'Yes (Monthly)';
    notes.push(
      `Utility costs stated as $${usd(p.monthlyUtilities!)}/mo; the CF 285 uses set utility allowances so the form intentionally has no amount cell for this row.`,
    );
  }

  notes.push('This application was prepared, not submitted. Review every field; complete the blank items; you sign and submit it yourself.');
  return { text, check, filled, blankFields, notes };
}
