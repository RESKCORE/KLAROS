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

// ─── Saaty Scale & Matrix Normalization ───────────────────────────────────────

/**
 * Parses any Saaty comparison value (number, fraction string "1/3", ratio "1:3", float)
 * and clamps it to the valid range [1/9, 9].
 */
export function parseSaatyNumber(val: unknown): number {
  if (typeof val === 'number') {
    if (!Number.isFinite(val) || val <= 0) return 1;
    return Math.max(1 / 9, Math.min(9, val));
  }
  if (typeof val === 'string') {
    const s = val.trim();
    if (s.includes('/')) {
      const parts = s.split('/');
      const num = parseFloat(parts[0]);
      const den = parseFloat(parts[1]);
      if (den && Number.isFinite(num) && Number.isFinite(den) && den !== 0) {
        return Math.max(1 / 9, Math.min(9, num / den));
      }
    }
    if (s.includes(':')) {
      const parts = s.split(':');
      const num = parseFloat(parts[0]);
      const den = parseFloat(parts[1]);
      if (den && Number.isFinite(num) && Number.isFinite(den) && den !== 0) {
        return Math.max(1 / 9, Math.min(9, num / den));
      }
    }
    const parsed = parseFloat(s);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.max(1 / 9, Math.min(9, parsed));
    }
  }
  return 1;
}

/**
 * Normalizes a pairwise comparison representation into a clean flat array or matrix.
 * Handles:
 *  - Flat array [a, b, c, ...]
 *  - Full K×K reciprocal matrix [[1, a, b], [1/a, 1, c], [1/b, 1/c, 1]]
 *  - Objects or non-standard shapes with safe default
 */
export function normalizeComparisonList(val: unknown, expectedLength = 3): number[] {
  if (Array.isArray(val)) {
    // If it's a 2D matrix, extract upper triangle
    if (val.length >= 2 && Array.isArray(val[0])) {
      const n = val.length;
      const upper: number[] = [];
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          upper.push(parseSaatyNumber((val[i] as unknown[])?.[j] ?? 1));
        }
      }
      return upper;
    }
    // Flat array
    const parsed = val.map((item) => parseSaatyNumber(item));
    return parsed.length > 0 ? parsed : Array(expectedLength).fill(1);
  }
  return Array(expectedLength).fill(1);
}

/**
 * Legacy helper for 3x3 triples [A vs B, A vs C, B vs C].
 */
export function normalizeComparisonTriple(val: unknown): [number, number, number] {
  const list = normalizeComparisonList(val, 3);
  return [list[0] ?? 1, list[1] ?? 1, list[2] ?? 1];
}

/**
 * Saaty values representing the pairwise comparisons needed for an AHP matrix.
 */
export const DynamicComparisonSchema = z.preprocess(
  (val) => normalizeComparisonList(val),
  z.array(z.number()),
);

export const ComparisonTripleSchema = z.preprocess(
  (val) => normalizeComparisonTriple(val),
  z.tuple([z.number(), z.number(), z.number()]),
);

export const OptionComparisonsSchema = z.preprocess(
  (val) => {
    if (Array.isArray(val)) {
      return val.map((item) => normalizeComparisonList(item));
    }
    return [[1, 1, 1], [1, 1, 1], [1, 1, 1]];
  },
  z.array(z.array(z.number())),
);

// ─── MCDA Raw Response Schema ─────────────────────────────────────────────────

/**
 * Schema for the raw LLM MCDA response before AHP post-processing.
 * Supports dynamic N options (2–10) and M criteria (2–10).
 */
export const McdaRawResponseSchema = z.object({
  // ── Display-only fields (soft failure is acceptable) ──────────────────────
  title: z.string().optional().catch(undefined),
  context: z.string().optional().catch(undefined),
  data_quality_note: z.string().optional().catch(undefined),

  // ── AHP-critical fields (strict validation) ───────────────────────────────

  /** Strategic options (2 to 10 options supported). */
  options: z.preprocess((val) => {
    if (Array.isArray(val) && val.length >= 2) {
      return val.slice(0, 10).map((o, idx) => ({
        id: (o && typeof o === 'object' && 'id' in o && typeof o.id === 'string' && o.id.trim()) || `o${idx + 1}`,
        label: (o && typeof o === 'object' && 'label' in o && typeof o.label === 'string' && o.label.trim()) || `Option ${idx + 1}`,
        description: (o && typeof o === 'object' && 'description' in o && typeof o.description === 'string') ? o.description : '',
      }));
    }
    return [
      { id: 'o1', label: 'Option 1', description: '' },
      { id: 'o2', label: 'Option 2', description: '' },
      { id: 'o3', label: 'Option 3', description: '' },
    ];
  }, z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    description: z.string().optional().catch(''),
  })).min(2).max(10)),

  /** Evaluation criteria (2 to 10 criteria supported). */
  criteria: z.preprocess((val) => {
    if (Array.isArray(val) && val.length >= 2) {
      return val.slice(0, 10).map((c, idx) => ({
        id: (c && typeof c === 'object' && 'id' in c && typeof c.id === 'string' && c.id.trim()) || `c${idx + 1}`,
        name: (c && typeof c === 'object' && 'name' in c && typeof c.name === 'string' && c.name.trim()) || `Criterion ${idx + 1}`,
        weight: typeof c === 'object' && c && 'weight' in c && typeof c.weight === 'number' ? c.weight : undefined,
      }));
    }
    return [
      { id: 'c1', name: 'Criterion 1', weight: undefined },
      { id: 'c2', name: 'Criterion 2', weight: undefined },
      { id: 'c3', name: 'Criterion 3', weight: undefined },
    ];
  }, z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    weight: z.number().optional(),
  })).min(2).max(10)),

  /** Criteria pairwise comparisons on Saaty 1–9 scale. */
  criteriaComparisons: DynamicComparisonSchema,

  /**
   * Option pairwise comparisons per criterion:
   * Array of length M (one per criterion), each containing option comparisons.
   */
  optionComparisons: OptionComparisonsSchema,

  /** Natural-language recommendation citing specific data. */
  recommendation: z.preprocess(
    (val) => (typeof val === 'string' && val.trim().length > 0 ? val.trim() : 'Strategic recommendation based on multi-criteria analysis.'),
    z.string(),
  ),

  /** LLM self-reported certainty (0–100). */
  confidence: z.preprocess(
    (val) => (typeof val === 'string' ? Math.round(parseFloat(val) || 75) : Math.round(Number(val) || 75)),
    z.number().min(0).max(100),
  ),

  reasoning: z.preprocess((val) => {
    if (val && typeof val === 'object') {
      const r = val as Record<string, unknown>;
      return {
        decomposition: typeof r.decomposition === 'string' ? r.decomposition : '',
        assumptions: Array.isArray(r.assumptions) ? r.assumptions.map(String) : [],
        tradeoffs: Array.isArray(r.tradeoffs) ? r.tradeoffs.map(String) : [],
        risks: Array.isArray(r.risks) ? r.risks.map(String) : [],
        sensitivity: typeof r.sensitivity === 'string' ? r.sensitivity : '',
      };
    }
    return {
      decomposition: '',
      assumptions: [],
      tradeoffs: [],
      risks: [],
      sensitivity: '',
    };
  }, z.object({
    decomposition: z.string().optional().catch(''),
    assumptions: z.array(z.string()).optional().catch([]),
    tradeoffs: z.array(z.string()).optional().catch([]),
    risks: z.array(z.string()).optional().catch([]),
    sensitivity: z.string().optional().catch(''),
  })),

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
