/**
 * Audit trace emitter. Household inputs are represented only by a one-way
 * hash; traces never persist raw profile or immigration/income data.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TRACES_DIR = new URL('../traces/', import.meta.url);

/** Generic audit event: keep proof that an event happened without retaining its payload. */
export function writeTrace(kind: string, payload: Record<string, unknown>): string {
  mkdirSync(TRACES_DIR, { recursive: true });
  const file = new URL(`${kind}-${Date.now()}.json`, TRACES_DIR);
  const payloadHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  writeFileSync(file, JSON.stringify({ kind, capturedAt: new Date().toISOString(), payloadHash }, null, 2));
  return fileURLToPath(file);
}

export function writeScreenTrace(
  profile: unknown,
  results: Array<{ program: string; screening: string }>,
  mock: boolean,
): string {
  mkdirSync(TRACES_DIR, { recursive: true });
  const file = new URL(`screen-${Date.now()}.json`, TRACES_DIR);
  const profileHash = createHash('sha256').update(JSON.stringify(profile)).digest('hex');
  const outcomes = results.map(({ program, screening }) => ({ program, screening }));
  writeFileSync(file, JSON.stringify({ kind: 'screen', capturedAt: new Date().toISOString(), profileHash, outcomes, mock }, null, 2));
  return fileURLToPath(file);
}
