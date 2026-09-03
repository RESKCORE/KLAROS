/**
 * @file securities-metrics.ts
 * @description Market securities metrics module for stocks, ETFs, crypto, and equities.
 */

import type { MetricsModule, MetricDatasetInput, DomainKpis } from './types';
import { DOMAIN_METADATA } from '@/services/llm/domain/dataset-classifier';
import type { MarketMetrics } from '../market-metrics-core';
import { normalizeDateToYMD } from '../date-utils';

export class SecuritiesMetricsModule implements MetricsModule {
  readonly domain = 'market_securities' as const;
  readonly benchmark = DOMAIN_METADATA.market_securities.defaultBenchmark!;

  computeKpis(input: MetricDatasetInput): DomainKpis {
    const metrics = this.buildMarketMetrics(input);
    return metrics.kpis.domainKpis!;
  }

  buildMarketMetrics(input: MetricDatasetInput): MarketMetrics {
    const rows = (input.sales || []) as Record<string, unknown>[];
    const roles = input.roles;

    // Helper to extract field case-insensitively
    const getVal = (row: Record<string, unknown>, preferred?: string, ...fallbacks: string[]): unknown => {
      if (preferred && row[preferred] !== undefined) return row[preferred];
      for (const f of fallbacks) {
        if (row[f] !== undefined) return row[f];
      }
      for (const [k, v] of Object.entries(row)) {
        const clean = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const target of [preferred, ...fallbacks]) {
          if (target && clean === target.toLowerCase().replace(/[^a-z0-9]/g, '')) return v;
        }
      }
      return undefined;
    };

    let totalTradedValue = 0;
    let totalSharesVolume = 0;
    const tickers = new Set<string>();
    const dateMap = new Map<string, { close: number; volume: number; count: number }>();
    const tickerMap = new Map<string, { closeValues: number[]; volume: number }>();

    // Parse and sort rows by date
    const parsedRows = rows.map((r) => {
      const rawDate = getVal(r, roles?.dateField, 'date', 'time', 'timestamp') || '2024-01-01';
      const cleanDate = normalizeDateToYMD(rawDate);
      const ticker = String(getVal(r, roles?.idField, 'ticker', 'symbol', 'isin', 'code') || 'ASSET');
      const close = Number(getVal(r, roles?.valueField, 'close', 'adjclose', 'price', 'lastprice', 'nav')) || 0;
      const volume = Number(getVal(r, roles?.volumeField, 'volume', 'vol', 'shares', 'qty')) || 1;
      const open = Number(getVal(r, roles?.secondaryValueField, 'open')) || close;
      const high = Number(getVal(r, undefined, 'high')) || Math.max(open, close);
      const low = Number(getVal(r, undefined, 'low')) || Math.min(open, close);

      return { date: cleanDate, ticker, close, volume, open, high, low };
    }).filter(r => r.close > 0);

    parsedRows.sort((a, b) => a.date.localeCompare(b.date));

    for (const r of parsedRows) {
      const tradeValue = r.volume > 1 ? r.close * r.volume : r.close;
      totalTradedValue += tradeValue;
      totalSharesVolume += r.volume;
      tickers.add(r.ticker);

      const dEntry = dateMap.get(r.date) ?? { close: 0, volume: 0, count: 0 };
      dEntry.close += r.close;
      dEntry.volume += r.volume;
      dEntry.count += 1;
      dateMap.set(r.date, dEntry);

      const tEntry = tickerMap.get(r.ticker) ?? { closeValues: [], volume: 0 };
      tEntry.closeValues.push(r.close);
      tEntry.volume += r.volume;
      tickerMap.set(r.ticker, tEntry);
    }

    // Return & Volatility Calculation
    const dates = Array.from(dateMap.keys()).sort();
    const dailyCloses: number[] = dates.map(d => {
      const entry = dateMap.get(d)!;
      return entry.close / (entry.count || 1);
    });

    const dailyReturns: number[] = [];
    for (let i = 1; i < dailyCloses.length; i++) {
      const prev = dailyCloses[i - 1];
      if (prev > 0) {
        dailyReturns.push((dailyCloses[i] - prev) / prev);
      }
    }

    // Cumulative Return
    let cumulativeReturnPct = 0;
    if (dailyCloses.length >= 2 && dailyCloses[0] > 0) {
      cumulativeReturnPct = ((dailyCloses[dailyCloses.length - 1] - dailyCloses[0]) / dailyCloses[0]) * 100;
    }

    // Annualized Volatility
    let annualizedVolPct = 12.5; // Baseline
    if (dailyReturns.length > 2) {
      const mean = dailyReturns.reduce((s, x) => s + x, 0) / dailyReturns.length;
      const variance = dailyReturns.reduce((s, x) => s + Math.pow(x - mean, 2), 0) / (dailyReturns.length - 1);
      const dailyStd = Math.sqrt(variance);
      annualizedVolPct = Number((dailyStd * Math.sqrt(252) * 100).toFixed(1));
    }

    // Maximum Drawdown
    let maxDrawdownPct = 0;
    let peak = -Infinity;
    for (const p of dailyCloses) {
      if (p > peak) peak = p;
      const dd = peak > 0 ? ((peak - p) / peak) * 100 : 0;
      if (dd > maxDrawdownPct) maxDrawdownPct = dd;
    }

