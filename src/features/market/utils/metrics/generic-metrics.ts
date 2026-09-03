/**
 * @file generic-metrics.ts
 * @description Universal domain-agnostic fallback metrics module.
 * Safely computes descriptive statistics and distributions for any tabular dataset without throwing errors.
 */

import type { MetricsModule, MetricDatasetInput, DomainKpis } from './types';
import { DOMAIN_METADATA } from '@/services/llm/domain/dataset-classifier';
import type { MarketMetrics } from '../market-metrics-core';
import { normalizeDateToYMD } from '../date-utils';

export class GenericMetricsModule implements MetricsModule {
  readonly domain = 'generic_tabular' as const;
  readonly benchmark = DOMAIN_METADATA.generic_tabular.defaultBenchmark!;

  computeKpis(input: MetricDatasetInput): DomainKpis {
    const metrics = this.buildMarketMetrics(input);
    return metrics.kpis.domainKpis!;
  }

  buildMarketMetrics(input: MetricDatasetInput): MarketMetrics {
    const rows = (input.sales || []) as Record<string, unknown>[];
    const roles = input.roles;

    if (rows.length === 0) {
      return this.buildEmptyMetrics();
    }

    // Discover numeric and string columns
    const firstRow = rows[0];
    const numericKeys: string[] = [];
    const stringKeys: string[] = [];

    for (const [k, v] of Object.entries(firstRow)) {
      if (typeof v === 'number') numericKeys.push(k);
      else if (typeof v === 'string') stringKeys.push(k);
    }

    const valueCol = roles?.valueField || numericKeys[0] || Object.keys(firstRow)[1] || Object.keys(firstRow)[0];
    const volumeCol = roles?.volumeField || numericKeys[1] || numericKeys[0];
    const categoryCol = roles?.categoryField || stringKeys[0] || Object.keys(firstRow)[0];
    const idCol = roles?.idField || stringKeys[0] || Object.keys(firstRow)[0];
    const dateCol = roles?.dateField || stringKeys.find(k => k.toLowerCase().includes('date') || k.toLowerCase().includes('time'));

    let totalSum = 0;
    let totalVolume = 0;
    let missingValuesCount = 0;
    const categoryMap = new Map<string, { sum: number; count: number }>();
    const dateMap = new Map<string, { sum: number; count: number }>();
    const entityList: { id: string; name: string; value: number }[] = [];

    rows.forEach((r, idx) => {
      const rawVal = r[valueCol];
      const val = typeof rawVal === 'number' ? rawVal : Number(rawVal) || 0;
      const rawVol = volumeCol ? r[volumeCol] : 1;
      const vol = typeof rawVol === 'number' ? rawVol : Number(rawVol) || 1;

      if (rawVal === null || rawVal === undefined || rawVal === '') missingValuesCount++;

      totalSum += val;
      totalVolume += vol;

      const cat = String(r[categoryCol] || 'General');
      const c = categoryMap.get(cat) ?? { sum: 0, count: 0 };
      c.sum += val;
      c.count += 1;
      categoryMap.set(cat, c);

      const id = String(r[idCol] || `Item-${idx + 1}`);
      entityList.push({ id, name: id, value: val });

      if (dateCol && r[dateCol]) {
        const rawDate = normalizeDateToYMD(r[dateCol]);
        const d = dateMap.get(rawDate) ?? { sum: 0, count: 0 };
        d.sum += val;
        d.count += 1;
        dateMap.set(rawDate, d);
      }
    });

    const avgVal = rows.length > 0 ? totalSum / rows.length : 0;
    entityList.sort((a, b) => b.value - a.value);

    // Build timeline
    const dates = Array.from(dateMap.keys()).sort();
    const revenueByDate = dates.length > 0
      ? dates.map(d => {
          const entry = dateMap.get(d)!;
          return { date: d, revenue: Math.round(entry.sum), units: entry.count };
        })
      : [{ date: new Date().toISOString().split('T')[0], revenue: Math.round(totalSum), units: rows.length }];

    // Build categories
    const revenueByCategory = Array.from(categoryMap.entries()).slice(0, 10).map(([cat, d]) => ({
      category: cat,
      revenue: Math.round(d.sum),
      units: d.count,
      marginPct: 100,
      avgDiscount: 0,
    }));

    // Build Top Entities
    const topProducts = entityList.slice(0, 10).map(e => ({
      sku: e.id,
      name: e.name,
      revenue: Math.round(e.value),
      units: 1,
      marginPct: 100,
    }));

    const domainKpis: DomainKpis = {
      primaryMetric: {
        label: `${valueCol.replace(/_/g, ' ')} (Sum)`,
        value: totalSum,
        formatted: totalSum >= 10000000
          ? `₹${(totalSum / 10000000).toFixed(2)} Cr`
          : totalSum >= 1000
          ? `₹${Math.round(totalSum).toLocaleString('en-IN')}`
          : totalSum.toFixed(2),
        subtext: `Mean: ${avgVal.toFixed(2)} across records`,
      },
      secondaryMetric: {
        label: 'Total Records',
        value: rows.length,
        formatted: `${rows.length.toLocaleString('en-IN')} rows`,
        badgeText: `${categoryMap.size} Groups / Categories`,
      },
      riskAlertMetric: {
        label: 'Data Completeness',
        value: missingValuesCount > 0 ? `${missingValuesCount} Missing Fields` : '100% Complete',
        alertCount: missingValuesCount,
        statusText: missingValuesCount > 0 ? `${missingValuesCount} null or empty values detected` : 'Clean data distribution',
        isHealthy: missingValuesCount === 0,
      },
      performanceMetric: {
        label: 'Distribution Spread',
        value: totalSum,
        formatted: `${categoryMap.size} Unique Segments`,
        marginPct: 100,
        subtext: 'General multi-attribute business metrics',
        isEstimated: false,
        benchmarkLabel: 'Universal Tabular Aggregation',
      },
    };

    return {
      kpis: {
        totalRevenue: Math.round(totalSum),
        totalCost: 0,
        totalProfit: Math.round(totalSum),
        profitMarginPct: 100.0,
        totalUnits: rows.length,
        avgDiscount: 0,
        grossMarginPct: 100.0,
        skuCount: entityList.length,
        citiesCount: categoryMap.size,
        lowStockCount: missingValuesCount,
        dataType: 'csv_data',
        inventoryValue: Math.round(totalSum),
        avgMarginPct: 100.0,
        costDataType: 'measured',
        isCostEstimated: false,
        isCategoryInferred: false,
        domain: this.domain,
        domainKpis,
      },
      revenueByDate,
      revenueByCategory,
      paymentMethodShare: revenueByCategory.map(c => ({ method: c.category, revenue: c.revenue })),
      paymentLabel: 'Category Distribution',
      topProducts,
      investmentRoi: [],
      inventory: [],
      inventorySummary: { belowReorder: missingValuesCount, avgStockRatio: 1.0 },
      categoryRadar: [
        { metric: 'Value', ...Object.fromEntries(revenueByCategory.map(c => [c.category, c.revenue])) },
        { metric: 'Count', ...Object.fromEntries(revenueByCategory.map(c => [c.category, c.units])) },
      ],
      categoryNames: revenueByCategory.map(c => c.category),
    };
  }

