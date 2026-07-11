// src/data/povertyGuidelines.ts
// Live client for the OFFICIAL HHS ASPE Poverty Guidelines API.
//
// Endpoint: https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines/api/[YEAR]/[STATE]/[HOUSEHOLD_SIZE]
// Response:  { "data": { "year": 2026, "state": "us", "household_size": 4, "poverty_threshold": 32150 }, "method": "GET", "status": 200 }
// `poverty_threshold` is the ANNUAL federal poverty guideline in whole USD.
//
// This is the structured, official source that replaces HTML scraping. The FPL basis
// is fetched live; program thresholds are derived from it (see fplRules.ts).
// Valid years: 1983..current. Valid states: 'us' | 'hi' | 'ak'. Valid sizes: 1..8.
// For sizes > 8, HHS defines the guideline as size-8 plus a per-additional-person
// increment; we compute that increment from the live (7,8) values rather than hardcoding it.

const BASE =
  "https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines/api";

const TIMEOUT_MS = 8000;

export type FplState = "us" | "hi" | "ak";

export type PovertyGuideline = {
  year: number;
  state: FplState;
  householdSize: number;
  annualUsd: number; // whole dollars, as published by HHS
};

async function getRaw(year: number, state: FplState, size: number): Promise<number> {
  const url = `${BASE}/${year}/${state}/${size}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`ASPE API ${res.status} for ${url}`);
    const json = (await res.json()) as {
      data?: { poverty_threshold?: number | string; income?: number | string };
      status?: number;
    };
    // Live 2026 API returns { data: { income: "44360" } } (string); older docs
    // describe { data: { poverty_threshold: <number> } }. Accept both, strictly.
    const raw = json?.data?.income ?? json?.data?.poverty_threshold;
    const val = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
    if (typeof val !== "number" || !Number.isFinite(val) || val <= 0) {
      throw new Error(
        `ASPE API returned no valid income/poverty_threshold for ${url}: ${JSON.stringify(json)}`
      );
    }
    return Math.round(val); // whole dollars
  } finally {
    clearTimeout(timer);
  }
}

/** Live annual FPL for a single household size (with >8 extrapolation per HHS method). */
export async function getAnnualFpl(
  year: number,
  state: FplState,
  householdSize: number
): Promise<PovertyGuideline> {
  if (!Number.isInteger(householdSize) || householdSize < 1) {
    throw new Error(`householdSize must be an integer >= 1, got ${householdSize}`);
  }
  if (householdSize <= 8) {
    const annualUsd = await getRaw(year, state, householdSize);
    return { year, state, householdSize, annualUsd };
  }
  const [g7, g8] = await Promise.all([getRaw(year, state, 7), getRaw(year, state, 8)]);
  const increment = g8 - g7;
  if (increment <= 0) {
    throw new Error(`Non-positive FPL increment (${increment}); refusing to extrapolate size ${householdSize}`);
  }
  const annualUsd = g8 + increment * (householdSize - 8);
  return { year, state, householdSize, annualUsd };
}

/** Fetch guidelines for sizes 1..maxSize — used by the sync job. */
export async function getAnnualFplTable(
  year: number,
  state: FplState,
  maxSize = 8
): Promise<PovertyGuideline[]> {
  const sizes = Array.from({ length: maxSize }, (_, i) => i + 1);
  return Promise.all(sizes.map((s) => getAnnualFpl(year, state, s)));
}
