/**
 * @file ahp-math.ts
 * @description Analytic Hierarchy Process (AHP) math engine.
 *
 * Hardening changes:
 *
 *  1. clampSaaty() — guards every pairwise value before it enters the matrix.
 *     An LLM that returns 0, NaN, or Infinity in a comparison triple would
 *     produce 1/0 = Infinity in the reciprocal cell, poisoning all subsequent
 *     geometric mean and λ_max calculations with NaN.  Clamping to [1/9, 9]
 *     maps invalid values to "equal importance" (1), which is the neutral
 *     default and never causes numeric instability.
 *
 *  2. priorityVector denominator guard — if the sum of geometric means is
 *     zero (degenerate matrix), we return a uniform distribution rather than
 *     producing NaN scores.
 *
 *  3. λ_max calculation guard — skip zero-weight criteria to avoid dividing
 *     by zero in the rowSum / priorityVector[i] step.
 */

// ─── Saaty Random Index Table ─────────────────────────────────────────────────

/** Saaty's Random Index (RI) values for matrix sizes 1–10. */
const RI: Record<number, number> = {
  1: 0,    2: 0,    3: 0.58, 4: 0.90, 5: 1.12,
  6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45, 10: 1.49,
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type ComparisonTriple = [number, number, number];
export type ComparisonTripleArray = [ComparisonTriple, ComparisonTriple, ComparisonTriple];

// ─── Input Sanitisation ───────────────────────────────────────────────────────

const SAATY_MIN = 1 / 9; // most extreme preference for B over A
const SAATY_MAX = 9;     // most extreme preference for A over B

/**
 * Clamps a pairwise comparison value to the valid Saaty scale [1/9, 9].
 *
 * Invalid values (0, negative, NaN, Infinity) are mapped to 1 ("equal
 * importance") — the safest neutral default that produces a valid matrix.
 *
 * @param val - Raw comparison value from the LLM.
 */
function clampSaaty(val: number): number {
  if (!Number.isFinite(val) || val <= 0) {
    console.warn(`[AHP] Invalid Saaty value (${val}) — clamped to 1 (equal importance)`);
    return 1;
  }
  const clamped = Math.max(SAATY_MIN, Math.min(SAATY_MAX, val));
  if (clamped !== val) {
    console.warn(`[AHP] Saaty value ${val} out of [${SAATY_MIN.toFixed(4)}, ${SAATY_MAX}] — clamped to ${clamped.toFixed(4)}`);
  }
  return clamped;
}

// ─── Matrix Construction ──────────────────────────────────────────────────────

/**
 * Builds a 3×3 positive reciprocal pairwise comparison matrix from three
 * comparison values [A vs B, A vs C, B vs C].
 *
 * All input values are sanitised through clampSaaty() before use.
 */
export function buildPairwiseMatrix(comparisons: ComparisonTriple): number[][] {
  const [raw01, raw02, raw12] = comparisons;
  const c01 = clampSaaty(raw01);
  const c02 = clampSaaty(raw02);
  const c12 = clampSaaty(raw12);

  // Build the 3×3 reciprocal matrix
  //   [ 1      c01    c02  ]
  //   [ 1/c01  1      c12  ]
  //   [ 1/c02  1/c12  1    ]
  const n = 3;
  const m: number[][] = Array.from({ length: n }, () => Array(n).fill(1));
  m[0][1] = c01;      m[1][0] = 1 / c01;
  m[0][2] = c02;      m[2][0] = 1 / c02;
  m[1][2] = c12;      m[2][1] = 1 / c12;
  return m;
}

// ─── Priority Vector ──────────────────────────────────────────────────────────

/**
 * Computes the normalised priority vector from a pairwise comparison matrix
 * using the geometric mean method (preferred over the eigenvalue method for
 * small matrices due to numerical stability).
 *
 * Returns a uniform distribution [1/n, 1/n, ...] if the matrix is degenerate
 * (sum of geometric means = 0) to avoid NaN propagation.
 */
export function calculatePriorityVector(matrix: number[][]): number[] {
  const n = matrix.length;

  const geoMeans = matrix.map((row) => {
    const product = row.reduce((acc, val) => acc * Math.max(val, Number.EPSILON), 1);
    return Math.pow(product, 1 / n);
  });

  const sum = geoMeans.reduce((a, b) => a + b, 0);

  // Guard against degenerate matrix (sum = 0 → return uniform distribution)
  if (sum === 0 || !Number.isFinite(sum)) {
    console.warn('[AHP] Priority vector sum is zero or non-finite — returning uniform distribution');
    return Array(n).fill(1 / n);
  }

  return geoMeans.map((gm) => gm / sum);
}

// ─── λ_max Calculation ────────────────────────────────────────────────────────

/**
 * Computes the principal eigenvalue approximation (λ_max) needed for the
 * Consistency Ratio calculation.
 *
 * Skips zero-weight criteria to avoid dividing by zero.
 */
export function calculateLambdaMax(matrix: number[][], priorityVector: number[]): number {
  const n = matrix.length;
  let lambdaSum = 0;
  let validCount = 0;

  for (let i = 0; i < n; i++) {
    if (priorityVector[i] === 0) continue; // skip zero-weight (guard against 0-division)

    let rowSum = 0;
    for (let j = 0; j < n; j++) {
      rowSum += matrix[i][j] * priorityVector[j];
    }
    lambdaSum += rowSum / priorityVector[i];
    validCount++;
  }

  return validCount > 0 ? lambdaSum / validCount : n;
}

// ─── Consistency Ratio ────────────────────────────────────────────────────────

/**
 * Computes the Consistency Ratio (CR) for a pairwise matrix.
 * CR < 0.10 indicates acceptable consistency in Saaty's framework.
 */
export function calculateConsistencyRatio(matrix: number[][]): number {
  const n = matrix.length;
  const pv = calculatePriorityVector(matrix);
  const lambdaMax = calculateLambdaMax(matrix, pv);
  const ci = (lambdaMax - n) / Math.max(n - 1, 1); // guard n=1
  const ri = RI[n] ?? 1.49;
  return ri === 0 ? 0 : ci / ri;
}

// ─── AHP Synthesis ────────────────────────────────────────────────────────────

/**
 * Performs the full AHP synthesis:
 *  1. Derives criteria weights from the criteria pairwise matrix.
 *  2. Derives per-criterion option priority vectors.
 *  3. Computes total (weighted) scores for each option.
 *  4. Reports consistency ratios.
 */
export function ahpSynthesis(params: {
  criteriaComparisons: ComparisonTriple;
  optionComparisons: ComparisonTripleArray;
}) {
  const criteriaMatrix = buildPairwiseMatrix(params.criteriaComparisons);
  const weights = calculatePriorityVector(criteriaMatrix);
  const criteriaCR = calculateConsistencyRatio(criteriaMatrix);

  const optionMatrices = params.optionComparisons.map(buildPairwiseMatrix);
  const optionVectors = optionMatrices.map(calculatePriorityVector);
  const optionCRs = optionMatrices.map(calculateConsistencyRatio);

  // Weighted sum across all criteria for each option
  const totalScores = optionVectors[0].map((_, optIdx) =>
    weights.reduce((sum, w, critIdx) => sum + w * optionVectors[critIdx][optIdx], 0),
  );

  return {
    weights,
    optionVectors,
    totalScores,
    consistency: {
      criteriaCR,
      optionCRs,
      isConsistent: criteriaCR < 0.1 && optionCRs.every((cr) => cr < 0.1),
    },
  };
}
