/**
 * @file ledger-metrics.ts
 * @description Financial ledger and accounting double-entry metrics module.
 */

import type { MetricsModule, MetricDatasetInput, DomainKpis } from './types';
import { DOMAIN_METADATA } from '@/services/llm/domain/dataset-classifier';
import type { MarketMetrics } from '../market-metrics-core';
import { normalizeDateToYMD } from '../date-utils';

export class LedgerMetricsModule implements MetricsModule {
  readonly domain = 'financial_ledger' as const;
  readonly benchmark = DOMAIN_METADATA.financial_ledger.defaultBenchmark!;

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

    const getVal = (r: Record<string, unknown>, explicitKey: string | undefined, ...fallbacks: string[]) => {
      if (explicitKey && r[explicitKey] !== undefined) return r[explicitKey];
      const norm = Object.keys(r).reduce((acc, k) => {
        acc[k.toLowerCase().replace(/[^a-z0-9]/g, '')] = r[k];
        return acc;
      }, {} as Record<string, unknown>);
      for (const fb of fallbacks) {
        if (norm[fb] !== undefined) return norm[fb];
      }
      return undefined;
    };

    let totalCredits = 0; // Inflows / Income
    let totalDebits = 0;  // Outflows / Expenses
    const accounts = new Set<string>();
    const categoryMap = new Map<string, { debits: number; credits: number; count: number }>();
    const dateMap = new Map<string, { debits: number; credits: number }>();

    rows.forEach((r, idx) => {
      const rawDate = getVal(r, roles?.dateField, 'date', 'txn_date', 'entry_date') || '2024-01-01';
      const cleanDate = normalizeDateToYMD(rawDate);
      const account = String(getVal(r, roles?.idField, 'account', 'accountcode', 'voucher', 'voucherno') || `ACC-${idx + 1}`);
      const narration = String(getVal(r, roles?.nameField, 'narration', 'particulars', 'description', 'memo') || account);
      const category = String(getVal(r, roles?.categoryField, 'category', 'head', 'accounttype', 'costcentre') || 'General Ledger');

      let debit = Number(getVal(r, roles?.valueField, 'debit', 'dr', 'expense', 'outflow')) || 0;
      let credit = Number(getVal(r, roles?.secondaryValueField, 'credit', 'cr', 'income', 'inflow')) || 0;

      // Single amount column with Type (Dr/Cr)
      if (debit === 0 && credit === 0) {
        const amount = Number(getVal(r, undefined, 'amount', 'total', 'val')) || 0;
        const typeStr = String(getVal(r, undefined, 'type', 'txntype', 'drcr') || '').toLowerCase();
        if (typeStr.includes('cr') || typeStr.includes('in') || typeStr.includes('credit')) {
          credit = amount;
        } else {
          debit = amount;
        }
      }

      totalDebits += debit;
      totalCredits += credit;
      accounts.add(account);

      const catEntry = categoryMap.get(category) ?? { debits: 0, credits: 0, count: 0 };
      catEntry.debits += debit;
      catEntry.credits += credit;
      catEntry.count += 1;
      categoryMap.set(category, catEntry);

      const dEntry = dateMap.get(cleanDate) ?? { debits: 0, credits: 0 };
      dEntry.debits += debit;
      dEntry.credits += credit;
      dateMap.set(cleanDate, dEntry);
    });

    const netCashPosition = totalCredits - totalDebits;
    const isDeficit = netCashPosition < 0;
    const totalTransactions = rows.length;

    // Time Series
    const sortedDates = Array.from(dateMap.keys()).sort();
    const revenueByDate = sortedDates.map(d => {
      const entry = dateMap.get(d)!;
      return {
        date: d,
        revenue: Math.round(entry.credits),
        units: Math.round(entry.debits),
      };
    });

