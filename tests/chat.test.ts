import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildServer } from '../src/server.ts';
import { parseProfileJson, completeProfile, runChat } from '../src/chat.ts';
import { resetDataCache } from '../src/data/runtime.ts';

const INTAKE_JSON = `{"householdSize":2,"monthlyGrossIncome":2800,"earnedIncome":2800,"hasChildren":true,"childrenAges":null,"hasElderlyOrDisabled":null,"isRenter":true,"monthlyRent":1800,"monthlyUtilities":null,"dependentCareCost":null,"medicalExpenses":null,"countyFips":"06075","immigrationStatus":null,"preferredLanguage":"en"}`;

beforeEach(() => {
  resetDataCache();
  delete process.env.AGENT_INTAKE_URL;
  delete process.env.AGENT_INTAKE_KEY;
  delete process.env.AGENT_FOOD_URL;
  delete process.env.AGENT_FOOD_KEY;
});
afterEach(() => vi.unstubAllGlobals());

describe('POST /chat', () => {
  it('no agent env → 503 with a clear reason, not a crash', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('no network'); }));
    const res = await buildServer().inject({ method: 'POST', url: '/chat', payload: { text: 'single mom in SF' } });
    expect(res.statusCode).toBe(503);
    expect(res.json().code).toBe('agent_unconfigured');
    expect(res.json().agentLayer).toBe('unconfigured');
  });

  it('empty body → 400', async () => {
    const res = await buildServer().inject({ method: 'POST', url: '/chat', payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it('full path with mocked agents: profile → results → guarded explanation', async () => {
    process.env.AGENT_INTAKE_URL = 'https://intake.example';
    process.env.AGENT_INTAKE_KEY = 'k1';
    process.env.AGENT_FOOD_URL = 'https://food.example';
    process.env.AGENT_FOOD_KEY = 'k2';
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.startsWith('https://intake.example')) {
        return Response.json({ choices: [{ message: { content: INTAKE_JSON } }] });
      }
      if (url.startsWith('https://food.example')) {
        return Response.json({ choices: [{ message: { content: 'You are guaranteed $159 every month!' } }] });
      }
      throw new Error(`unexpected fetch ${url}`); // data layer falls back to last-good store
    }));

    const res = await buildServer().inject({ method: 'POST', url: '/chat', payload: { text: 'single mom in SF, $2,800 a month, one kid, renting for $1,800' } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.profile.householdSize).toBe(2);
    expect(body.results.length).toBeGreaterThanOrEqual(5);
    const calfresh = body.results.find((r: { program: string }) => r.program === 'CalFresh');
    expect(calfresh.screening).toBe('likely_qualify');
    // The model tried to guarantee — the code guard rewrote it:
    expect(body.guard.rewritten).toBe(true);
    expect(body.explanation).not.toMatch(/guaranteed/i);
    expect(body.explanation).toMatch(/estimated/i);
  });

  it('missing income from intake → needMoreInfo, no invented screen', async () => {
    process.env.AGENT_INTAKE_URL = 'https://intake.example';
    process.env.AGENT_INTAKE_KEY = 'k1';
    vi.stubGlobal('fetch', vi.fn(async () =>
      Response.json({ choices: [{ message: { content: INTAKE_JSON.replace('"monthlyGrossIncome":2800', '"monthlyGrossIncome":null') } }] }),
    ));
    const res = await buildServer().inject({ method: 'POST', url: '/chat', payload: { text: 'I have two kids and rent is high' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().needMoreInfo).toEqual(['monthlyGrossIncome']);
    expect(res.json().results).toBeNull();
  });
});

describe('chat helpers', () => {
  it('parseProfileJson strips fences and prose', () => {
    const p = parseProfileJson('Here you go:\n```json\n' + INTAKE_JSON + '\n```\nDone.');
    expect(p.householdSize).toBe(2);
  });
  it('completeProfile surfaces every coercion as an assumption', () => {
    const done = completeProfile(JSON.parse(INTAKE_JSON));
    if ('missing' in done) throw new Error('unexpected');
    expect(done.assumptions.join(' ')).toMatch(/elderly/);
    expect(done.profile.hasElderlyOrDisabled).toBe(false);
  });
});

describe('POST /adversarial-test (Verification Console button)', () => {
  it('without agents: the code guard rewrites the raw injection', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('no network'); }));
    const res = await buildServer().inject({ method: 'POST', url: '/adversarial-test', payload: {} });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.mode).toBe('code-guard-only');
    expect(body.before).toMatch(/guaranteed \$5,000/);
    expect(body.after).not.toMatch(/guaranteed/i);
    expect(body.after).toMatch(/Estimate, not a determination/);
  });
});