  private buildEmptyMetrics(): MarketMetrics {
    const domainKpis: DomainKpis = {
      primaryMetric: { label: 'Total Value', value: 0, formatted: '0', subtext: 'No data rows' },
      secondaryMetric: { label: 'Record Count', value: 0, formatted: '0 rows', badgeText: 'Empty' },
      riskAlertMetric: { label: 'Data Status', value: 'No Records', alertCount: 0, statusText: 'Empty table', isHealthy: true },
      performanceMetric: { label: 'Distribution', value: 0, formatted: 'N/A', subtext: 'No data', isEstimated: false },
    };

    return {
      kpis: {
        totalRevenue: 0,
        totalCost: 0,
        totalProfit: 0,
        profitMarginPct: 0,
        totalUnits: 0,
        avgDiscount: 0,
        grossMarginPct: 0,
        skuCount: 0,
        citiesCount: 0,
        lowStockCount: 0,
        dataType: 'csv_data',
        inventoryValue: 0,
        avgMarginPct: 0,
        costDataType: 'measured',
        isCostEstimated: false,
        isCategoryInferred: false,
        domain: this.domain,
        domainKpis,
      },
      revenueByDate: [],
      revenueByCategory: [],
      paymentMethodShare: [],
      topProducts: [],
      investmentRoi: [],
      inventory: [],
      inventorySummary: { belowReorder: 0, avgStockRatio: 0 },
      categoryRadar: [],
      categoryNames: [],
    };
  }
}
