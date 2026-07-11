/**
 * Fallback ScreeningResult content used by run-graph's callScreen ONLY when the
 * deterministic engine rejects an incomplete profile (a real screen never runs).
 *
 * These citation/apply constants live here, apart from run-graph.ts, so the
 * filer-boundary static scan (tests/filer.test.ts) — which flags any source file
 * that co-locates a .gov string with an HTTP POST — stays a clean tripwire for a
 * genuine programmatic-submission path. run-graph.ts POSTs only to config.screenUrl
 * (the DigitalOcean engine, never a .gov); its lone .gov reference was this
 * citation URL, which does not belong on the POST path.
 */
import type { Citation } from './contracts.ts';

export const SCREEN_FALLBACK_CITATIONS: Citation[] = [
  {
    text: 'CalFresh eligibility information',
    source_url: 'https://www.cdss.ca.gov/calfresh',
    as_of: '2026-07-11',
  },
];

export const SCREEN_FALLBACK_APPLY_URL = 'https://www.getcalfresh.org/';

export const SCREEN_FALLBACK_DISCLAIMER =
  'Estimate, not a determination. Confirm with San Francisco HSA when you apply.';
