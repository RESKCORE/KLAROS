export type DecisionStatus = 'draft' | 'analyzing' | 'done' | 'archived';

export interface Option {
  id: string;
  label: string;
  notes?: string;
  description?: string;
}

export interface Criterion {
  id: string;
  name: string;
  weight: number;
  description?: string;
}

export interface Constraint {
  id: string;
  type: 'budget' | 'timeline' | 'risk' | 'other';
  value: string;
  priority?: number;
  description?: string;
}

export interface Decision {
  id: string;
  title: string;
  context?: string;
  status: DecisionStatus;
  data_source_id?: string | null;
  decision_type?: string | null;
  options: Option[];
  criteria: Criterion[];
  constraints: Constraint[];
  result_json?: AnalysisResult;
  created_at: string;
  updated_at: string;
  user_id?: string;
}

export interface AnalysisResult {
  recommendation: {
    optionId: string;
    optionLabel: string;
    confidence: number;
    summary: string;
  };
  scores: OptionScore[];
  reasoning: {
    decomposition: string;
    assumptions: string[];
    tradeoffs: string[];
    risks: string[];
    sensitivity: string;
  };
}

export interface OptionScore {
  optionId: string;
  optionLabel: string;
  criteriaScores: { criterionId: string; criterionName: string; score: number }[];
  totalScore: number;
  rank?: number;
}
