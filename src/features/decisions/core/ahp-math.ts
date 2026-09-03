/**
 * @file ahp-math.ts
 * @description Analytic Hierarchy Process (AHP) math engine supporting dynamic N×M topologies.
 *
 * Capabilities:
 *  1. Dynamic dimension support: Arbitrary N options (N >= 2) and M criteria (M >= 2).
 *  2. Extended Saaty Random Index table up to N=15 with linear/polynomial asymptotic fallback.
 *  3. Dynamic upper-triangle pairwise matrix builder: supports flat comparison arrays of size K*(K-1)/2
 *     as well as full K×K reciprocal matrices and legacy 3-element comparison triples.
 *  4. Robust numerical guards: clampSaaty [1/9, 9], zero/NaN/negative defense, degenerate matrix uniform fallback.
 *  5. Full AHP synthesis computing priority vectors, consistency indices, and composite rankings.
 */

// ─── Saaty Random Index Table ─────────────────────────────────────────────────

/** Saaty's Random Index (RI) values for matrix sizes 1–15. */
export const SAATY_RI: Record<number, number> = {
  1: 0,
  2: 0,
  3: 0.58,
  4: 0.90,
  5: 1.12,
  6: 1.24,
  7: 1.32,
  8: 1.41,
  9: 1.45,
  10: 1.49,
  11: 1.51,
  12: 1.54,
  13: 1.56,
  14: 1.57,
  15: 1.59,
};

/**
 * Returns the Saaty Random Index for a matrix of size n.
 * Uses exact empirical values up to n=15 and asymptotic formula for n > 15.
 */
export function getSaatyRandomIndex(n: number): number {
  if (n <= 2) return 0;
  if (SAATY_RI[n] !== undefined) return SAATY_RI[n];
  // Asymptotic approximation for large n: RI ≈ 1.98 * (n - 2) / n
  return (1.98 * (n - 2)) / n;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ComparisonTriple = [number, number, number];
export type ComparisonTripleArray = [ComparisonTriple, ComparisonTriple, ComparisonTriple];
export type PairwiseComparisons = number[] | number[][] | ComparisonTriple;

export interface AhpSynthesisResult {
  weights: number[];
  optionVectors: number[][];
  totalScores: number[];
  ranking: number[];
  consistency: {
    criteriaCR: number;
    optionCRs: number[];
    isConsistent: boolean;
  };
}

// ─── Input Sanitisation ───────────────────────────────────────────────────────

export const SAATY_MIN = 1 / 9; // extreme preference for alternative B over A
export const SAATY_MAX = 9;     // extreme preference for alternative A over B

/**
 * Clamps a pairwise comparison value to the valid Saaty scale [1/9, 9].
 * Invalid values (0, negative, NaN, Infinity) are mapped to 1 ("equal importance").
 */
export function clampSaaty(val: number): number {
  if (!Number.isFinite(val) || val <= 0) {
    return 1;
  }
  return Math.max(SAATY_MIN, Math.min(SAATY_MAX, val));
}

// ─── Matrix Construction ──────────────────────────────────────────────────────

/**
 * Determines matrix dimension K from an upper-triangle comparisons array length.
 * Since L = K*(K-1)/2, solving quadratic equation gives K = (1 + sqrt(1 + 8L)) / 2.
 */
export function dimensionFromUpperTriangleLength(length: number): number {
  if (length <= 0) return 1;
  const k = (1 + Math.sqrt(1 + 8 * length)) / 2;
  return Math.round(k);
}

/**
 * Builds a K×K positive reciprocal pairwise comparison matrix.
 * Accepts:
 *  - Full K×K 2D array: sanitizes and enforces reciprocal symmetry (m[j][i] = 1 / m[i][j]).
 *  - Flat array representing the upper triangle in row-major order:
 *      For K=3: [a01, a02, a12]
 *      For K=4: [a01, a02, a03, a12, a13, a23]
 *  - An explicit dimension `targetDimension` can be supplied to pad/truncate safely.
 */
export function buildPairwiseMatrix(
  comparisons: PairwiseComparisons,
  targetDimension?: number,
): number[][] {
  // Case 1: Already a 2D matrix
  if (Array.isArray(comparisons) && comparisons.length > 0 && Array.isArray(comparisons[0])) {
    const rawMatrix = comparisons as number[][];
    const n = targetDimension ?? rawMatrix.length;
    const m: number[][] = Array.from({ length: n }, () => Array(n).fill(1));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          m[i][j] = 1;
        } else if (i < j) {
          const val = clampSaaty(rawMatrix[i]?.[j] ?? 1);
          m[i][j] = val;
          m[j][i] = 1 / val;
        }
      }
    }
    return m;
  }

  // Case 2: Flat array of upper-triangle comparisons
  const flat = Array.isArray(comparisons) ? (comparisons as number[]) : [];
  const n = targetDimension ?? Math.max(2, dimensionFromUpperTriangleLength(flat.length));
  const m: number[][] = Array.from({ length: n }, () => Array(n).fill(1));

  let index = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const rawVal = flat[index++];
      const val = clampSaaty(typeof rawVal === 'number' ? rawVal : 1);
      m[i][j] = val;
      m[j][i] = 1 / val;
    }
  }

  return m;
}

// ─── Priority Vector ──────────────────────────────────────────────────────────

