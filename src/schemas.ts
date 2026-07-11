/**
 * JSON Schemas for the Gradient function route, so the Food agent knows how to
 * call /screen and how to read its response. Mirrors src/contracts.ts.
 */

export const HouseholdProfileJsonSchema = {
  type: 'object',
  required: ['householdSize', 'monthlyGrossIncome', 'earnedIncome', 'countyFips', 'preferredLanguage'],
  properties: {
    householdSize: { type: 'integer', minimum: 1 },
    monthlyGrossIncome: { type: 'number', minimum: 0 },
    earnedIncome: { type: 'number', minimum: 0 },
    hasChildren: { type: 'boolean' },
    childrenAges: { type: 'array', items: { type: 'integer' } },
    hasElderlyOrDisabled: { type: 'boolean' },
    isRenter: { type: 'boolean' },
    monthlyRent: { type: 'number', minimum: 0 },
    monthlyUtilities: { type: 'number', minimum: 0 },
    dependentCareCost: { type: 'number', minimum: 0 },
    medicalExpenses: { type: 'number', minimum: 0 },
    countyFips: { type: 'string' },
    immigrationStatus: { type: 'string', enum: ['citizen', 'lpr', 'other'] },
    preferredLanguage: { type: 'string' },
  },
} as const;

const ScreeningResultJsonSchema = {
  type: 'object',
  properties: {
    program: { type: 'string' },
    screening: { type: 'string', enum: ['likely_qualify', 'need_more_info', 'unlikely'] },
    estimatedBenefit: {
      type: ['object', 'null'],
      properties: {
        amount: {},
        period: { type: 'string', enum: ['monthly', 'annual', 'one_time'] },
      },
    },
    computation: {
      type: 'array',
      items: { type: 'object', properties: { label: { type: 'string' }, value: { type: 'number' } } },
    },
    assumptions: { type: 'array', items: { type: 'string' } },
    reason: { type: 'string' },
    citations: {
      type: 'array',
      items: {
        type: 'object',
        properties: { text: { type: 'string' }, source_url: { type: 'string' }, as_of: { type: 'string' } },
      },
    },
    applyUrl: { type: 'string' },
    disclaimer: { type: 'string' },
  },
} as const;

export const ScreeningResultArrayJsonSchema = {
  type: 'array',
  items: ScreeningResultJsonSchema,
} as const;
