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

/** Fetch the default DO project id when DO_PROJECT_ID is unset (required by some GenAI creates). */
export async function resolveProjectId(): Promise<string | undefined> {
  const fromEnv = process.env.DO_PROJECT_ID?.trim();
  if (fromEnv) return fromEnv;

  const res = await fetch('https://api.digitalocean.com/v2/projects', {
    headers: { Authorization: `Bearer ${requireEnv('DO_API_TOKEN')}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return undefined;
  const data = (await res.json()) as { projects?: Array<{ id: string; is_default?: boolean }> };
  const projects = data.projects ?? [];
  return (projects.find((p) => p.is_default) ?? projects[0])?.id;
}

export const config = {
  /** Present only when needed by a script; read lazily via requireEnv there. */
  region: process.env.DO_REGION?.trim() || 'tor1',
  projectId: process.env.DO_PROJECT_ID?.trim() || undefined,
  /** Live Person B /screen on App Platform (Phase A3). Override with SCREEN_URL in .env. */
  screenUrl:
    process.env.SCREEN_URL?.trim() || 'https://benefitbridge-screen-eh945.ondigitalocean.app/screen',
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
