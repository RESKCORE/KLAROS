import { describe, expect, it } from 'vitest';
import {
  buildPairwiseMatrix,
  calculatePriorityVector,
  calculateLambdaMax,
  calculateConsistencyRatio,
  ahpSynthesis,
} from './ahp-math';

describe('buildPairwiseMatrix', () => {
  it('builds a 3x3 reciprocal matrix from a comparison triple', () => {
    const matrix = buildPairwiseMatrix([3, 5, 2]);
    expect(matrix).toHaveLength(3);
    expect(matrix[0]).toEqual([1, 3, 5]);
    expect(matrix[1]).toEqual([1 / 3, 1, 2]);
    expect(matrix[2]).toEqual([1 / 5, 1 / 2, 1]);
  });

  it('diagonal is always 1', () => {
    const matrix = buildPairwiseMatrix([2, 4, 6]);
    for (let i = 0; i < 3; i++) {
      expect(matrix[i][i]).toBe(1);
    }
  });

  it('is perfectly reciprocal', () => {
    const matrix = buildPairwiseMatrix([7, 3, 5]);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        expect(matrix[i][j]).toBeCloseTo(1 / matrix[j][i], 10);
      }
    }
  });
});

describe('calculatePriorityVector', () => {
  it('returns equal weights for identity matrix', () => {
    const matrix = buildPairwiseMatrix([1, 1, 1]);
    const vector = calculatePriorityVector(matrix);
    expect(vector).toHaveLength(3);
    vector.forEach(v => expect(v).toBeCloseTo(1 / 3, 5));
  });

  it('returns [0.4, 0.4, 0.2] for comparisons [1, 2, 2]', () => {
    const matrix = buildPairwiseMatrix([1, 2, 2]);
    const vector = calculatePriorityVector(matrix);
    expect(vector[0]).toBeCloseTo(0.4, 4);
    expect(vector[1]).toBeCloseTo(0.4, 4);
    expect(vector[2]).toBeCloseTo(0.2, 4);
  });

  it('weights sum to 1', () => {
    const matrix = buildPairwiseMatrix([3, 5, 2]);
    const vector = calculatePriorityVector(matrix);
    const sum = vector.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });
});

describe('calculateLambdaMax', () => {
  it('returns exactly n for a perfectly consistent matrix', () => {
    const matrix = buildPairwiseMatrix([1, 2, 2]);
    const pv = calculatePriorityVector(matrix);
    const lambdaMax = calculateLambdaMax(matrix, pv);
    expect(lambdaMax).toBeCloseTo(3, 4);
  });

  it('returns > n for an inconsistent matrix', () => {
    const matrix = buildPairwiseMatrix([2, 5, 3]);
    const pv = calculatePriorityVector(matrix);
    const lambdaMax = calculateLambdaMax(matrix, pv);
    expect(lambdaMax).toBeGreaterThan(3);
  });
});

describe('calculateConsistencyRatio', () => {
  it('returns 0 for a perfectly consistent matrix', () => {
    const matrix = buildPairwiseMatrix([1, 2, 2]);
    const cr = calculateConsistencyRatio(matrix);
    expect(cr).toBeCloseTo(0, 4);
  });

  it('returns < 0.1 for reasonably consistent matrices', () => {
    const matrix = buildPairwiseMatrix([2, 3, 2]);
    const cr = calculateConsistencyRatio(matrix);
    expect(cr).toBeLessThan(0.1);
  });
});

describe('ahpSynthesis', () => {
  it('performs full AHP synthesis with consistent comparisons', () => {
    const result = ahpSynthesis({
      criteriaComparisons: [1, 2, 2],
      optionComparisons: [
        [1, 2, 2],
        [3, 1, 1 / 3],
        [2, 3, 2],
      ],
    });

    expect(result.weights).toHaveLength(3);
    expect(result.weights[0]).toBeCloseTo(0.4, 4);
    expect(result.weights[1]).toBeCloseTo(0.4, 4);
    expect(result.weights[2]).toBeCloseTo(0.2, 4);

    expect(result.optionVectors).toHaveLength(3);
    result.optionVectors.forEach(v => {
      expect(v).toHaveLength(3);
      const sum = v.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 4);
    });

    expect(result.totalScores).toHaveLength(3);
    const scoreSum = result.totalScores.reduce((a, b) => a + b, 0);
    expect(scoreSum).toBeCloseTo(1, 4);

    expect(result.consistency.isConsistent).toBe(true);
  });

  it('scores sum to ~1.0 (normalized)', () => {
    const result = ahpSynthesis({
      criteriaComparisons: [3, 5, 2],
      optionComparisons: [
        [2, 4, 3],
        [1, 2, 2],
        [3, 2, 1],
      ],
    });

    const totalSum = result.totalScores.reduce((a, b) => a + b, 0);
    expect(totalSum).toBeCloseTo(1, 4);
  });

  it('performs dynamic 4-option × 2-criteria synthesis correctly', () => {
    // 2 criteria -> 1 pairwise comparison [c01 = 3]
    // 4 options -> 6 pairwise comparisons per criterion: [a01, a02, a03, a12, a13, a23]
    const result = ahpSynthesis({
      criteriaComparisons: [3],
      optionComparisons: [
        [2, 3, 4, 2, 3, 2], // Criterion 1 comparisons for 4 options
        [1, 2, 3, 2, 3, 2], // Criterion 2 comparisons for 4 options
      ],
      criteriaCount: 2,
      optionsCount: 4,
    });

    expect(result.weights).toHaveLength(2);
    expect(result.weights[0]).toBeCloseTo(0.75, 2);
    expect(result.weights[1]).toBeCloseTo(0.25, 2);

    expect(result.optionVectors).toHaveLength(2);
    expect(result.optionVectors[0]).toHaveLength(4);
    expect(result.optionVectors[1]).toHaveLength(4);

    expect(result.totalScores).toHaveLength(4);
    const scoreSum = result.totalScores.reduce((a, b) => a + b, 0);
    expect(scoreSum).toBeCloseTo(1, 4);

    // Verify 4-element ranking array
    expect(result.ranking).toHaveLength(4);
    expect([...result.ranking].sort()).toEqual([1, 2, 3, 4]);
  });
});

