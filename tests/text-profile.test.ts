import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildServer } from '../src/server.ts';
import { extractProfileFromText, extractMonthlyIncome, extractHouseholdSize, mergeProfiles } from '../src/text-profile.ts';
import { resetDataCache } from '../src/data/runtime.ts';

// The exact text a real user typed on the live site, typos and all. It states
// both required fields; the screener must never ask for them again.
const REAL_USER_TEXT = 'I make 3k month is my eanrings\n no kids no husband live in section A and need ways to get food only me in th house and';

describe('extractMonthlyIncome', () => {
  it('reads the shorthand people actually type', () => {
    expect(extractMonthlyIncome('I make 3k month is my eanrings')).toBe(3000);
    expect(extractMonthlyIncome('about $2,800 a month')).toBe(2800);
    expect(extractMonthlyIncome('$3,000/mo')).toBe(3000);
    expect(extractMonthlyIncome('2.5k a month')).toBe(2500);
    expect(extractMonthlyIncome('I earn 3000 per month')).toBe(3000);
  });

  it('normalizes non-monthly periods to a month', () => {
    expect(extractMonthlyIncome('I make $650 a week working full time')).toBe(2817); // 650 * 52 / 12
    expect(extractMonthlyIncome('$18 an hour')).toBe(3120); // 18 * 40 * 52 / 12
    expect(extractMonthlyIncome('45k a year')).toBe(3750);
    expect(extractMonthlyIncome('$1,200 biweekly')).toBe(2600); // 1200 * 26 / 12
  });

  it('never invents a number', () => {
    expect(extractMonthlyIncome('my rent is really high and I have two kids')).toBeNull();
    expect(extractMonthlyIncome('I need help with food')).toBeNull();
    expect(extractMonthlyIncome('I live in section 8 housing')).toBeNull();
  });

  it('refuses to guess the period on an ambiguous salary-sized figure', () => {
    // "$45,000" with no period could be annual; monthly would be a 12x error.
    expect(extractMonthlyIncome('I make $45,000')).toBeNull();
    // Small figure + earning verb is unambiguously a monthly wage.
    expect(extractMonthlyIncome('I make $3,000')).toBe(3000);
  });
});

describe('extractHouseholdSize', () => {
  it('reads "alone" however it is phrased', () => {
    expect(extractHouseholdSize('only me in th house')).toBe(1);
    expect(extractHouseholdSize('I live alone')).toBe(1);
    expect(extractHouseholdSize('just me')).toBe(1);
    expect(extractHouseholdSize('I stay by myself')).toBe(1);
  });

  it('reads explicit counts', () => {
    expect(extractHouseholdSize('family of 4')).toBe(4);
    expect(extractHouseholdSize('household of three')).toBe(3);
    expect(extractHouseholdSize('there are 5 people in the house')).toBe(5);
    expect(extractHouseholdSize('me and my 2 kids')).toBe(3);
    expect(extractHouseholdSize('just me and my son')).toBe(2);
  });

  it('reads the roster in whatever order it gets said', () => {
    // The live bug: stated as "N kids and myself", asked for household size anyway.
    expect(extractHouseholdSize('im a single dad i live with 3 kids and myself i make 5k a month')).toBe(4);
    expect(extractHouseholdSize('3 kids and myself')).toBe(4);
    expect(extractHouseholdSize('I live with my 2 kids')).toBe(3);
    expect(extractHouseholdSize('single mom with two kids')).toBe(3);
    expect(extractHouseholdSize('raising 3 kids on my own')).toBe(4);
    expect(extractHouseholdSize('i live with my mom and my 2 kids')).toBe(4);
  });

  it('does not let a run-on sentence pull in people who are not in the household', () => {
    // No period after the roster; the next clause must not be counted.
    expect(extractHouseholdSize('i live with my 2 kids i need to call my mom about it')).toBe(3);
  });

  it('reads "parent of N" — the parent is in the household too', () => {
    expect(extractHouseholdSize('single mother of 3')).toBe(4);
    expect(extractHouseholdSize('single dad of two')).toBe(3);
    expect(extractHouseholdSize('im a mother of 4')).toBe(5);
  });

  it('reads "I have N kids"', () => {
    expect(extractHouseholdSize('i have 3 kids')).toBe(4);
    expect(extractHouseholdSize('ive got 4 kids')).toBe(5);
    expect(extractHouseholdSize('i have two children and no husband')).toBe(3); // "no husband" counts nobody
  });

  it('reads a coordinated roster in any order, with or without commas', () => {
    expect(extractHouseholdSize('me, my wife, and our three kids')).toBe(5);
    expect(extractHouseholdSize('its me my mom and my 2 brothers')).toBe(4);
    expect(extractHouseholdSize('my husband and me')).toBe(2);
    expect(extractHouseholdSize('my wife and i and our 2 kids')).toBe(4);
    expect(extractHouseholdSize('2 adults and 3 children')).toBe(5);
  });

  it('counts the speaker once, however many times they name themselves', () => {
    expect(extractHouseholdSize('i live with 3 kids and myself')).toBe(4); // not 5
  });

  it('never invents a count it was not given', () => {
    // A plural with no number is a question, not a 1. Inventing a household
    // size invents a benefit amount.
    expect(extractHouseholdSize('i live with my kids')).toBeNull();
    expect(extractHouseholdSize('me and my children')).toBeNull();
    expect(extractHouseholdSize('i live with roommates')).toBeNull();
  });

  it('stays null when the text says nothing about who lives there', () => {
    expect(extractHouseholdSize('I make 3k a month and need food help')).toBeNull();
    expect(extractHouseholdSize('I need help with food')).toBeNull();
    expect(extractHouseholdSize('can you help me get groceries')).toBeNull(); // "me" is not a household
    expect(extractHouseholdSize('i have 2 jobs')).toBeNull(); // a count, but not of people
    expect(extractHouseholdSize('i need to call my mom about it')).toBeNull(); // a person, but not a roster
  });

  it('counts nobody for a negated roster', () => {
    expect(extractHouseholdSize('no kids no husband, only me in th house')).toBe(1);
  });
});