    // Breakdown by Head / Category
    const revenueByCategory = Array.from(categoryMap.entries()).map(([cat, d]) => ({
      category: cat,
      revenue: Math.round(d.credits),
      units: Math.round(d.debits),
      marginPct: d.credits > 0 ? Number((((d.credits - d.debits) / d.credits) * 100).toFixed(1)) : 0,
      avgDiscount: 0,
    }));

    // Top Expense Heads
    const topProducts = Array.from(categoryMap.entries())
      .map(([cat, d]) => ({
        sku: cat,
        name: `${cat} Account Head`,
        revenue: Math.round(d.debits), // Repurposed for expense magnitude
        units: d.count,
        marginPct: d.credits > 0 ? Number((((d.credits - d.debits) / d.credits) * 100).toFixed(1)) : -100,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const netMarginPct = totalCredits > 0 ? Number(((netCashPosition / totalCredits) * 100).toFixed(1)) : 0;

    // Domain KPIs
    const domainKpis: DomainKpis = {
      primaryMetric: {
        label: 'Total Inflows (Receipts)',
        value: totalCredits,
        formatted: totalCredits >= 10000000
          ? `₹${(totalCredits / 10000000).toFixed(2)} Cr`
          : `₹${Math.round(totalCredits).toLocaleString('en-IN')}`,
        subtext: 'Cumulative ledger credits & revenue',
      },
      secondaryMetric: {
        label: 'Total Outflows (Expenses)',
        value: totalDebits,
        formatted: totalDebits >= 10000000
          ? `₹${(totalDebits / 10000000).toFixed(2)} Cr`
          : `₹${Math.round(totalDebits).toLocaleString('en-IN')}`,
        badgeText: `${accounts.size} Active Accounts`,
      },
      riskAlertMetric: {
        label: 'Liquidity Status',
        value: isDeficit ? `Deficit: ₹${Math.abs(Math.round(netCashPosition)).toLocaleString('en-IN')}` : 'Cash Positive',
        alertCount: isDeficit ? 1 : 0,
        statusText: isDeficit ? 'Outflows exceed inflows (Negative Net Flow)' : 'Positive cash balance maintained',
        isHealthy: !isDeficit,
      },
      performanceMetric: {
        label: 'Net Cash Position',
        value: netCashPosition,
        formatted: `₹${Math.round(netCashPosition).toLocaleString('en-IN')}`,
        marginPct: netMarginPct,
        subtext: `${totalTransactions} journal entries recorded`,
        isEstimated: false,
        benchmarkLabel: 'Exact Measured Balance',
      },
    };

    return {
      kpis: {
        totalRevenue: Math.round(totalCredits),
        totalCost: Math.round(totalDebits),
        totalProfit: Math.round(netCashPosition),
        profitMarginPct: netMarginPct,
        totalUnits: totalTransactions,
        avgDiscount: 0,
        grossMarginPct: netMarginPct,
        skuCount: accounts.size,
        citiesCount: 1,
        lowStockCount: isDeficit ? 1 : 0,
        dataType: 'csv_data',
        inventoryValue: Math.max(0, Math.round(netCashPosition)),
        avgMarginPct: netMarginPct,
        costDataType: 'measured',
        isCostEstimated: false,
        isCategoryInferred: false,
        domain: this.domain,
        domainKpis,
      },
      revenueByDate,
      revenueByCategory,
      paymentMethodShare: revenueByCategory.map(c => ({ method: c.category, revenue: c.revenue })),
      paymentLabel: 'Ledger Accounts',
      topProducts,
      investmentRoi: [],
      inventory: [],
      inventorySummary: { belowReorder: isDeficit ? 1 : 0, avgStockRatio: 1.0 },
      categoryRadar: [
        { metric: 'Credits', ...Object.fromEntries(revenueByCategory.map(c => [c.category, c.revenue])) },
        { metric: 'Debits', ...Object.fromEntries(revenueByCategory.map(c => [c.category, c.units])) },
      ],
      categoryNames: revenueByCategory.map(c => c.category),
    };
  }
}
