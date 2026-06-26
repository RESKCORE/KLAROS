import { z } from 'zod';

export const ComparisonTripleSchema = z.tuple([z.number(), z.number(), z.number()]);

// Schema for raw LLM MCDA response (before post-processing)
// The LLM now outputs pairwise comparisons instead of guessed weights/scores.
// The AHP math engine converts these comparisons into rigorous weights and scores.
export const McdaRawResponseSchema = z.object({
  title: z.string().optional().catch(undefined),
  context: z.string().optional().catch(undefined),
  options: z.array(z.object({
    id: z.string(),
    label: z.string(),
    description: z.string().optional(),
  })).optional().catch(undefined),
  criteria: z.array(z.object({
    id: z.string(),
    name: z.string(),
    weight: z.number().optional(),
  })).optional().catch(undefined),
  // AHP pairwise comparisons using Saaty's 1-9 scale
  criteriaComparisons: ComparisonTripleSchema.optional().catch(undefined),
  optionComparisons: z.array(ComparisonTripleSchema).optional().catch(undefined),
  recommendation: z.string().optional().catch(undefined),
  confidence: z.number().min(0).max(100).optional().catch(undefined),
  reasoning: z.object({
    decomposition: z.string(),
    assumptions: z.array(z.string()),
    tradeoffs: z.array(z.string()),
    risks: z.array(z.string()),
    sensitivity: z.string(),
  }).optional().catch(undefined),
  scores: z.array(z.record(z.union([z.string(), z.number()]))).optional().catch(undefined),
});

export type McdaRawResponse = z.infer<typeof McdaRawResponseSchema>;

// Schema for structured AI output
export const AnalysisResultSchema = z.object({
  recommendation: z.object({
    optionId: z.string().describe('ID of the recommended option'),
    optionLabel: z.string().describe('Label of the recommended option'),
    confidence: z.number().min(0).max(100).describe('Confidence score 0-100'),
    summary: z.string().describe('2-3 sentence explanation of why this option is recommended'),
  }),
  scores: z.array(z.object({
    optionId: z.string(),
    optionLabel: z.string(),
    totalScore: z.number().describe('Weighted total score out of 100'),
    criteriaScores: z.array(z.object({
      criterionId: z.string(),
      criterionName: z.string(),
      score: z.number().min(1).max(10).describe('Score on this criterion (1-10)'),
    })),
  })).describe('Scores for all options'),
  reasoning: z.object({
    decomposition: z.string().describe('How you broke down and analyzed this decision'),
    assumptions: z.array(z.string()).describe('Key assumptions you made during analysis'),
    tradeoffs: z.array(z.string()).describe('Important tradeoffs between options'),
    risks: z.array(z.string()).describe('Potential risks or uncertainties'),
    sensitivity: z.string().describe('How sensitive is the recommendation to weight changes'),
  }),
});

export type AnalysisResultType = z.infer<typeof AnalysisResultSchema>;
