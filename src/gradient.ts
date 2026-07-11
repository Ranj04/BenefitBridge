/**
 * Gradient (DigitalOcean GenAI) client factory + small helpers.
 * Token comes from DO_API_TOKEN (env) — mapped to the SDK's `accessToken`.
 */
import Gradient from '@digitalocean/gradient';
import { requireEnv } from './config.ts';

export function makeClient(): Gradient {
  return new Gradient({ accessToken: requireEnv('DO_API_TOKEN') });
}

/**
 * A client bound to a deployed agent's endpoint + key, used to INVOKE the agent
 * via the OpenAI-compatible chat.completions surface (how the frontend calls the router).
 */
export function makeAgentClient(agentEndpoint: string, agentAccessKey: string): Gradient {
  const base = agentEndpoint.replace(/\/$/, '');
  return new Gradient({
    agentAccessKey,
    baseURL: `${base}/api/v1`,
    // The agents run a reasoning model — a single completion can take 30s+.
    // Raise the per-request timeout well above the SDK default so invokes don't abort.
    timeout: 120_000,
  });
}

/** Best-effort: pull a UUID off a create/list response regardless of nesting. */
export function pickUuid(obj: unknown): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const o = obj as Record<string, any>;
  return o.uuid ?? o.agent?.uuid ?? o.knowledge_base?.uuid ?? o.id ?? undefined;
}
