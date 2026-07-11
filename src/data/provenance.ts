// src/data/provenance.ts
// Provenance stamps make every constant traceable: which official source,
// what date it's effective for, when we fetched it, and a checksum to detect drift.
// This is the layer that distinguishes a validated data pipeline from "an LLM read a webpage."

import { createHash } from "node:crypto";

export type Provenance = {
  source_url: string; // the exact official endpoint/page the value came from
  as_of: string; // ISO date the underlying data is effective for (e.g. "2026")
  fetched_at: string; // ISO timestamp we fetched it
  checksum: string; // sha256 (truncated) of the canonical value, for drift detection
};

export function checksum(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

export function stamp(source_url: string, as_of: string, value: unknown): Provenance {
  return {
    source_url,
    as_of,
    fetched_at: new Date().toISOString(),
    checksum: checksum(value),
  };
}
