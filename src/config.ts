/**
 * Central config + secrets loading. Secrets come from env only — never hardcode.
 * Uses Node 22's built-in .env loader (no dotenv dependency).
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, '..', '.env');
if (existsSync(envPath)) {
  // process.loadEnvFile is available in Node >= 20.12 / 22.
  process.loadEnvFile(envPath);
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(
      `Missing required env var ${name}. Copy .env.example to .env and fill it in (see README-personA.md).`,
    );
  }
  return v.trim();
}

export const config = {
  /** Present only when needed by a script; read lazily via requireEnv there. */
  region: process.env.DO_REGION?.trim() || 'tor1',
  projectId: process.env.DO_PROJECT_ID?.trim() || undefined,
  /** Falls back to the local mock so the graph is buildable before Person B deploys. */
  screenUrl: process.env.SCREEN_URL?.trim() || 'http://localhost:8787/screen',
  mockPort: Number(process.env.MOCK_PORT ?? 8787),
};

/** Stable names so provisioning is idempotent (reconcile-by-name, never duplicate). */
export const RESOURCE_NAMES = {
  intakeAgent: 'bb-intake-agent',
  foodAgent: 'bb-food-calfresh-agent',
  routerAgent: 'bb-router-agent',
  foodKB: 'bb-kb-food-calfresh',
  screenFunction: 'screen_calfresh',
} as const;
