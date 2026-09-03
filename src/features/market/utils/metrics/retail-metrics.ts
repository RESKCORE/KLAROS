/**
 * @file retail-metrics.ts
 * @description Retail transaction metrics module implementing the MetricsModule interface.
 */

import type { MetricsModule, MetricDatasetInput, DomainKpis } from './types';
import { DOMAIN_METADATA } from '@/services/llm/domain/dataset-classifier';
import { buildRetailMetrics, type MarketDataset, type MarketMetrics } from '../market-metrics-core';

export class RetailMetricsModule implements MetricsModule {
  readonly domain = 'retail_transactions' as const;
  readonly benchmark = DOMAIN_METADATA.retail_transactions.defaultBenchmark!;

  computeKpis(input: MetricDatasetInput): DomainKpis {
    const metrics = this.buildMarketMetrics(input);
    const { kpis } = metrics;
    const isCostEst = kpis.isCostEstimated;
    const sym = kpis.currencySymbol || '₹';
    const loc = kpis.currency === 'GBP' ? 'en-GB' : kpis.currency === 'USD' ? 'en-US' : 'en-IN';

    return {
      primaryMetric: {
        label: 'Total Revenue',
        value: kpis.totalRevenue,
        formatted: `${sym}${kpis.totalRevenue.toLocaleString(loc)}`,
        subtext: 'Gross retail turnover',
      },
      secondaryMetric: {
        label: 'Total Units Sold',
        value: kpis.totalUnits,
        formatted: `${kpis.totalUnits.toLocaleString(loc)} units`,
        badgeText: `${kpis.skuCount.toLocaleString(loc)} active SKUs`,
      },
      riskAlertMetric: {
        label: 'Inventory Status',
        value: kpis.hasStockData === false
          ? 'Not Tracked'
          : kpis.lowStockCount > 0
          ? `${kpis.lowStockCount} SKUs Low`
          : 'Healthy',
        alertCount: kpis.hasStockData === false ? 0 : kpis.lowStockCount,
        statusText: kpis.hasStockData === false
          ? 'No stock data detected'
          : kpis.lowStockCount > 0
          ? `${kpis.lowStockCount} Reorder Alerts`
          : 'Optimal Inventory',
        isHealthy: kpis.hasStockData === false ? undefined : kpis.lowStockCount === 0,
      },
      performanceMetric: {
        label: isCostEst ? 'Net Profit (Est.)' : 'Net Profit',
        value: kpis.totalProfit,
        formatted: `${sym}${kpis.totalProfit.toLocaleString(loc)}`,
        marginPct: kpis.profitMarginPct,
        subtext: isCostEst ? 'Est. COGS (65% benchmark)' : 'Revenue minus operational COGS',
        isEstimated: isCostEst,
        benchmarkLabel: isCostEst ? '65% COGS benchmark' : undefined,
      },
    };
  }

  buildMarketMetrics(input: MetricDatasetInput): MarketMetrics {
    const dataset: MarketDataset = {
      sales: (input.sales || []) as unknown as MarketDataset['sales'],
      products: (input.products || []) as unknown as MarketDataset['products'],
      stock: (input.stock || []) as unknown as MarketDataset['stock'],
      investments: (input.investments || []) as unknown as MarketDataset['investments'],
    };

    const metrics = buildRetailMetrics(dataset);
    metrics.kpis.domain = this.domain;
    const sym = metrics.kpis.currencySymbol || '₹';
    const loc = metrics.kpis.currency === 'GBP' ? 'en-GB' : metrics.kpis.currency === 'USD' ? 'en-US' : 'en-IN';

    const domainKpis: DomainKpis = {
      primaryMetric: {
        label: 'Total Revenue',
        value: metrics.kpis.totalRevenue,
        formatted: `${sym}${metrics.kpis.totalRevenue.toLocaleString(loc)}`,
        subtext: 'Gross retail turnover',
      },
      secondaryMetric: {
        label: 'Total Units Sold',
        value: metrics.kpis.totalUnits,
        formatted: `${metrics.kpis.totalUnits.toLocaleString(loc)} units`,
        badgeText: `${metrics.kpis.skuCount.toLocaleString(loc)} active SKUs`,
      },
      riskAlertMetric: {
        label: 'Inventory Status',
        value: metrics.kpis.hasStockData === false
          ? 'Not Tracked'
          : metrics.kpis.lowStockCount > 0
          ? `${metrics.kpis.lowStockCount} SKUs Low`
          : 'Healthy',
        alertCount: metrics.kpis.hasStockData === false ? 0 : metrics.kpis.lowStockCount,
        statusText: metrics.kpis.hasStockData === false
          ? 'No stock data detected'
          : metrics.kpis.lowStockCount > 0
          ? `${metrics.kpis.lowStockCount} Reorder Alerts`
          : 'Optimal Inventory',
        isHealthy: metrics.kpis.hasStockData === false ? undefined : metrics.kpis.lowStockCount === 0,
      },
      performanceMetric: {
        label: metrics.kpis.isCostEstimated ? 'Net Profit (Est.)' : 'Net Profit',
        value: metrics.kpis.totalProfit,
        formatted: `${sym}${metrics.kpis.totalProfit.toLocaleString(loc)}`,
        marginPct: metrics.kpis.profitMarginPct,
        subtext: metrics.kpis.isCostEstimated ? 'Est. COGS (65% benchmark)' : 'Revenue minus operational COGS',
        isEstimated: metrics.kpis.isCostEstimated,
        benchmarkLabel: metrics.kpis.isCostEstimated ? '65% COGS benchmark' : undefined,
      },
    };

    metrics.kpis.domainKpis = domainKpis;
    return metrics;
  }
}
