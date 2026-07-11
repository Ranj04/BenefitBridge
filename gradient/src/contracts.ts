// Shared contract with Person B (Prompt 1) — DO NOT change unilaterally.
// Person B owns the ScreeningResult response shape; this copy exists so the
// Gradient graph and the mock build in parallel before B's /screen is live.

export type HouseholdProfile = {
  householdSize: number;
  monthlyGrossIncome: number; // USD, boundary layer only
  earnedIncome: number; // USD portion that is earned (for the 20% deduction)
  hasChildren: boolean;
  childrenAges?: number[];
  hasElderlyOrDisabled: boolean;
  isRenter: boolean;
  monthlyRent?: number;
  monthlyUtilities?: number;
  dependentCareCost?: number;
  medicalExpenses?: number; // elderly/disabled only
  countyFips: string; // "06075" = SF
  immigrationStatus?: 'citizen' | 'lpr' | 'other';
  preferredLanguage: string;
};

export type Citation = { text: string; source_url: string; as_of: string };

export type ScreeningResult = {
  program: string; // "CalFresh"
  screening: 'likely_qualify' | 'need_more_info' | 'unlikely';
  estimatedBenefit:
    | {
        amount: number | { low: number; high: number };
        period: 'monthly' | 'annual' | 'one_time';
      }
    | null;
  computation: { label: string; value: number }[]; // the full shown cascade, USD
  assumptions: string[];
  reason: string;
  citations: Citation[];
  applyUrl: string;
  disclaimer: string;
};

// POST /screen  body: HouseholdProfile  →  ScreeningResult[]
