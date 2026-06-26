const RI: Record<number, number> = {
  1: 0, 2: 0, 3: 0.58, 4: 0.90, 5: 1.12, 6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45, 10: 1.49,
};

export type ComparisonTriple = [number, number, number];
export type ComparisonTripleArray = [ComparisonTriple, ComparisonTriple, ComparisonTriple];

export function buildPairwiseMatrix(comparisons: ComparisonTriple): number[][] {
  const n = 3;
  const m: number[][] = Array.from({ length: n }, () => Array(n).fill(1));
  m[0][1] = comparisons[0];  m[1][0] = 1 / comparisons[0];
  m[0][2] = comparisons[1];  m[2][0] = 1 / comparisons[1];
  m[1][2] = comparisons[2];  m[2][1] = 1 / comparisons[2];
  return m;
}

export function calculatePriorityVector(matrix: number[][]): number[] {
  const n = matrix.length;
  const geoMeans = matrix.map(row => {
    const product = row.reduce((a, b) => a * b, 1);
    return Math.pow(product, 1 / n);
  });
  const sum = geoMeans.reduce((a, b) => a + b, 0);
  return geoMeans.map(gm => gm / sum);
}

export function calculateLambdaMax(matrix: number[][], priorityVector: number[]): number {
  const n = matrix.length;
  let lambdaMax = 0;
  for (let i = 0; i < n; i++) {
    let rowSum = 0;
    for (let j = 0; j < n; j++) {
      rowSum += matrix[i][j] * priorityVector[j];
    }
    lambdaMax += rowSum / priorityVector[i];
  }
  return lambdaMax / n;
}

export function calculateConsistencyRatio(matrix: number[][]): number {
  const n = matrix.length;
  const pv = calculatePriorityVector(matrix);
  const lambdaMax = calculateLambdaMax(matrix, pv);
  const ci = (lambdaMax - n) / (n - 1);
  const ri = RI[n] ?? 1.49;
  return ri === 0 ? 0 : ci / ri;
}

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
      isConsistent: criteriaCR < 0.1 && optionCRs.every(cr => cr < 0.1),
    },
  };
}
