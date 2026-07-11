// Mirrors src/contracts.ts on the backend (Person B owns the shapes).
export type ScreeningResult = {
  program: string;
  screening: 'likely_qualify' | 'need_more_info' | 'unlikely';
  estimatedBenefit: { amount: number | { low: number; high: number }; period: 'monthly' | 'annual' | 'one_time' } | null;
  computation: { label: string; value: number }[];
  assumptions: string[];
  reason: string;
  citations: { text: string; source_url: string; as_of: string }[];
  applyUrl: string;
  disclaimer: string;
  data_freshness?: 'live' | 'cached';
  dataVersion?: number;
};

export type NullableProfile = Record<string, unknown>;

export type ChatResponse = {
  profile: NullableProfile | null;
  results: ScreeningResult[] | null;
  explanation: string | null;
  guard: { rewritten: boolean; disclaimerAppended: boolean } | null;
  needMoreInfo: string[] | null;
  agentLayer: 'live' | 'unconfigured';
};

export type FilledApplication = {
  program: string;
  fields: Record<string, string>;
  pdfUrl: string;
  status: 'draft' | 'ready_for_review' | 'staged_awaiting_user_submit';
  blankFields?: string[];
  notes?: string[];
};

export type AdversarialResult = { mode: string; prompt: string; before: string; after: string; guard: { rewritten: boolean } };
