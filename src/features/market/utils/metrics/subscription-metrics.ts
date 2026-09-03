/**
 * @file subscription-metrics.ts
 * @description SaaS and recurring subscription revenue metrics module.
 */

import type { MetricsModule, MetricDatasetInput, DomainKpis } from './types';
import { DOMAIN_METADATA } from '@/services/llm/domain/dataset-classifier';
import type { MarketMetrics } from '../market-metrics-core';
import { normalizeDateToYMD } from '../date-utils';

export class SubscriptionMetricsModule implements MetricsModule {
  readonly domain = 'subscription_saas' as const;
  readonly benchmark = DOMAIN_METADATA.subscription_saas.defaultBenchmark!;

  computeKpis(input: MetricDatasetInput): DomainKpis {
    const metrics = this.buildMarketMetrics(input);
    return metrics.kpis.domainKpis!;
  }

  buildMarketMetrics(input: MetricDatasetInput): MarketMetrics {
    const rows = (input.sales || []) as Record<string, unknown>[];
    const roles = input.roles;

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

    let totalMrr = 0;
    let totalSeats = 0;
    let churnCount = 0;
    const planMap = new Map<string, { mrr: number; users: number }>();
    const customerList: {
      id: string;
      name: string;
      plan: string;
      mrr: number;
      seats: number;
      isChurned: boolean;
      date: string;
    }[] = [];

    rows.forEach((r, idx) => {
      const id = String(getVal(r, roles?.idField, 'customerid', 'subscriberid', 'accountid') || `SUB-${idx + 1}`);
      const name = String(getVal(r, roles?.nameField, 'customername', 'name', 'account') || id);
      const plan = String(getVal(r, roles?.categoryField, 'plan', 'tier', 'subscriptiontier', 'package') || 'Standard Plan');
      const mrr = Number(getVal(r, roles?.valueField, 'mrr', 'amount', 'fee', 'charge', 'price')) || 500;
      const seats = Number(getVal(r, roles?.volumeField, 'seats', 'licenses', 'quantity')) || 1;
      const date = normalizeDateToYMD(getVal(r, roles?.dateField, 'renewaldate', 'startdate', 'date') || '2024-01-01');

      const statusStr = String(getVal(r, undefined, 'status', 'churn', 'isactive') || '').toLowerCase();
      const isChurned = statusStr.includes('churn') || statusStr.includes('cancel') || statusStr.includes('expire') || statusStr === 'inactive';

      if (isChurned) {
        churnCount += 1;
      } else {
        totalMrr += mrr;
        totalSeats += seats;

        const p = planMap.get(plan) ?? { mrr: 0, users: 0 };
        p.mrr += mrr;
        p.users += 1;
        planMap.set(plan, p);
      }

      customerList.push({ id, name, plan, mrr, seats, isChurned, date });
    });

    const arr = totalMrr * 12;
    const activeSubscribers = customerList.filter(c => !c.isChurned).length;
    // SaaS Standard 80% gross margin benchmark (20% hosting/infrastructure COGS)
    const saasCogs = Math.round(totalMrr * 0.20);
    const saasGrossProfit = totalMrr - saasCogs;

    customerList.sort((a, b) => b.mrr - a.mrr);

    const revenueByCategory = Array.from(planMap.entries()).map(([plan, d]) => ({
      category: plan,
      revenue: Math.round(d.mrr),
      units: d.users,
      marginPct: 80.0,
      avgDiscount: 0,
    }));

    const topProducts = customerList.slice(0, 10).map(c => ({
      sku: c.id,
      name: `${c.name} (${c.plan})`,
      revenue: Math.round(c.mrr),
      units: c.seats,
      marginPct: c.isChurned ? 0 : 80,
    }));

    const revenueByDate = [
      { date: new Date().toISOString().split('T')[0], revenue: Math.round(totalMrr), units: activeSubscribers },
    ];

    const domainKpis: DomainKpis = {
      primaryMetric: {
        label: 'Monthly Recurring Revenue',
        value: totalMrr,
        formatted: totalMrr >= 10000000
          ? `₹${(totalMrr / 10000000).toFixed(2)} Cr`
          : `₹${Math.round(totalMrr).toLocaleString('en-IN')}`,
        subtext: `₹${Math.round(arr).toLocaleString('en-IN')} Annualized Run-Rate (ARR)`,
      },
      secondaryMetric: {
        label: 'Active Subscribers',
        value: activeSubscribers,
        formatted: `${activeSubscribers.toLocaleString('en-IN')} accounts`,
        badgeText: `${planMap.size} Subscription Tiers`,
      },
      riskAlertMetric: {
        label: 'Churn Risk',
        value: churnCount > 0 ? `${churnCount} Churned Accounts` : 'Healthy Retention',
        alertCount: churnCount,
        statusText: churnCount > 0 ? `${churnCount} accounts lost or expired` : 'Zero churn detected',
        isHealthy: churnCount === 0,
      },
      performanceMetric: {
        label: 'SaaS Gross Margin',
        value: saasGrossProfit,
        formatted: `₹${Math.round(saasGrossProfit).toLocaleString('en-IN')}/mo`,
        marginPct: 80.0,
        subtext: 'Modeled at 80% software margin benchmark (20% hosting COGS)',
        isEstimated: true,
        benchmarkLabel: '80% SaaS Benchmark Margin',
      },
    };

    return {
      kpis: {
        totalRevenue: Math.round(totalMrr),
        totalCost: saasCogs,
        totalProfit: Math.round(saasGrossProfit),
        profitMarginPct: 80.0,
        totalUnits: activeSubscribers,
        avgDiscount: 0,
        grossMarginPct: 80.0,
        skuCount: customerList.length,
        citiesCount: planMap.size,
        lowStockCount: churnCount,
        dataType: 'csv_data',
        inventoryValue: Math.round(arr),
        avgMarginPct: 80.0,
        costDataType: 'estimated',
        isCostEstimated: true,
        isCategoryInferred: false,
        domain: this.domain,
        domainKpis,
      },
      revenueByDate,
      revenueByCategory,
      paymentMethodShare: revenueByCategory.map(c => ({ method: c.category, revenue: c.revenue })),
      paymentLabel: 'Subscription Plans',
      topProducts,
      investmentRoi: [],
      inventory: [],
      inventorySummary: { belowReorder: churnCount, avgStockRatio: 1.0 },
      categoryRadar: [
        { metric: 'MRR', ...Object.fromEntries(revenueByCategory.map(c => [c.category, c.revenue])) },
        { metric: 'Users', ...Object.fromEntries(revenueByCategory.map(c => [c.category, c.units])) },
      ],
      categoryNames: revenueByCategory.map(c => c.category),
    };
  }
}
