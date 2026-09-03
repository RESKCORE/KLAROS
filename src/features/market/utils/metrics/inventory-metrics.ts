/**
 * @file inventory-metrics.ts
 * @description Warehouse and inventory stock snapshot metrics module.
 */

import type { MetricsModule, MetricDatasetInput, DomainKpis } from './types';
import { DOMAIN_METADATA } from '@/services/llm/domain/dataset-classifier';
import type { MarketMetrics } from '../market-metrics-core';

export class InventoryMetricsModule implements MetricsModule {
  readonly domain = 'inventory_stock' as const;
  readonly benchmark = DOMAIN_METADATA.inventory_stock.defaultBenchmark!;

  computeKpis(input: MetricDatasetInput): DomainKpis {
    const metrics = this.buildMarketMetrics(input);
    return metrics.kpis.domainKpis!;
  }

  buildMarketMetrics(input: MetricDatasetInput): MarketMetrics {
    const rows = (input.sales || input.stock || []) as Record<string, unknown>[];
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

    let totalValuation = 0;
    let totalUnitsOnHand = 0;
    let lowStockCount = 0;
    const warehouseMap = new Map<string, { value: number; units: number }>();
    const inventoryList: {
      sku: string;
      name: string;
      beginningStock: number;
      unitsSold: number;
      reorderPoint: number;
      stockRatio: number;
      leadTime: number;
      valuation: number;
      warehouse: string;
    }[] = [];

    rows.forEach((r, idx) => {
      const sku = String(getVal(r, roles?.idField, 'sku', 'productid', 'itemcode', 'partnumber') || `SKU-${idx + 1}`);
      const name = String(getVal(r, roles?.nameField, 'itemname', 'description', 'productname', 'title') || sku);
      const onHand = Number(getVal(r, roles?.volumeField, 'onhand', 'quantity', 'stocklevel', 'availableqty')) || 0;
      const reorderPoint = Number(getVal(r, roles?.secondaryValueField, 'reorderpoint', 'safetystock', 'minqty')) || Math.round(onHand * 0.25);
      const unitCost = Number(getVal(r, roles?.valueField, 'unitcost', 'cost', 'valuation', 'itemprice', 'price')) || 100;
      const warehouse = String(getVal(r, roles?.categoryField, 'warehouse', 'location', 'bin', 'facility', 'dept') || 'Main Warehouse');

      const itemValuation = onHand * unitCost;
      totalValuation += itemValuation;
      totalUnitsOnHand += onHand;

      const isLow = onHand <= reorderPoint;
      if (isLow) lowStockCount += 1;

      const stockRatio = reorderPoint > 0 ? Number((onHand / reorderPoint).toFixed(2)) : 2.0;

      inventoryList.push({
        sku,
        name,
        beginningStock: onHand,
        unitsSold: 0,
        reorderPoint,
        stockRatio,
        leadTime: 5,
        valuation: itemValuation,
        warehouse,
      });

      const wh = warehouseMap.get(warehouse) ?? { value: 0, units: 0 };
      wh.value += itemValuation;
      wh.units += onHand;
      warehouseMap.set(warehouse, wh);
    });

    inventoryList.sort((a, b) => b.valuation - a.valuation);

    // Annualized carrying cost benchmark (18%)
    const annualHoldingCost = Math.round(totalValuation * 0.18);
    const avgStockRatio = inventoryList.length > 0
      ? inventoryList.reduce((s, i) => s + i.stockRatio, 0) / inventoryList.length
      : 1.0;

    // Categorical breakdown by Warehouse/Facility
    const revenueByCategory = Array.from(warehouseMap.entries()).map(([wh, d]) => ({
      category: wh,
      revenue: Math.round(d.value),
      units: d.units,
      marginPct: 18.0,
      avgDiscount: 0,
    }));

    // Top Stock Items by Valuation
    const topProducts = inventoryList.slice(0, 10).map(i => ({
      sku: i.sku,
      name: i.name,
      revenue: Math.round(i.valuation),
      units: i.beginningStock,
      marginPct: i.stockRatio <= 1.0 ? 0 : 35,
    }));

    // Time series (Single or recent snapshots)
    const today = new Date().toISOString().split('T')[0];
    const revenueByDate = [{ date: today, revenue: Math.round(totalValuation), units: totalUnitsOnHand }];

    // Domain KPIs
    const domainKpis: DomainKpis = {
      primaryMetric: {
        label: 'Total Inventory Valuation',
        value: totalValuation,
        formatted: totalValuation >= 10000000
          ? `₹${(totalValuation / 10000000).toFixed(2)} Cr`
          : `₹${Math.round(totalValuation).toLocaleString('en-IN')}`,
        subtext: 'Current warehouse asset holding value',
      },
      secondaryMetric: {
        label: 'Units On-Hand',
        value: totalUnitsOnHand,
        formatted: `${totalUnitsOnHand.toLocaleString('en-IN')} units`,
        badgeText: `${inventoryList.length} Stock SKUs`,
      },
      riskAlertMetric: {
        label: 'Stock Health',
        value: lowStockCount > 0 ? `${lowStockCount} Stockout Alerts` : 'Optimal Inventory',
        alertCount: lowStockCount,
        statusText: lowStockCount > 0 ? `${lowStockCount} SKUs below reorder threshold` : 'All items above safety stock',
        isHealthy: lowStockCount === 0,
      },
      performanceMetric: {
        label: 'Est. Carrying Cost',
        value: annualHoldingCost,
        formatted: `₹${annualHoldingCost.toLocaleString('en-IN')}/yr`,
        marginPct: 18.0,
        subtext: 'Estimated 18% annual warehouse holding & storage cost',
        isEstimated: true,
        benchmarkLabel: '18% Carrying Cost Benchmark',
      },
    };

    return {
      kpis: {
        totalRevenue: Math.round(totalValuation),
        totalCost: annualHoldingCost,
        totalProfit: Math.round(totalValuation - annualHoldingCost),
        profitMarginPct: 82.0,
        totalUnits: totalUnitsOnHand,
        avgDiscount: 0,
        grossMarginPct: 82.0,
        skuCount: inventoryList.length,
        citiesCount: warehouseMap.size,
        lowStockCount,
        dataType: 'csv_data',
        inventoryValue: Math.round(totalValuation),
        avgMarginPct: 18.0,
        costDataType: 'estimated',
        isCostEstimated: true,
        isCategoryInferred: false,
        domain: this.domain,
        domainKpis,
      },
      revenueByDate,
      revenueByCategory,
      paymentMethodShare: revenueByCategory.map(c => ({ method: c.category, revenue: c.revenue })),
      paymentLabel: 'Warehouse Distribution',
      topProducts,
      investmentRoi: [],
      inventory: inventoryList.slice(0, 50),
      inventorySummary: { belowReorder: lowStockCount, avgStockRatio: Number(avgStockRatio.toFixed(2)) },
      categoryRadar: [
        { metric: 'Valuation', ...Object.fromEntries(revenueByCategory.map(c => [c.category, c.revenue])) },
        { metric: 'Units', ...Object.fromEntries(revenueByCategory.map(c => [c.category, c.units])) },
      ],
      categoryNames: revenueByCategory.map(c => c.category),
    };
  }
}
