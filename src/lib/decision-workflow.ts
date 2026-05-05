import type { AnalysisResult, Decision } from '@/types/decision';

type DecisionLike = Decision | null | undefined;

export function isV2Decision(decision: DecisionLike): boolean {
  if (!decision) {
    return false;
  }

  if (decision.decision_type === 'business_intelligence') {
    return true;
  }

  return Boolean(decision.data_source_id);
}

export function getDecisionResult(decision: DecisionLike): AnalysisResult | null {
  if (!decision) {
    return null;
  }

  if (decision.result_json) {
    return decision.result_json;
  }

  return null;
}
