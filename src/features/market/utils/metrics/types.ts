/**
 * @file types.ts
 * @description Core types and interfaces for domain-specific metrics modules in KLAROS.
 */

import type { DatasetDomain, ColumnRoles, DomainBenchmark } from '@/services/llm/domain/dataset-classifier';
import type { MarketMetrics, SalesRow, ProductRow, StockRow, InvestmentRow } from '../market-metrics-core';

export type { DatasetDomain, ColumnRoles, DomainBenchmark };

export interface DomainKpis {
  primaryMetric: {
    label: string;
    value: number;
    formatted: string;
    subtext: string;
  };
  secondaryMetric: {
    label: string;
    value: number;
    formatted: string;
    badgeText: string;
  };
  riskAlertMetric: {
    label: string;
    value: number | string;
    alertCount: number;
    statusText: string;
    isHealthy: boolean;
  };
  performanceMetric: {
    label: string;
    value: number;
    formatted: string;
    marginPct?: number;
    subtext: string;
    isEstimated?: boolean;
    benchmarkLabel?: string;
  };
}

export interface GenericDataRow extends Record<string, unknown> {}

export interface MetricDatasetInput {
  sales: SalesRow[] | GenericDataRow[];
  products?: ProductRow[] | GenericDataRow[];
  stock?: StockRow[] | GenericDataRow[];
  investments?: InvestmentRow[] | GenericDataRow[];
  domain?: DatasetDomain;
  roles?: ColumnRoles;
}

export interface MetricsModule {
  readonly domain: DatasetDomain;
  readonly benchmark: DomainBenchmark;

  computeKpis(input: MetricDatasetInput): DomainKpis;
  buildMarketMetrics(input: MetricDatasetInput): MarketMetrics;
}
