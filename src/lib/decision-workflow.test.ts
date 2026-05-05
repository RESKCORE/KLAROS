import { describe, expect, it } from 'vitest';
import { getDecisionResult, isV2Decision } from '@/lib/decision-workflow';
import type { Decision } from '@/types/decision';

function makeDecision(overrides: Partial<Decision> = {}): Decision {
  return {
    id: 'd-1',
    title: 'Test decision',
    status: 'done',
    data_source_id: null,
    decision_type: null,
    options: [],
    criteria: [],
    constraints: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('decision workflow helpers', () => {
  it('identifies V2 by data_source_id', () => {
    const decision = makeDecision({ data_source_id: 'src-1' });
    expect(isV2Decision(decision)).toBe(true);
  });

  it('identifies V2 by decision_type', () => {
    const decision = makeDecision({ decision_type: 'business_intelligence' });
    expect(isV2Decision(decision)).toBe(true);
  });

  it('keeps V1 decisions as non-V2', () => {
    const decision = makeDecision({ data_source_id: null, decision_type: null });
    expect(isV2Decision(decision)).toBe(false);
  });

  it('returns result_json when analysis result exists', () => {
    const decision = makeDecision({
      result_json: {
        recommendation: {
          optionId: 'a',
          optionLabel: 'A',
          confidence: 0.9,
          summary: 'json',
        },
        scores: [],
        reasoning: {
          decomposition: 'd',
          assumptions: [],
          tradeoffs: [],
          risks: [],
          sensitivity: 's',
        },
      },
    });

    const result = getDecisionResult(decision);
    expect(result?.recommendation.optionId).toBe('a');
  });
});
