/** TEMP — test Food agent function route execution on GPT-4o. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeAgentClient } from '../src/gradient.ts';

const state = JSON.parse(readFileSync(fileURLToPath(new URL('../.gradient-state.json', import.meta.url)), 'utf8'));
const profile = {
  householdSize: 2,
  monthlyGrossIncome: 2800,
  earnedIncome: 2800,
  hasChildren: true,
  childrenAges: null,
  hasElderlyOrDisabled: false,
  isRenter: true,
  monthlyRent: 1900,
  monthlyUtilities: null,
  dependentCareCost: null,
  medicalExpenses: null,
  countyFips: '06075',
  immigrationStatus: null,
  preferredLanguage: 'en',
};

async function main() {
  const client = makeAgentClient(state.foodEndpoint, state.foodAgentKey);
  const res: any = await client.agents.chat.completions.create({
    messages: [
      {
        role: 'user',
        content: `HouseholdProfile JSON — invoke screen_calfresh immediately, then explain the result with disclaimer and citation URLs:\n${JSON.stringify(profile)}`,
      },
    ],
    stream: false,
  } as any);
  console.log(JSON.stringify(res, null, 2));
}
main().catch((e) => {
  console.error('ERROR', e?.error?.message ?? e?.message ?? e);
  process.exit(1);
});
