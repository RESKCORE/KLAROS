/**
 * @file topsis-math.ts
 * @description Technique for Order of Preference by Similarity to Ideal Solution (TOPSIS)
 * and Simple Additive Weighting (SAW) MCDA benchmarking engine.
 *
 * Mathematical Workflow:
 *  1. Vector Normalization: r_ij = x_ij / sqrt(sum_k x_kj^2)
 *  2. Weighted Normalization: v_ij = w_j * r_ij
 *  3. Ideal Solutions: Positive Ideal (A^+) and Negative Ideal (A^-)
 *  4. Euclidean Distance: S_i^+ = ||v_i - A^+||, S_i^- = ||v_i - A^-||
 *  5. Relative Closeness: C_i^* = S_i^- / (S_i^+ + S_i^-)
 *  6. Secondary Benchmarks: SAW score computation and Spearman Rank Correlation (rho).
 */

export interface TopsisAlternativeResult {
  optionId: string;
  optionLabel: string;
  closenessScore: number;       // C_i^* in [0, 1]
  scaledScore: number;          // 0–100 scaled for UI comparison
  distanceToPositiveIdeal: number; // S_i^+
  distanceToNegativeIdeal: number; // S_i^-
  topsisRank: number;
  sawScore: number;             // Simple Additive Weighting (0–100)
  sawRank: number;
  ahpRank?: number;
  ahpScore?: number;
}

export interface McdaBenchmarkResult {
  alternatives: TopsisAlternativeResult[];
  spearmanCorrelation: number;  // Spearman rho between AHP and TOPSIS ranks [-1, 1]
  rankConcordancePercent: number; // % of identical rank placements
  positiveIdealSolution: number[];
  negativeIdealSolution: number[];
  normalizedMatrix: number[][];
  weightedMatrix: number[][];
}

/**
 * Computes the Euclidean norm of a vector.
 */
function vectorNorm(vector: number[]): number {
  const sumSq = vector.reduce((acc, val) => acc + val * val, 0);
  return Math.sqrt(sumSq);
}

/**
 * Calculates Spearman's Rank Correlation Coefficient (rho) between two rank orderings.
 *  rho = 1 - (6 * sum(d_i^2)) / (N * (N^2 - 1))
 */
export function calculateSpearmanCorrelation(rankA: number[], rankB: number[]): number {
  const n = rankA.length;
  if (n <= 1) return 1.0;

  let sumDiffSq = 0;
  for (let i = 0; i < n; i++) {
    const diff = (rankA[i] ?? 1) - (rankB[i] ?? 1);
    sumDiffSq += diff * diff;
  }

  const denominator = n * (n * n - 1);
  if (denominator === 0) return 1.0;

  const rho = 1 - (6 * sumDiffSq) / denominator;
  return Math.max(-1, Math.min(1, Math.round(rho * 1000) / 1000));
}

/**
 * Executes the full TOPSIS and SAW MCDA benchmarking algorithm.
 *
 * @param params.decisionMatrix - N×M matrix where row i is alternative i, column j is criterion j.
 * @param params.weights - M-length criteria weights vector (sums to 1).
 * @param params.options - Array of N option identifiers/labels.
 * @param params.criteriaTypes - Optional array specifying 'benefit' (default) or 'cost' per criterion.
 * @param params.ahpTotalScores - Optional AHP total scores for cross-validation comparison.
 */
