import { z } from 'zod';

/**
 * @file analysis-schema.ts
 * @description Zod schemas for MCDA/AHP LLM responses.
 *
 * Hardening changes:
 *
 *  1. REMOVED PERMISSIVE .catch(undefined) from all AHP-pipeline-critical fields.
 *     The original schema used .catch() everywhere, meaning type errors in LLM
 *     output were silently swallowed — e.g. confidence: "high" (string) would
 *     produce confidence: undefined instead of a validation failure.
 *
 *  2. SAATY SCALE BOUNDS enforced on comparison values (must be in [1/9, 9]).
 *     Previously the schema accepted any number including 0, Infinity, and NaN,
 *     which would propagate to division-by-zero in ahp-math.ts.
 *
 *  3. ARRAY SIZE CONSTRAINTS (.min(3).max(3)) on options, criteria, and
 *     optionComparisons ensure the AHP matrix is always 3×3. A 2-option
 *     or 4-option response would silently produce wrong weights.
 *
 *  4. DISPLAY FIELDS (title, context, data_quality_note) retain .catch()
 *     because they are purely for display and a missing/malformed value
 *     should never block the analysis from completing.
 */

// ─── Saaty Scale ──────────────────────────────────────────────────────────────

/**
 * A valid Saaty pairwise comparison value.
 * Must be between 1/9 (extreme preference for B over A) and 9 (extreme
 * preference for A over B), exclusive of zero to prevent division-by-zero in
 * the AHP matrix inversion.
 */
const SaatyValueSchema = z
  .number()
  .min(1 / 9, 'Saaty value must be ≥ 1/9 (reciprocal of 9)')
  .max(9, 'Saaty value must be ≤ 9')
  .refine((n) => Number.isFinite(n), 'Saaty value must be finite (not NaN or Infinity)');

/**
 * A triple of Saaty values representing the three pairwise comparisons
 * needed for a 3×3 AHP matrix: [A vs B, A vs C, B vs C].
 */
export const ComparisonTripleSchema = z.tuple([
  SaatyValueSchema,
  SaatyValueSchema,
  SaatyValueSchema,
]);

// ─── MCDA Raw Response Schema ─────────────────────────────────────────────────

/**
 * Schema for the raw LLM MCDA response before AHP post-processing.
 *
 * Fields are divided into two groups:
 *  • AHP-critical (options, criteria, comparisons, confidence, recommendation,
 *    reasoning) — parsed strictly; validation failure triggers a retry.
 *  • Display-only (title, context, data_quality_note, scores) — use .catch()
 *    so a missing or malformed display field never blocks the analysis.
 */
export const McdaRawResponseSchema = z.object({
  // ── Display-only fields (soft failure is acceptable) ──────────────────────
  title: z.string().optional().catch(undefined),
  context: z.string().optional().catch(undefined),
  data_quality_note: z.string().optional().catch(undefined),

  // ── AHP-critical fields (strict validation) ───────────────────────────────

  /** Exactly 3 strategic options. */
  options: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        description: z.string().optional(),
      }),
    )
    .min(3, 'MCDA requires exactly 3 options')
    .max(3, 'MCDA requires exactly 3 options'),

  /** Exactly 3 evaluation criteria. */
  criteria: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        /** Populated by the AHP engine post-processing — not from the LLM. */
        weight: z.number().optional(),
      }),
    )
    .min(3, 'MCDA requires exactly 3 criteria')
    .max(3, 'MCDA requires exactly 3 criteria'),

  /** [C1vsC2, C1vsC3, C2vsC3] using Saaty 1–9 scale. */
  criteriaComparisons: ComparisonTripleSchema,

  /**
   * One ComparisonTriple per criterion, each comparing options pairwise:
   * [[O1vsO2, O1vsO3, O2vsO3], [...], [...]].
   */
  optionComparisons: z
    .array(ComparisonTripleSchema)
    .min(3, 'optionComparisons must contain exactly 3 triples')
    .max(3, 'optionComparisons must contain exactly 3 triples'),

  /** Natural-language recommendation citing specific data. */
  recommendation: z.string().min(10, 'recommendation must be a meaningful string'),

  /** LLM self-reported certainty (0–100). */
  confidence: z
    .number()
    .int('confidence must be an integer')
    .min(0)
    .max(100),

  reasoning: z.object({
    decomposition: z.string(),
    assumptions: z.array(z.string()),
    tradeoffs: z.array(z.string()),
    risks: z.array(z.string()),
    sensitivity: z.string(),
  }),

  // ── Computed post-processing field (not from LLM) ─────────────────────────
  scores: z.array(z.record(z.union([z.string(), z.number()]))).optional().catch(undefined),
});

export type McdaRawResponse = z.infer<typeof McdaRawResponseSchema>;

// ─── Full Analysis Result Schema ──────────────────────────────────────────────

/** Schema for the fully processed analysis result stored in Supabase. */
export const AnalysisResultSchema = z.object({
  recommendation: z.object({
    optionId: z.string().describe('ID of the recommended option'),
    optionLabel: z.string().describe('Label of the recommended option'),
    confidence: z.number().min(0).max(100).describe('Confidence score 0-100'),
    summary: z.string().describe('2-3 sentence explanation of why this option is recommended'),
  }),
  scores: z
    .array(
      z.object({
        optionId: z.string(),
        optionLabel: z.string(),
        totalScore: z.number().describe('Weighted total score out of 100'),
        criteriaScores: z.array(
          z.object({
            criterionId: z.string(),
            criterionName: z.string(),
            score: z.number().min(1).max(10).describe('Score on this criterion (1-10)'),
          }),
        ),
      }),
    )
    .describe('Scores for all options'),
  reasoning: z.object({
    decomposition: z.string().describe('How you broke down and analysed this decision'),
    assumptions: z.array(z.string()).describe('Key assumptions made during analysis'),
    tradeoffs: z.array(z.string()).describe('Important tradeoffs between options'),
    risks: z.array(z.string()).describe('Potential risks or uncertainties'),
    sensitivity: z.string().describe('How sensitive is the recommendation to weight changes'),
  }),
});

export type AnalysisResultType = z.infer<typeof AnalysisResultSchema>;
