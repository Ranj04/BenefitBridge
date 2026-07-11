// Thin REST client for the DigitalOcean API (Gradient / GenAI endpoints).
// Native fetch + AbortController per standing rules — no axios.
// Used where the DoTs SDK (@digitalocean/dots) doesn't cover an operation.

const BASE = 'https://api.digitalocean.com';

export function requireToken(): string {
  const token = process.env.DO_API_TOKEN;
  if (!token) {
    console.error(
      'DO_API_TOKEN is not set. Export a DigitalOcean API token with GenAI read/write scopes:\n' +
        '  export DO_API_TOKEN=dop_v1_...\n' +
        'Never hardcode or commit the token.',
    );
    process.exit(1);
  }
  return token;
}

export async function doFetch<T>(
  path: string,
  init: { method?: string; body?: unknown; timeoutMs?: number } = {},
): Promise<{ status: number; data: T }> {
  const token = requireToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 30_000);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    });
    const text = await res.text();
    const data = (text ? JSON.parse(text) : {}) as T;
    return { status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}
