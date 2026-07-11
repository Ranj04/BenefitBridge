/**
 * Shared HTTP contract with Person B's screening engine.
 * DO NOT change these shapes — Person B owns the `/screen` response.
 * Mirrors benefits-navigator-plan.md §9 and benefitbridge-claude-code-phase0-1.md.
 */

export type HouseholdProfile = {
  householdSize: number;
  monthlyGrossIncome: number;
  earnedIncome: number;
  hasChildren: boolean;
  childrenAges?: number[];
  hasElderlyOrDisabled: boolean;
  isRenter: boolean;
  monthlyRent?: number;
  monthlyUtilities?: number;
  dependentCareCost?: number;
  medicalExpenses?: number;
  countyFips: string; // "06075" = SF
  immigrationStatus?: 'citizen' | 'lpr' | 'other';
  preferredLanguage: string;
};

export type Citation = { text: string; source_url: string; as_of: string };

export type ScreeningResult = {
  program: string;
  screening: 'likely_qualify' | 'need_more_info' | 'unlikely';
  estimatedBenefit:
    | {
        amount: number | { low: number; high: number };
        period: 'monthly' | 'annual' | 'one_time';
      }
    | null;
  computation: { label: string; value: number }[];
  assumptions: string[];
  reason: string;
  citations: Citation[];
  applyUrl: string;
  disclaimer: string;
  // Optional, additive (Prompt 3.5): provenance of the live data layer behind
  // the thresholds. 'cached' = last-good versioned store served because the
  // live source was unreachable — never silently presented as live.
  data_freshness?: 'live' | 'cached';
  dataVersion?: number;
};

/**
 * The intake agent must emit EXACTLY this JSON shape (a HouseholdProfile).
 * Unstated fields are null — never guessed. Used to validate intake output.
 */
export const HOUSEHOLD_PROFILE_KEYS = [
  'householdSize',
  'monthlyGrossIncome',
  'earnedIncome',
  'hasChildren',
  'childrenAges',
  'hasElderlyOrDisabled',
  'isRenter',
  'monthlyRent',
  'monthlyUtilities',
  'dependentCareCost',
  'medicalExpenses',
  'countyFips',
  'immigrationStatus',
  'preferredLanguage',
] as const;
