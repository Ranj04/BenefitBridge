// Chat client for deployed Gradient agents (OpenAI-compatible endpoint).
// Native fetch + AbortController per standing rules.

import { readFileSync } from 'node:fs';

type Resources = {
  kb: string;
  agents: Record<string, { uuid: string; endpoint: string | null; status: string | null }>;
};

export function loadResources(): Resources {
  return JSON.parse(readFileSync(new URL('../resources.json', import.meta.url), 'utf8'));
}

export function agentKey(envName: string): string {
  const v = process.env[envName];
  if (!v) {
    console.error(`${envName} is not set — add the agent access key to gradient/.env`);
    process.exit(1);
  }
  return v;
}

export async function chat(endpoint: string, key: string, content: string, timeoutMs = 90_000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${endpoint}/api/v1/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content }], stream: false }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`agent ${endpoint} → ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error(`agent ${endpoint} returned no content`);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

// Strip optional markdown fences and parse the first JSON object in a string.
export function parseJsonObject<T>(raw: string): T {
  const cleaned = raw.replace(/```(?:json)?/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error(`no JSON object in agent output: ${raw.slice(0, 200)}`);
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}
