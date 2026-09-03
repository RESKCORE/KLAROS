import { describe, it, expect } from 'vitest';
import { generateForecastScenarios } from './forecasts';
import { inferCategoryFromName } from '../schema-mapper';
import { buildMetrics } from '@/features/market/utils/market-metrics-core';
import type { MarketMetrics } from '@/features/market/utils/market-metrics-core';

describe('Forecast Anchoring and Disclosures Tests', () => {
  it('anchors 3-month forecast x-axis to the latest dataset transaction date, not current wall-clock date', () => {
    const mockMetrics: MarketMetrics = {
      kpis: {
        totalRevenue: 100000,
        totalCost: 65000,
        totalProfit: 35000,
        profitMarginPct: 35,
        totalUnits: 5000,
        avgDiscount: 0,
        grossMarginPct: 35,
        skuCount: 10,
        citiesCount: 1,
        lowStockCount: 0,
        dataType: 'transactional',
        inventoryValue: 0,
        avgMarginPct: 35,
        costDataType: 'estimated',
        isCostEstimated: true,
        isCategoryInferred: true,
        hasStockData: false,
      },
      revenueByDate: [
        { date: '2011-09-01', revenue: 20000, units: 1000 },
        { date: '2011-10-01', revenue: 30000, units: 1500 },
        { date: '2011-11-01', revenue: 25000, units: 1200 },
        { date: '2011-12-09', revenue: 25000, units: 1300 }, // latest transaction in historical file
      ],
      revenueByCategory: [],
      paymentMethodShare: [],
      topProducts: [],
      investmentRoi: [],
      categoryRadar: [],
      categoryNames: [],
      inventory: [],
      inventorySummary: { belowReorder: 0, avgStockRatio: 0 },
    };

    const forecast = generateForecastScenarios(mockMetrics, 'retail');
    expect(forecast.length).toBe(3);

    // Should continue from Dec 2011 into Jan 2012, Feb 2012, Mar 2012
    expect(forecast[0].month).toBe('2012-01');
    expect(forecast[1].month).toBe('2012-02');
    expect(forecast[2].month).toBe('2012-03');

    // Make sure it did NOT anchor to the current wall-clock year
    const currentYear = new Date().getFullYear();
    forecast.forEach((f) => {
      expect(f.month).not.toContain(String(currentYear));
    });
  });

  it('accurately categorizes common online retail items instead of collapsing into General Merchandise', () => {
    expect(inferCategoryFromName('WHITE HANGING HEART T-LIGHT HOLDER')).toBe('Home & Decor');
    expect(inferCategoryFromName('JUMBO BAG RED RETROSPOT')).toBe('Gifts & Bags');
    expect(inferCategoryFromName('REGENCY CAKESTAND 3 TIER')).toBe('Kitchen & Dining');
    expect(inferCategoryFromName('PARTY BUNTING')).toBe('Toys & Party');
    expect(inferCategoryFromName('VINTAGE SNAP CARDS')).toBe('Toys & Party');
    expect(inferCategoryFromName('LUNCH BAG RED RETROSPOT')).toBe('Gifts & Bags');
    expect(inferCategoryFromName('HAND WARMER OWL DESIGN')).toBe('Apparel & Accessories');
    expect(inferCategoryFromName('COLOUR GLASS T-LIGHT HOLDER HANGING')).toBe('Home & Decor');
  });

  it('marks hasStockData as false and inventory as empty when stock records are absent', () => {
    const dataset = {
      sales: [
        { sku: '22423', date: '2011-11-01', quantity: 10, revenue: 1250, discount: 0, payment_method: 'Card', store_city: 'London' }
      ],
      products: [
        { sku: '22423', name: 'REGENCY CAKESTAND 3 TIER', category: '', subcategory: '', brand: '', price: 125, cost: 0, supplier: '', shelf_life_days: 0, weight_kg: 0, launch_date: '' }
      ],
      stock: [],
      investments: []
    };

    const metrics = buildMetrics(dataset);
    expect(metrics.kpis.hasStockData).toBe(false);
    expect(metrics.inventory).toHaveLength(0);
    expect(metrics.kpis.lowStockCount).toBe(0);
    expect(metrics.kpis.isCostEstimated).toBe(true);
    expect(metrics.kpis.costDataType).toBe('estimated');
    // COGS modeled at benchmark 65% of 1250 = 812.5, profit = 437.5 (35%)
    expect(metrics.kpis.totalProfit).toBe(437.5);
    expect(metrics.kpis.profitMarginPct).toBe(35);
  });
});
