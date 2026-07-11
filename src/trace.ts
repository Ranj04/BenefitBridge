/**
 * Trace emitter — every graph request writes a JSON trace under traces/ so
 * gates, the Verification Console (Prompt 5), and judges can replay exactly
 * what happened. Ported from feat/p2-gradient-graph (run-graph.ts save()).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TRACES_DIR = new URL('../traces/', import.meta.url);

export function writeTrace(kind: string, payload: Record<string, unknown>): string {
  mkdirSync(TRACES_DIR, { recursive: true });
  const file = new URL(`${kind}-${Date.now()}.json`, TRACES_DIR);
  writeFileSync(file, JSON.stringify({ kind, capturedAt: new Date().toISOString(), ...payload }, null, 2));
  return fileURLToPath(file);
}
