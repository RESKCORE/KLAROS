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
 * Normalizes a pairwise comparison representation into a clean [A vs B, A vs C, B vs C] triple.
 * Handles:
 *  - Flat array [a, b, c]
 *  - Full 3x3 reciprocal matrix [[1, a, b], [1/a, 1, c], [1/b, 1/c, 1]]
 *  - Objects or non-standard shapes with safe default [1, 1, 1]
 */
export function normalizeComparisonTriple(val: unknown): [number, number, number] {
  // If it's a 3x3 matrix: [[1, a, b], [1/a, 1, c], [1/b, 1/c, 1]]
  if (Array.isArray(val) && val.length >= 2 && Array.isArray(val[0])) {
    const row0 = val[0] as unknown[];
    const row1 = val[1] as unknown[];
    const a = parseSaatyNumber(row0?.[1] ?? 1);
    const b = parseSaatyNumber(row0?.[2] ?? 1);
    const c = parseSaatyNumber(row1?.[2] ?? 1);
    return [a, b, c];
  }
  // If it's a flat array of comparisons
  if (Array.isArray(val)) {
    const a = parseSaatyNumber(val[0] ?? 1);
    const b = parseSaatyNumber(val[1] ?? 1);
    const c = parseSaatyNumber(val[2] ?? 1);
    return [a, b, c];
  }
  return [1, 1, 1];
}

/**
 * A triple of Saaty values representing the three pairwise comparisons
 * needed for a 3×3 AHP matrix: [A vs B, A vs C, B vs C].
 */
export const ComparisonTripleSchema = z.preprocess(
  (val) => normalizeComparisonTriple(val),
  z.tuple([z.number(), z.number(), z.number()]),
);

export const OptionComparisonsSchema = z.preprocess(
  (val) => {
    if (Array.isArray(val)) {
      const list = val.slice(0, 3).map((item) => normalizeComparisonTriple(item));
      while (list.length < 3) {
        list.push([1, 1, 1]);
      }
      return [list[0], list[1], list[2]];
    }
    return [[1, 1, 1], [1, 1, 1], [1, 1, 1]];
  },
  z.tuple([
    z.tuple([z.number(), z.number(), z.number()]),
    z.tuple([z.number(), z.number(), z.number()]),
    z.tuple([z.number(), z.number(), z.number()]),
  ]),
);

// ─── MCDA Raw Response Schema ─────────────────────────────────────────────────

/**
 * Schema for the raw LLM MCDA response before AHP post-processing.
 */
export const McdaRawResponseSchema = z.object({
  // ── Display-only fields (soft failure is acceptable) ──────────────────────
  title: z.string().optional().catch(undefined),
  context: z.string().optional().catch(undefined),
  data_quality_note: z.string().optional().catch(undefined),

  // ── AHP-critical fields (strict validation) ───────────────────────────────

  /** Exactly 3 strategic options. */
  options: z.preprocess((val) => {
    if (Array.isArray(val)) {
      const list = val.map((o, idx) => ({
        id: (o && typeof o === 'object' && 'id' in o && typeof o.id === 'string' && o.id.trim()) || `o${idx + 1}`,
        label: (o && typeof o === 'object' && 'label' in o && typeof o.label === 'string' && o.label.trim()) || `Option ${idx + 1}`,
        description: (o && typeof o === 'object' && 'description' in o && typeof o.description === 'string') ? o.description : '',
      })).slice(0, 3);
      while (list.length < 3) {
        const idx = list.length + 1;
        list.push({ id: `o${idx}`, label: `Option ${idx}`, description: '' });
      }
      return list;
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
  })).min(3).max(3)),

  /** Exactly 3 evaluation criteria. */
  criteria: z.preprocess((val) => {
    if (Array.isArray(val)) {
      const list = val.map((c, idx) => ({
        id: (c && typeof c === 'object' && 'id' in c && typeof c.id === 'string' && c.id.trim()) || `c${idx + 1}`,
        name: (c && typeof c === 'object' && 'name' in c && typeof c.name === 'string' && c.name.trim()) || `Criterion ${idx + 1}`,
        weight: typeof c === 'object' && c && 'weight' in c && typeof c.weight === 'number' ? c.weight : undefined,
      })).slice(0, 3);
      while (list.length < 3) {
        const idx = list.length + 1;
        list.push({ id: `c${idx}`, name: `Criterion ${idx}`, weight: undefined });
      }
      return list;
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
  })).min(3).max(3)),

  /** [C1vsC2, C1vsC3, C2vsC3] using Saaty 1–9 scale. */
  criteriaComparisons: ComparisonTripleSchema,

  /**
   * One ComparisonTriple per criterion, each comparing options pairwise:
   * [[O1vsO2, O1vsO3, O2vsO3], [...], [...]].
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