describe('extractProfileFromText on the real user text', () => {
  it('gets both required fields plus the stated booleans', () => {
    const p = extractProfileFromText(REAL_USER_TEXT);
    expect(p.householdSize).toBe(1);
    expect(p.monthlyGrossIncome).toBe(3000);
    expect(p.hasChildren).toBe(false); // "no kids"
    expect(p.monthlyRent).toBeUndefined(); // amount never stated → never guessed
  });
});

describe('mergeProfiles', () => {
  it('lets the agent win and only fills the holes it left', () => {
    const agent = { householdSize: 2, monthlyGrossIncome: null, countyFips: '06075', preferredLanguage: 'en' } as never;
    const { profile, assumptions } = mergeProfiles(agent, { householdSize: 1, monthlyGrossIncome: 3000 });
    expect(profile.householdSize).toBe(2); // agent value preserved
    expect(profile.monthlyGrossIncome).toBe(3000); // hole filled locally
    expect(assumptions.join(' ')).toMatch(/\$3000\/month/);
    expect(assumptions.join(' ')).not.toMatch(/household of/); // not filled → not read back
  });

  it('stands alone when the agent gave nothing', () => {
    const { profile } = mergeProfiles(null, extractProfileFromText(REAL_USER_TEXT));
    expect(profile.householdSize).toBe(1);
    expect(profile.monthlyGrossIncome).toBe(3000);
  });
});

describe('POST /chat resilience (the live bug)', () => {
  beforeEach(() => {
    resetDataCache();
    process.env.AGENT_INTAKE_URL = 'https://intake.example';
    process.env.AGENT_INTAKE_KEY = 'k1';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.AGENT_INTAKE_URL;
    delete process.env.AGENT_INTAKE_KEY;
  });

  it('intake agent returns prose → still screens from the text, no needMoreInfo', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      if (String(input).startsWith('https://intake.example')) {
        return Response.json({ choices: [{ message: { content: "I'm sorry, I can't help with that." } }] });
      }
      throw new Error('unexpected fetch'); // data layer falls back to last-good store
    }));

    const res = await buildServer().inject({ method: 'POST', url: '/chat', payload: { text: REAL_USER_TEXT } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.needMoreInfo).toBeNull();
    expect(body.profile.householdSize).toBe(1);
    expect(body.profile.monthlyGrossIncome).toBe(3000);
    expect(body.results.length).toBeGreaterThanOrEqual(1);
    const calfresh = body.results.find((r: { program: string }) => r.program === 'CalFresh');
    expect(calfresh.assumptions.join(' ')).toMatch(/read from what you wrote/);
  });

  it('intake agent times out → still screens from the text, no 502', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      if (String(input).startsWith('https://intake.example')) throw new Error('agent 504');
      throw new Error('unexpected fetch');
    }));

    const res = await buildServer().inject({ method: 'POST', url: '/chat', payload: { text: REAL_USER_TEXT } });
    expect(res.statusCode).toBe(200);
    expect(res.json().needMoreInfo).toBeNull();
    expect(res.json().profile.monthlyGrossIncome).toBe(3000);
  });

  it('single dad who stated household and income is never re-asked for either', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      if (String(input).startsWith('https://intake.example')) throw new Error('agent 504');
      throw new Error('unexpected fetch');
    }));

    const res = await buildServer().inject({
      method: 'POST',
      url: '/chat',
      payload: { text: 'im a single dad i live with 3 kids and myself i make 5k a month and i live in section a housing' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.needMoreInfo).toBeNull(); // was: ['householdSize']
    expect(body.profile.householdSize).toBe(4); // 3 kids + himself
    expect(body.profile.monthlyGrossIncome).toBe(5000);
    expect(body.profile.hasChildren).toBe(true);
  });

  it('text that truly says nothing → still asks, never invents', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      if (String(input).startsWith('https://intake.example')) return Response.json({ choices: [{ message: { content: 'no idea' } }] });
      throw new Error('unexpected fetch');
    }));

    const res = await buildServer().inject({ method: 'POST', url: '/chat', payload: { text: 'i need help getting food please' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().needMoreInfo).toEqual(['householdSize', 'monthlyGrossIncome']);
    expect(res.json().results).toBeNull();
  });
});
