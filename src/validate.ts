/**
 * Contract validators shared by the mock, the intake gate, and tests.
 * These enforce the load-bearing discipline: the model does language only, and
 * unstated fields are null — never guessed.
 */
import type { HouseholdProfile, ScreeningResult } from './contracts.ts';

export type ValidationResult = { ok: boolean; errors: string[] };

/**
 * Validate a raw object parsed from the intake agent against HouseholdProfile.
 * Intake emits null for unstated fields; we treat null/undefined as "absent" and
 * only type-check the values that ARE present. The two always-required identity
 * fields (countyFips, preferredLanguage) must be present.
 */
export function validateProfile(raw: unknown): ValidationResult {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: ['profile is not an object'] };
  }
  const p = raw as Record<string, unknown>;

  const num = (k: string) => {
    const v = p[k];
    if (v === null || v === undefined) return; // unstated is allowed
    if (typeof v !== 'number' || Number.isNaN(v)) errors.push(`${k} must be a number or null, got ${JSON.stringify(v)}`);
    else if (v < 0) errors.push(`${k} must be >= 0`);
  };
  const bool = (k: string) => {
    const v = p[k];
    if (v === null || v === undefined) return;
    if (typeof v !== 'boolean') errors.push(`${k} must be a boolean or null`);
  };

  ['householdSize', 'monthlyGrossIncome', 'earnedIncome', 'monthlyRent', 'monthlyUtilities', 'dependentCareCost', 'medicalExpenses'].forEach(num);
  ['hasChildren', 'hasElderlyOrDisabled', 'isRenter'].forEach(bool);

  if (p.householdSize !== null && p.householdSize !== undefined && (typeof p.householdSize !== 'number' || p.householdSize < 1)) {
    errors.push('householdSize, when present, must be an integer >= 1');
  }
  if (typeof p.countyFips !== 'string' || p.countyFips.length === 0) errors.push('countyFips is required (string)');
  if (typeof p.preferredLanguage !== 'string' || p.preferredLanguage.length === 0) errors.push('preferredLanguage is required (string)');
  if (p.immigrationStatus != null && !['citizen', 'lpr', 'other'].includes(p.immigrationStatus as string)) {
    errors.push("immigrationStatus must be 'citizen' | 'lpr' | 'other' | null");
  }
  if (p.childrenAges != null && !Array.isArray(p.childrenAges)) errors.push('childrenAges must be an array or null');

  return { ok: errors.length === 0, errors };
}

/** Structural guard for a ScreeningResult (used to check /screen and mock responses). */
export function validateScreeningResult(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const r = raw as Partial<ScreeningResult>;
  if (!r || typeof r !== 'object') return { ok: false, errors: ['result is not an object'] };
  if (typeof r.program !== 'string') errors.push('program must be a string');
  if (!['likely_qualify', 'need_more_info', 'unlikely'].includes(r.screening as string)) errors.push('screening must be one of the three enum values');
  if (!Array.isArray(r.computation)) errors.push('computation must be an array');
  if (!Array.isArray(r.assumptions)) errors.push('assumptions must be an array');
  if (!Array.isArray(r.citations)) errors.push('citations must be an array');
  if (typeof r.disclaimer !== 'string' || r.disclaimer.length === 0) errors.push('disclaimer must be a non-empty string');
  if (r.estimatedBenefit != null) {
    const b = r.estimatedBenefit;
    if (!['monthly', 'annual', 'one_time'].includes(b.period)) errors.push('estimatedBenefit.period invalid');
  }
  return { ok: errors.length === 0, errors };
}

export type { HouseholdProfile };
