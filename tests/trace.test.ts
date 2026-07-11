import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { buildMockApp } from '../src/mock-screen.ts';

describe('trace wiring — a request emits a trace', () => {
  it('POST /screen writes a trace with a profile hash and no raw household data', async () => {
    const app = buildMockApp();
    const res = await app.inject({
      method: 'POST',
      url: '/screen',
      payload: {
        householdSize: 2,
        monthlyGrossIncome: 2800,
        earnedIncome: 2800,
        hasChildren: true,
        hasElderlyOrDisabled: false,
        isRenter: true,
        countyFips: '06075',
        preferredLanguage: 'en',
      },
    });
    expect(res.statusCode).toBe(200);

    // The handler writes traces/screen-<ts>.json synchronously before replying.
    const traceDir = new URL('../traces/', import.meta.url);
    expect(existsSync(traceDir)).toBe(true);
    const { readdirSync } = await import('node:fs');
    const files = readdirSync(traceDir).filter((f) => f.startsWith('screen-'));
    expect(files.length).toBeGreaterThan(0);
    const latest = files.sort().at(-1)!;
    const trace = JSON.parse(readFileSync(new URL(latest, traceDir), 'utf8'));
    expect(trace.kind).toBe('screen');
    expect(trace.profile).toBeUndefined();
    expect(trace.profileHash).toMatch(/^[a-f0-9]{64}$/);
    expect(trace.outcomes[0].program).toBeDefined();
    expect(JSON.stringify(trace)).not.toContain('monthlyGrossIncome');
  });
});