/**
 * Computes the normalized priority vector from a pairwise comparison matrix
 * using the Geometric Mean (Eigenvector Approximation) Method.
 *
 * Returns a uniform distribution [1/n, 1/n, ...] if the matrix is degenerate.
 */
export function calculatePriorityVector(matrix: number[][]): number[] {
  const n = matrix.length;
  if (n === 0) return [];
  if (n === 1) return [1];

  const geoMeans = matrix.map((row) => {
    const product = row.reduce((acc, val) => acc * Math.max(val, Number.EPSILON), 1);
    return Math.pow(product, 1 / n);
  });

  const sum = geoMeans.reduce((a, b) => a + b, 0);

  if (sum === 0 || !Number.isFinite(sum)) {
    return Array(n).fill(1 / n);
  }

  return geoMeans.map((gm) => gm / sum);
}

// ─── λ_max Calculation ────────────────────────────────────────────────────────

/**
 * Computes the principal eigenvalue approximation (λ_max) needed for the
 * Consistency Ratio calculation.
 */
export function calculateLambdaMax(matrix: number[][], priorityVector: number[]): number {
  const n = matrix.length;
  if (n <= 1) return n;

  let lambdaSum = 0;
  let validCount = 0;

  for (let i = 0; i < n; i++) {
    const pvi = priorityVector[i];
    if (!pvi || pvi <= 0) continue;

    let rowSum = 0;
    for (let j = 0; j < n; j++) {
      rowSum += matrix[i][j] * (priorityVector[j] ?? 0);
    }
    lambdaSum += rowSum / pvi;
    validCount++;
  }

  return validCount > 0 ? lambdaSum / validCount : n;
}

// ─── Consistency Ratio ────────────────────────────────────────────────────────

/**
 * Computes the Consistency Ratio (CR) for a pairwise matrix of any dimension.
 * Saaty standard: CR < 0.10 indicates acceptable consistency (CR < 0.08 for n=3, 0.05 for n=2).
 */
export function calculateConsistencyRatio(matrix: number[][]): number {
  const n = matrix.length;
  if (n <= 2) return 0; // 1x1 and 2x2 reciprocal matrices are always mathematically consistent

  const pv = calculatePriorityVector(matrix);
  const lambdaMax = calculateLambdaMax(matrix, pv);
  const ci = (lambdaMax - n) / (n - 1);
  const ri = getSaatyRandomIndex(n);

  return ri === 0 ? 0 : Math.max(0, ci / ri);
}

// ─── Dynamic AHP Synthesis ────────────────────────────────────────────────────

/**
 * Performs full dynamic AHP synthesis for M criteria and N options:
 *  1. Constructs criteria pairwise matrix & derives normalized weights w = [w_1, ..., w_M].
 *  2. Constructs option pairwise matrices per criterion & derives option priority vectors v_j.
 *  3. Synthesizes total composite score vector: S_i = \sum_{j=1}^M w_j * v_{ij}.
 *  4. Evaluates criteria CR and per-criterion option CRs.
 */
export function ahpSynthesis(params: {
  criteriaComparisons: PairwiseComparisons;
  optionComparisons: PairwiseComparisons[];
  criteriaCount?: number;
  optionsCount?: number;
}): AhpSynthesisResult {
  const mCount = params.criteriaCount ?? (
    Array.isArray(params.criteriaComparisons) && Array.isArray(params.criteriaComparisons[0])
      ? params.criteriaComparisons.length
      : Array.isArray(params.criteriaComparisons)
      ? dimensionFromUpperTriangleLength((params.criteriaComparisons as number[]).length)
      : 3
  );

  const criteriaMatrix = buildPairwiseMatrix(params.criteriaComparisons, mCount);
  const weights = calculatePriorityVector(criteriaMatrix);
  const criteriaCR = calculateConsistencyRatio(criteriaMatrix);

  // Determine option count N
  const firstOptComp = params.optionComparisons[0];
  const nCount = params.optionsCount ?? (
    Array.isArray(firstOptComp) && Array.isArray(firstOptComp[0])
      ? (firstOptComp as number[][]).length
      : Array.isArray(firstOptComp)
      ? dimensionFromUpperTriangleLength((firstOptComp as number[]).length)
      : 3
  );

  const optionMatrices = params.optionComparisons.map((c) => buildPairwiseMatrix(c, nCount));
  const optionVectors = optionMatrices.map((m) => calculatePriorityVector(m));
  const optionCRs = optionMatrices.map((m) => calculateConsistencyRatio(m));

  // Weighted sum across all criteria for each option
  const totalScores = Array.from({ length: nCount }, (_, optIdx) =>
    weights.reduce((sum, w, critIdx) => {
      const optVal = optionVectors[critIdx]?.[optIdx] ?? (1 / nCount);
      return sum + w * optVal;
    }, 0),
  );

  // Generate ranks (1-indexed descending by totalScore)
  const sortedIndices = totalScores
    .map((score, idx) => ({ score, idx }))
    .sort((a, b) => b.score - a.score);

  const ranking = Array(nCount).fill(1);
  sortedIndices.forEach((item, rankIdx) => {
    ranking[item.idx] = rankIdx + 1;
  });

  return {
    weights,
    optionVectors,
    totalScores,
    ranking,
    consistency: {
      criteriaCR,
      optionCRs,
      isConsistent: criteriaCR < 0.1 && optionCRs.every((cr) => cr < 0.1),
    },
  };
}