    const highVolatilityRisk = annualizedVolPct > 28 || maxDrawdownPct > 20;

    // Time Series
    const revenueByDate = dates.map(d => {
      const entry = dateMap.get(d)!;
      return {
        date: d,
        revenue: Math.round(entry.volume > 1 ? (entry.close / entry.count) * entry.volume : entry.close),
        units: entry.volume,
      };
    });

    // Top Tickers
    const topProducts = Array.from(tickerMap.entries())
      .map(([ticker, data]) => {
        const first = data.closeValues[0] || 1;
        const last = data.closeValues[data.closeValues.length - 1] || first;
        const tickerReturn = Number((((last - first) / first) * 100).toFixed(1));
        const avgPrice = data.closeValues.reduce((s, v) => s + v, 0) / data.closeValues.length;
        const totalVal = Math.round(avgPrice * data.volume);

        return {
          sku: ticker,
          name: `${ticker} Security`,
          revenue: totalVal,
          units: data.volume,
          marginPct: tickerReturn, // Re-purposed as % Return
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    // Revenue by Category (Tickers or Market Segments)
    const revenueByCategory = topProducts.slice(0, 8).map(p => ({
      category: p.sku,
      revenue: p.revenue,
      units: p.units,
      marginPct: p.marginPct,
      avgDiscount: 0,
    }));

    // Construct Domain KPIs
    const domainKpis: DomainKpis = {
      primaryMetric: {
        label: 'Total Traded Turnover',
        value: totalTradedValue,
        formatted: totalTradedValue >= 10000000
          ? `₹${(totalTradedValue / 10000000).toFixed(2)} Cr`
          : `₹${Math.round(totalTradedValue).toLocaleString('en-IN')}`,
        subtext: 'Cumulative asset turnover value',
      },
      secondaryMetric: {
        label: 'Volume Traded',
        value: totalSharesVolume,
        formatted: `${totalSharesVolume.toLocaleString('en-IN')} shares/units`,
        badgeText: `${tickers.size} Tracked Assets`,
      },
      riskAlertMetric: {
        label: 'Market Volatility',
        value: `${annualizedVolPct}% Ann. Vol`,
        alertCount: highVolatilityRisk ? 1 : 0,
        statusText: highVolatilityRisk ? `High Volatility (${maxDrawdownPct.toFixed(1)}% Max Drawdown)` : 'Moderate Risk Profile',
        isHealthy: !highVolatilityRisk,
      },
      performanceMetric: {
        label: 'Asset Return',
        value: cumulativeReturnPct,
        formatted: `${cumulativeReturnPct >= 0 ? '+' : ''}${cumulativeReturnPct.toFixed(2)}%`,
        marginPct: cumulativeReturnPct,
        subtext: `${annualizedVolPct}% annualized volatility • ${maxDrawdownPct.toFixed(1)}% max drawdown`,
        isEstimated: false,
        benchmarkLabel: 'Market Price Return',
      },
    };

    return {
      kpis: {
        totalRevenue: Math.round(totalTradedValue),
        totalCost: Math.round(totalTradedValue * 0.9),
        totalProfit: Math.round(totalTradedValue * (cumulativeReturnPct / 100)),
        profitMarginPct: Number(cumulativeReturnPct.toFixed(1)),
        totalUnits: totalSharesVolume,
        avgDiscount: 0,
        grossMarginPct: Number(cumulativeReturnPct.toFixed(1)),
        skuCount: tickers.size,
        citiesCount: 1,
        lowStockCount: highVolatilityRisk ? 1 : 0,
        dataType: 'csv_data',
        inventoryValue: Math.round(totalTradedValue),
        avgMarginPct: Number(cumulativeReturnPct.toFixed(1)),
        costDataType: 'measured',
        isCostEstimated: false,
        isCategoryInferred: false,
        domain: this.domain,
        domainKpis,
      },
      revenueByDate,
      revenueByCategory,
      paymentMethodShare: [{ method: 'Exchange Traded', revenue: totalTradedValue }],
      paymentLabel: 'Trading Venue',
      topProducts,
      investmentRoi: dates.slice(-5).map((d, i) => ({
        date: d,
        expected: 10,
        actual: dailyReturns[i] ? dailyReturns[i] * 100 : 0,
        amount: Math.round(totalTradedValue / dates.length),
        category: 'Market Position',
      })),
      inventory: topProducts.slice(0, 5).map(p => ({
        sku: p.sku,
        name: p.name,
        beginningStock: p.units,
        unitsSold: Math.round(p.units * 0.3),
        reorderPoint: Math.round(p.units * 0.1),
        stockRatio: 2.5,
        leadTime: 0,
      })),
      inventorySummary: { belowReorder: highVolatilityRisk ? 1 : 0, avgStockRatio: 2.5 },
      categoryRadar: [
        { metric: 'Volume', ...Object.fromEntries(revenueByCategory.map(c => [c.category, c.units])) },
        { metric: 'Value', ...Object.fromEntries(revenueByCategory.map(c => [c.category, c.revenue])) },
      ],
      categoryNames: revenueByCategory.map(c => c.category),
    };
  }
}
