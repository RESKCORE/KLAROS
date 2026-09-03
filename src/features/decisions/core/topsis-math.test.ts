import { describe, expect, it } from 'vitest';
import {
  topsisSynthesis,
  calculateSpearmanCorrelation,
} from './topsis-math';

describe('topsis-math', () => {
  describe('calculateSpearmanCorrelation', () => {
    it('returns 1.0 for identical rankings', () => {
      const rho = calculateSpearmanCorrelation([1, 2, 3], [1, 2, 3]);
      expect(rho).toBe(1.0);
    });

    it('returns -1.0 for completely inverted rankings', () => {
      const rho = calculateSpearmanCorrelation([1, 2, 3], [3, 2, 1]);
      expect(rho).toBe(-1.0);
    });

    it('computes intermediate correlation for partially concordant ranks', () => {
      const rho = calculateSpearmanCorrelation([1, 2, 3, 4], [1, 3, 2, 4]);
      expect(rho).toBeCloseTo(0.8, 1);
    });
  });

  describe('topsisSynthesis', () => {
    it('synthesizes a 3-option, 3-criteria decision matrix deterministically', () => {
      const decisionMatrix = [
        [80, 70, 90], // Option 1
        [60, 95, 65], // Option 2
        [90, 60, 70], // Option 3
      ];
      const weights = [0.5, 0.3, 0.2];
      const options = [
        { id: 'o1', label: 'Expand High-Margin Beverages' },
        { id: 'o2', label: 'Run Clearance on Slow Bakery' },
        { id: 'o3', label: 'Renegotiate Dairy Vendor Terms' },
      ];
      const ahpTotalScores = [80, 68, 72];

      const result = topsisSynthesis({
        decisionMatrix,
        weights,
        options,
        ahpTotalScores,
      });

      expect(result.alternatives).toHaveLength(3);
      expect(result.alternatives[0].closenessScore).toBeGreaterThan(0);
      expect(result.alternatives[0].closenessScore).toBeLessThanOrEqual(1);

      // Verify ranks are valid permutations of 1..3
      const ranks = result.alternatives.map((a) => a.topsisRank);
      expect(ranks.sort()).toEqual([1, 2, 3]);

      // Verify positive and negative ideal solutions have dimension 3
      expect(result.positiveIdealSolution).toHaveLength(3);
      expect(result.negativeIdealSolution).toHaveLength(3);

      // Verify rank concordance calculation
      expect(result.rankConcordancePercent).toBeGreaterThanOrEqual(0);
      expect(result.rankConcordancePercent).toBeLessThanOrEqual(100);
    });

    it('handles degenerate / uniform decision matrix gracefully', () => {
      const decisionMatrix = [
        [50, 50],
        [50, 50],
      ];
      const weights = [0.5, 0.5];
      const options = [
        { id: 'o1', label: 'Option A' },
        { id: 'o2', label: 'Option B' },
      ];

      const result = topsisSynthesis({
        decisionMatrix,
        weights,
        options,
      });

      expect(result.alternatives).toHaveLength(2);
      expect(result.alternatives[0].closenessScore).toBe(0.5);
      expect(result.alternatives[1].closenessScore).toBe(0.5);
    });

    it('correctly incorporates cost criteria vs benefit criteria', () => {
      const decisionMatrix = [
        [100, 10], // High benefit, low cost
        [50, 90],  // Lower benefit, high cost
      ];
      const weights = [0.5, 0.5];
      const options = [
        { id: 'o1', label: 'Good Strategy' },
        { id: 'o2', label: 'Costly Strategy' },
      ];

      const result = topsisSynthesis({
        decisionMatrix,
        weights,
        options,
        criteriaTypes: ['benefit', 'cost'],
      });

      expect(result.alternatives[0].topsisRank).toBe(1);
      expect(result.alternatives[1].topsisRank).toBe(2);
      expect(result.alternatives[0].closenessScore).toBeGreaterThan(result.alternatives[1].closenessScore);
    });
  });
});
