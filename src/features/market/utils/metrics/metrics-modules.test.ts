/**
 * @file metrics-modules.test.ts
 * @description Comprehensive unit tests for domain-specific metrics modules.
 */

import { describe, it, expect } from 'vitest';
import { getMetricsModule } from './index';
import { RetailMetricsModule } from './retail-metrics';
import { SecuritiesMetricsModule } from './securities-metrics';
import { InventoryMetricsModule } from './inventory-metrics';
import { LedgerMetricsModule } from './ledger-metrics';
import { SubscriptionMetricsModule } from './subscription-metrics';
import { GenericMetricsModule } from './generic-metrics';
import { buildMetrics } from '../market-metrics-core';

describe('Domain-Specific Metrics Modules', () => {
  // ── 1. Factory Dispatcher ─────────────────────────────────────────────────
  it('returns the correct MetricsModule instance for each domain', () => {
    expect(getMetricsModule('retail_transactions')).toBeInstanceOf(RetailMetricsModule);
    expect(getMetricsModule('market_securities')).toBeInstanceOf(SecuritiesMetricsModule);
    expect(getMetricsModule('inventory_stock')).toBeInstanceOf(InventoryMetricsModule);
    expect(getMetricsModule('financial_ledger')).toBeInstanceOf(LedgerMetricsModule);
    expect(getMetricsModule('subscription_saas')).toBeInstanceOf(SubscriptionMetricsModule);
    expect(getMetricsModule('generic_tabular')).toBeInstanceOf(GenericMetricsModule);
    expect(getMetricsModule(undefined)).toBeInstanceOf(RetailMetricsModule);
  });

  // ── 2. Retail Module Regression Verification ──────────────────────────────
  it('RetailMetricsModule computes accurate retail KPIs without regression', () => {
    const module = new RetailMetricsModule();
    const dataset = {
      sales: [
        { sku: 'SKU-1', date: '2024-01-01', quantity: 10, revenue: 1000, discount: 0, payment_method: 'Card', store_city: 'Mumbai' },
        { sku: 'SKU-2', date: '2024-01-02', quantity: 5, revenue: 500, discount: 0, payment_method: 'Cash', store_city: 'Delhi' },
      ],
      products: [
        { sku: 'SKU-1', name: 'Coffee Beans 500g', category: 'Kitchen & Dining', subcategory: 'Coffee', brand: 'BrandA', price: 100, cost: 60, supplier: 'S1', shelf_life_days: 180, weight_kg: 0.5, launch_date: '2024-01-01' },
        { sku: 'SKU-2', name: 'Ceramic Teacup', category: 'Kitchen & Dining', subcategory: 'Mugs', brand: 'BrandB', price: 100, cost: 70, supplier: 'S2', shelf_life_days: 365, weight_kg: 0.3, launch_date: '2024-01-01' },
      ],
      stock: [],
      investments: [],
    };

    const metrics = module.buildMarketMetrics(dataset);
    expect(metrics.kpis.totalRevenue).toBe(1500);
    expect(metrics.kpis.totalUnits).toBe(15);
    expect(metrics.kpis.skuCount).toBe(2);
    expect(metrics.kpis.domain).toBe('retail_transactions');
    expect(metrics.kpis.domainKpis?.primaryMetric.label).toBe('Total Revenue');
  });

  // ── 3. Market Securities Module ───────────────────────────────────────────
  it('SecuritiesMetricsModule computes turnover, return %, and volatility from OHLC + Volume data', () => {
    const module = new SecuritiesMetricsModule();
    const ohlcRows = [
      { Date: '2024-01-01', Ticker: 'INFY', Open: 1400, High: 1420, Low: 1395, Close: 1410, Volume: 1000 },
      { Date: '2024-01-02', Ticker: 'INFY', Open: 1410, High: 1440, Low: 1405, Close: 1435, Volume: 1200 },
      { Date: '2024-01-03', Ticker: 'INFY', Open: 1435, High: 1460, Low: 1430, Close: 1450, Volume: 1100 },
    ];

    const metrics = module.buildMarketMetrics({ sales: ohlcRows, domain: 'market_securities' });
    expect(metrics.kpis.domain).toBe('market_securities');
    expect(metrics.kpis.totalUnits).toBe(3300); // Total volume traded
    expect(metrics.kpis.totalRevenue).toBeGreaterThan(0); // Total turnover value
    expect(metrics.kpis.domainKpis?.primaryMetric.label).toBe('Total Traded Turnover');
    expect(metrics.kpis.domainKpis?.performanceMetric.label).toBe('Asset Return');
    expect(metrics.kpis.profitMarginPct).toBeCloseTo(2.84, 1); // (1450 - 1410) / 1410 * 100 = 2.84% return
  });

  // ── 4. Inventory Stock Module ─────────────────────────────────────────────
  it('InventoryMetricsModule computes warehouse valuation, carrying cost, and reorder alerts', () => {
    const module = new InventoryMetricsModule();
    const inventoryRows = [
      { SKU: 'BOLT-10', Item_Name: 'M10 Bolt', Warehouse: 'North Hub', On_Hand: 50, Reorder_Point: 100, Unit_Cost: 20 },
      { SKU: 'NUT-10', Item_Name: 'M10 Nut', Warehouse: 'South Hub', On_Hand: 500, Reorder_Point: 100, Unit_Cost: 5 },
    ];

    const metrics = module.buildMarketMetrics({ sales: inventoryRows, domain: 'inventory_stock' });
    expect(metrics.kpis.domain).toBe('inventory_stock');
    expect(metrics.kpis.totalRevenue).toBe(3500); // 50*20 + 500*5 = 1000 + 2500 = 3500 total valuation
    expect(metrics.kpis.totalUnits).toBe(550); // Total on hand
    expect(metrics.kpis.lowStockCount).toBe(1); // BOLT-10 is below reorder point (50 <= 100)
    expect(metrics.kpis.domainKpis?.primaryMetric.label).toBe('Total Inventory Valuation');
    expect(metrics.kpis.domainKpis?.riskAlertMetric.statusText).toContain('below reorder threshold');
    expect(metrics.kpis.domainKpis?.performanceMetric.benchmarkLabel).toBe('18% Carrying Cost Benchmark');
  });

  // ── 5. Financial Ledger Module ────────────────────────────────────────────
  it('LedgerMetricsModule computes inflows, outflows, and net cash position', () => {
    const module = new LedgerMetricsModule();
    const ledgerRows = [
      { Date: '2024-02-01', Account: 'Consulting Income', Particulars: 'Client Invoice #88', Debit: 0, Credit: 80000, Category: 'Revenue' },
      { Date: '2024-02-02', Account: 'Office Rent', Particulars: 'Feb Rent', Debit: 25000, Credit: 0, Category: 'Facilities' },
      { Date: '2024-02-03', Account: 'Cloud Hosting', Particulars: 'AWS Monthly', Debit: 15000, Credit: 0, Category: 'Infrastructure' },
    ];

    const metrics = module.buildMarketMetrics({ sales: ledgerRows, domain: 'financial_ledger' });
    expect(metrics.kpis.domain).toBe('financial_ledger');
    expect(metrics.kpis.totalRevenue).toBe(80000); // Total Credits (Inflow)
    expect(metrics.kpis.totalCost).toBe(40000); // Total Debits (Outflow)
    expect(metrics.kpis.totalProfit).toBe(40000); // Net cash position: 80000 - 40000 = 40000
    expect(metrics.kpis.profitMarginPct).toBe(50.0);
    expect(metrics.kpis.domainKpis?.primaryMetric.label).toBe('Total Inflows (Receipts)');
    expect(metrics.kpis.domainKpis?.secondaryMetric.label).toBe('Total Outflows (Expenses)');
    expect(metrics.kpis.domainKpis?.performanceMetric.label).toBe('Net Cash Position');
    expect(metrics.kpis.domainKpis?.riskAlertMetric.isHealthy).toBe(true);
  });

  // ── 6. Subscription SaaS Module ───────────────────────────────────────────
  it('SubscriptionMetricsModule computes MRR, ARR, active subscribers, and SaaS 80% margin', () => {
    const module = new SubscriptionMetricsModule();
    const subRows = [
      { Customer_ID: 'C1', Customer_Name: 'Alpha Inc', Plan: 'Pro Tier', MRR: 5000, Seats: 10, Status: 'Active' },
      { Customer_ID: 'C2', Customer_Name: 'Beta LLC', Plan: 'Enterprise Tier', MRR: 20000, Seats: 50, Status: 'Active' },
      { Customer_ID: 'C3', Customer_Name: 'Gamma Co', Plan: 'Starter Tier', MRR: 1000, Seats: 2, Status: 'Churned' },
    ];

    const metrics = module.buildMarketMetrics({ sales: subRows, domain: 'subscription_saas' });
    expect(metrics.kpis.domain).toBe('subscription_saas');
    expect(metrics.kpis.totalRevenue).toBe(25000); // Active MRR: 5000 + 20000 = 25000
    expect(metrics.kpis.inventoryValue).toBe(300000); // ARR: 25000 * 12 = 300000
    expect(metrics.kpis.totalUnits).toBe(2); // 2 active accounts
    expect(metrics.kpis.lowStockCount).toBe(1); // 1 churned account
    expect(metrics.kpis.profitMarginPct).toBe(80.0); // 80% software benchmark margin
    expect(metrics.kpis.domainKpis?.primaryMetric.label).toBe('Monthly Recurring Revenue');
    expect(metrics.kpis.domainKpis?.riskAlertMetric.label).toBe('Churn Risk');
  });

  // ── 7. Universal Generic Tabular Fallback ──────────────────────────────────
  it('GenericMetricsModule gracefully aggregates unconstrained arbitrary columns without error', () => {
    const module = new GenericMetricsModule();
    const genericRows = [
      { Region: 'West', Rating: 4.8, ResponseTimeSec: 1.2, StaffCount: 12 },
      { Region: 'East', Rating: 3.9, ResponseTimeSec: 2.1, StaffCount: 8 },
      { Region: 'North', Rating: 4.2, ResponseTimeSec: 1.5, StaffCount: 15 },
    ];

    const metrics = module.buildMarketMetrics({ sales: genericRows, domain: 'generic_tabular' });
    expect(metrics.kpis.domain).toBe('generic_tabular');
    expect(metrics.kpis.totalUnits).toBe(3); // 3 rows
    expect(metrics.kpis.totalRevenue).toBeGreaterThan(0);
    expect(metrics.kpis.domainKpis?.primaryMetric.label).toBeDefined();
    expect(metrics.kpis.domainKpis?.secondaryMetric.label).toBe('Total Records');
    expect(metrics.revenueByCategory.length).toBeGreaterThanOrEqual(1);
  });

  // ── 8. Universal buildMetrics Dispatcher ───────────────────────────────────
  it('buildMetrics delegates to the correct domain module via dataset.domain', () => {
    const dataset = {
      sales: [
        { Date: '2024-01-01', Ticker: 'TCS', Close: 3800, Volume: 500 },
        { Date: '2024-01-02', Ticker: 'TCS', Close: 3850, Volume: 600 },
      ] as any,
      products: [],
      stock: [],
      investments: [],
      domain: 'market_securities' as const,
    };

    const metrics = buildMetrics(dataset);
    expect(metrics.kpis.domain).toBe('market_securities');
    expect(metrics.kpis.domainKpis?.primaryMetric.label).toBe('Total Traded Turnover');
  });
});