export function topsisSynthesis(params: {
  decisionMatrix: number[][];
  weights: number[];
  options: { id: string; label: string }[];
  criteriaTypes?: ('benefit' | 'cost')[];
  ahpTotalScores?: number[];
}): McdaBenchmarkResult {
  const { decisionMatrix, weights, options } = params;
  const n = options.length;
  const m = weights.length;

  if (n === 0 || m === 0) {
    return {
      alternatives: [],
      spearmanCorrelation: 1,
      rankConcordancePercent: 100,
      positiveIdealSolution: [],
      negativeIdealSolution: [],
      normalizedMatrix: [],
      weightedMatrix: [],
    };
  }

  // ── 1. Vector Normalization: r_ij = x_ij / sqrt(sum_k x_kj^2) ─────────────
  const colNorms: number[] = [];
  for (let j = 0; j < m; j++) {
    const colValues = decisionMatrix.map((row) => row[j] ?? 0);
    const norm = vectorNorm(colValues);
    colNorms.push(norm > 0 ? norm : 1);
  }

  const normalizedMatrix: number[][] = Array.from({ length: n }, () => Array(m).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      const rawVal = decisionMatrix[i]?.[j] ?? 0;
      normalizedMatrix[i][j] = rawVal / colNorms[j];
    }
  }

  // ── 2. Weighted Normalized Matrix: v_ij = w_j * r_ij ───────────────────────
  const weightedMatrix: number[][] = Array.from({ length: n }, () => Array(m).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      const w = weights[j] ?? (1 / m);
      weightedMatrix[i][j] = normalizedMatrix[i][j] * w;
    }
  }

  // ── 3. Determine Positive Ideal (A^+) & Negative Ideal (A^-) ───────────────
  const positiveIdealSolution: number[] = [];
  const negativeIdealSolution: number[] = [];

  for (let j = 0; j < m; j++) {
    const colWeights = weightedMatrix.map((row) => row[j]);
    const maxVal = Math.max(...colWeights);
    const minVal = Math.min(...colWeights);
    const isCost = params.criteriaTypes?.[j] === 'cost';

    if (isCost) {
      positiveIdealSolution.push(minVal);
      negativeIdealSolution.push(maxVal);
    } else {
      positiveIdealSolution.push(maxVal);
      negativeIdealSolution.push(minVal);
    }
  }

  // ── 4. Euclidean Distances to Ideal Solutions ──────────────────────────────
  const distancesToPositive: number[] = [];
  const distancesToNegative: number[] = [];
  const closenessScores: number[] = [];

  for (let i = 0; i < n; i++) {
    let sumSqPos = 0;
    let sumSqNeg = 0;

    for (let j = 0; j < m; j++) {
      const val = weightedMatrix[i][j];
      const diffPos = val - positiveIdealSolution[j];
      const diffNeg = val - negativeIdealSolution[j];
      sumSqPos += diffPos * diffPos;
      sumSqNeg += diffNeg * diffNeg;
    }

    const sPos = Math.sqrt(sumSqPos);
    const sNeg = Math.sqrt(sumSqNeg);
    distancesToPositive.push(sPos);
    distancesToNegative.push(sNeg);

    const totalDist = sPos + sNeg;
    const cStar = totalDist > 0 ? sNeg / totalDist : 0.5;
    closenessScores.push(Math.round(cStar * 10000) / 10000);
  }

  // ── 5. Simple Additive Weighting (SAW) Normalization & Scoring ─────────────
  const sawScores: number[] = Array.from({ length: n }, () => 0);
  for (let j = 0; j < m; j++) {
    const colValues = decisionMatrix.map((r) => r[j] ?? 0);
    const minVal = Math.min(...colValues);
    const maxVal = Math.max(...colValues);
    const span = maxVal - minVal;
    const w = weights[j] ?? (1 / m);

    for (let i = 0; i < n; i++) {
      const raw = decisionMatrix[i]?.[j] ?? 0;
      const normVal = span > 0 ? (raw - minVal) / span : 1;
      sawScores[i] += w * normVal * 100;
    }
  }

  // ── 6. Compute Rankings ───────────────────────────────────────────────────
  const topsisSorted = closenessScores
    .map((score, idx) => ({ score, idx }))
    .sort((a, b) => b.score - a.score);
  const topsisRanks = Array(n).fill(1);
  topsisSorted.forEach((item, r) => {
    topsisRanks[item.idx] = r + 1;
  });

  const sawSorted = sawScores
    .map((score, idx) => ({ score, idx }))
    .sort((a, b) => b.score - a.score);
  const sawRanks = Array(n).fill(1);
  sawSorted.forEach((item, r) => {
    sawRanks[item.idx] = r + 1;
  });

  // Calculate AHP ranks if provided
  let ahpRanks: number[] = [];
  if (params.ahpTotalScores && params.ahpTotalScores.length === n) {
    const ahpSorted = params.ahpTotalScores
      .map((score, idx) => ({ score, idx }))
      .sort((a, b) => b.score - a.score);
    ahpRanks = Array(n).fill(1);
    ahpSorted.forEach((item, r) => {
      ahpRanks[item.idx] = r + 1;
    });
  } else {
    ahpRanks = [...topsisRanks];
  }

  // ── 7. Concordance & Correlation ──────────────────────────────────────────
  const spearmanCorrelation = calculateSpearmanCorrelation(ahpRanks, topsisRanks);
  let matchingRanks = 0;
  for (let i = 0; i < n; i++) {
    if (ahpRanks[i] === topsisRanks[i]) {
      matchingRanks++;
    }
  }
  const rankConcordancePercent = Math.round((matchingRanks / n) * 100);

  // ── 8. Assemble Results ───────────────────────────────────────────────────
  const alternatives: TopsisAlternativeResult[] = options.map((opt, i) => ({
    optionId: opt.id,
    optionLabel: opt.label,
    closenessScore: closenessScores[i],
    scaledScore: Math.round(closenessScores[i] * 100),
    distanceToPositiveIdeal: Math.round(distancesToPositive[i] * 1000) / 1000,
    distanceToNegativeIdeal: Math.round(distancesToNegative[i] * 1000) / 1000,
    topsisRank: topsisRanks[i],
    sawScore: Math.round(sawScores[i]),
    sawRank: sawRanks[i],
    ahpRank: ahpRanks[i],
    ahpScore: params.ahpTotalScores?.[i] !== undefined
      ? (params.ahpTotalScores[i] <= 1 ? Math.round(params.ahpTotalScores[i] * 100) : Math.round(params.ahpTotalScores[i]))
      : undefined,
  }));

  return {
    alternatives,
    spearmanCorrelation,
    rankConcordancePercent,
    positiveIdealSolution,
    negativeIdealSolution,
    normalizedMatrix,
    weightedMatrix,
  };
}
