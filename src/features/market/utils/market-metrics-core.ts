/**
 * @file market-metrics-core.ts
 * @description Pure, side-effect-free KPI computation functions.
 *
 * These functions are extracted from market-metrics.ts so they can be safely
 * imported by the Web Worker (market-metrics.worker.ts) without pulling in any
 * browser APIs, React hooks, or Supabase client code.
 *
 * Performance improvements over the original buildMetrics:
 *  - skuSet and citySet are built inside the primary forEach loop — eliminates
 *    two extra O(n) array allocations that existed purely to feed new Set().
 *  - revenueByDateArray sort uses a Schwartzian transform (pre-computed _ts)
 *    reducing Date construction from O(n log n) to O(n).
 *  - allMonths deduplication uses Set instead of indexOf for O(n) behaviour.
 */

import { normalizeDateToYMD, toMonthKey } from './date-utils';
import { inferCategoryFromName } from '@/services/llm/schema-mapper';
import { detectCurrencyFromSales, type SupportedCurrency } from './currency-utils';

export type DataSourceType = 'transactional' | 'inventory_only' | 'mixed';

// ─── Row Types ────────────────────────────────────────────────────────────────

export type SalesRow = {
  sku: string;
  date: string;
  quantity: number;
  revenue: number;
  discount: number;
  payment_method: string;
  store_city: string;
  name?: string;
  category?: string;
};

export type ProductRow = {
  sku: string;
  name: string;
  category: string;
  subcategory: string;
  brand: string;
  price: number;
  cost: number;
  supplier: string;
  shelf_life_days: number;
  weight_kg: number;
  launch_date: string;
};

export type StockRow = {
  sku: string;
  date: string;
  quantity: number;
  beginning_stock: number;
  units_sold: number;
  reorder_point: number;
  supplier_lead_time: number;
};

export type InvestmentRow = {
  date: string;
  amount: number;
  category: string;
  description: string;
  expected_roi: number;
  actual_roi: number;
};

export type MarketDataset = {
  sales: SalesRow[];
  products: ProductRow[];
  stock: StockRow[];
  investments: InvestmentRow[];
  domain?: import('@/services/llm/domain/dataset-classifier').DatasetDomain;
  roles?: import('@/services/llm/domain/dataset-classifier').ColumnRoles;
  isCostEstimated?: boolean;
};

// ─── Utility Functions ────────────────────────────────────────────────────────

export function toNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function round(value: number, digits = 2): number {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

export function monthKey(value: string): string {
  return toMonthKey(value);
}

// ─── MarketMetrics Type ───────────────────────────────────────────────────────

export type MarketMetrics = {
  kpis: {
    totalRevenue: number;
    totalCost: number;
    totalProfit: number;
    profitMarginPct: number;
    totalUnits: number;
    avgDiscount: number;
    grossMarginPct: number;
    skuCount: number;
    citiesCount: number;
    lowStockCount: number;
    dataType: DataSourceType;
    inventoryValue: number;
    avgMarginPct: number;
    costDataType: 'measured' | 'estimated';
    isCostEstimated: boolean;
    isCategoryInferred: boolean;
    hasStockData: boolean;
    currency?: SupportedCurrency;
    currencySymbol?: string;
    domain?: import('@/services/llm/domain/dataset-classifier').DatasetDomain;
    domainKpis?: import('./metrics/types').DomainKpis;
  };
  revenueByDate: { date: string; revenue: number; units: number }[];
  revenueByCategory: {
    category: string;
    revenue: number;
    units: number;
    marginPct: number;
    avgDiscount: number;
  }[];
  paymentMethodShare: { method: string; revenue: number }[];
  paymentLabel?: string;
  topProducts: { sku: string; name: string; revenue: number; units: number; marginPct: number; rank?: number }[];
  investmentRoi: { date: string; expected: number; actual: number; amount: number; category: string }[];
  inventory: {
    sku: string;
    name: string;
    beginningStock: number;
    unitsSold: number;
    reorderPoint: number;
    stockRatio: number;
    leadTime: number;
  }[];
  inventorySummary: { belowReorder: number; avgStockRatio: number };
  categoryRadar: { metric: string; [category: string]: number | string }[];
  categoryNames: string[];
};

export type MarketHistoryMonth = {
  month: string;
  revenue: number;
  profit: number;
  marginPct: number;
  paymentTopMethod: string;
  paymentTopRevenue: number;
  lowStockCount: number;
  avgStockRatio: number;
};

export type MarketHistory = {
  months: MarketHistoryMonth[];
  stockByMonth: {
    month: string;
    items: {
      sku: string;
      name: string;
      beginningStock: number;
      reorderPoint: number;
      stockRatio: number;
    }[];
  }[];
};

import { getMetricsModule } from './metrics';

// ─── buildRetailMetrics (pure retail KPI calculation) ─────────────────────────

export function buildRetailMetrics(dataset: MarketDataset): MarketMetrics {
  const { sales, products, stock, investments } = dataset;
  const productMap = new Map(products.map((p) => [p.sku, p]));

  const hasSalesTransactions =
    sales.length > 0 && sales.some((s) => toNumber(s.revenue) > 0 || toNumber(s.quantity) > 0);
  const hasProducts = products.length > 0;
  const dataType: DataSourceType = hasSalesTransactions
    ? 'transactional'
    : hasProducts
    ? 'inventory_only'
    : 'mixed';

  // For inventory-only datasets, synthesise estimated sales from product catalogue
  let effectiveSales = sales;
  if (!hasSalesTransactions && hasProducts) {
    effectiveSales = products.map((product, index) => {
      const price = toNumber(product.price);
      const estimatedUnits = price > 1000 ? 50 : price > 500 ? 100 : price > 100 ? 200 : 500;
      return {
        sku: product.sku,
        date: `2025-${String((index % 12) + 1).padStart(2, '0')}-01`,
        quantity: estimatedUnits,
        revenue: price * estimatedUnits,
        discount: 0,
        payment_method: 'Estimated',
        store_city: 'All',
      } satisfies SalesRow;
    });
  }

  // Check whether the dataset has measured unit cost data
  const hasMeasuredProductCost = products.some((p) => toNumber(p.cost) > 0);
  const isCostEstimated = dataset.isCostEstimated !== undefined ? dataset.isCostEstimated : !hasMeasuredProductCost;
  const costDataType: 'measured' | 'estimated' = isCostEstimated ? 'estimated' : 'measured';

  // Check if categories are inferred from product names rather than an explicit source column
  const hasExplicitCategories = products.some((p) => p.category && p.category !== 'General' && p.category !== 'General Merchandise' && p.category !== 'Other');
  const isCategoryInferred = !hasExplicitCategories;

  // Check whether real inventory/stock tracking rows are present
  const hasStockData = stock.length > 0 && stock.some((row) => toNumber(row.beginning_stock) > 0 || toNumber(row.reorder_point) > 0 || toNumber(row.quantity) > 0);

  // ── Primary aggregation loop ─────────────────────────────────────────────────
  // skuSet and citySet are accumulated here rather than in a separate map()
  // call, saving two O(n) intermediate array allocations.
  const revenueByDate = new Map<string, { revenue: number; units: number }>();
  const categoryMap = new Map<string, { revenue: number; units: number; cost: number; discountTotal: number; count: number }>();
  const paymentMap = new Map<string, number>();
  const productSalesMap = new Map<string, { sku: string; name: string; revenue: number; units: number; cost: number }>();
  const skuSet = new Set<string>();
  const citySet = new Set<string>();

  let totalRevenue = 0;
  let totalUnits = 0;
  let totalDiscount = 0;
  let totalCost = 0;

  effectiveSales.forEach((sale) => {
    const revenue = toNumber(sale.revenue);
    const quantity = toNumber(sale.quantity);
    const discount = toNumber(sale.discount);
    const product = productMap.get(sale.sku);

    totalRevenue += revenue;
    totalUnits += quantity;
    totalDiscount += discount;

    // Cost calculation (with standard retail benchmark if raw dataset lacks cost column)
    let cost = 0;
    if (isCostEstimated) {
      // Uniformly model COGS at standard 65% retail benchmark to avoid artificial negative margin spikes on clearances
      cost = round(revenue * 0.65, 2);
    } else {
      cost = quantity * (product ? toNumber(product.cost) : 0);
      if (cost === 0 && revenue > 0) {
        cost = round(revenue * 0.65, 2);
      }
    }
    totalCost += cost;

    // Date aggregation (normalized to standard YYYY-MM-DD format via robust date utility)
    const cleanDate = normalizeDateToYMD(sale.date);
    const dateEntry = revenueByDate.get(cleanDate) ?? { revenue: 0, units: 0 };
    dateEntry.revenue += revenue;
    dateEntry.units += quantity;
    revenueByDate.set(cleanDate, dateEntry);

    // Category aggregation (with intelligent category derivation from product name)
    const rawProdName = String(sale.name || product?.name || sale.sku || '');
    let category = sale.category || product?.category || '';
    if (!category || category === 'Other' || category === 'General' || category === 'General Merchandise') {
      category = inferCategoryFromName(rawProdName);
    }

    const catEntry = categoryMap.get(category) ?? { revenue: 0, units: 0, cost: 0, discountTotal: 0, count: 0 };
    catEntry.revenue += revenue;
    catEntry.units += quantity;
    catEntry.cost += cost;
    catEntry.discountTotal += discount;
    catEntry.count++;
    categoryMap.set(category, catEntry);

    // Payment aggregation
    const payment = sale.payment_method || 'Electronic / Card';
    paymentMap.set(payment, (paymentMap.get(payment) ?? 0) + revenue);

    // Product aggregation
    const productName = rawProdName && rawProdName !== sale.sku ? rawProdName : `Item ${sale.sku}`;
    const productEntry = productSalesMap.get(sale.sku) ?? { sku: String(sale.sku), name: productName, revenue: 0, units: 0, cost: 0 };
    if (productEntry.name.startsWith('Item ') && productName && !productName.startsWith('Item ')) {
      productEntry.name = productName;
    }
    productEntry.revenue += revenue;
    productEntry.units += quantity;
    productEntry.cost += cost;
    productSalesMap.set(sale.sku, productEntry);

    // O(1) set membership — replaces downstream new Set(sales.map(...))
    skuSet.add(String(sale.sku));
    citySet.add(String(sale.store_city || 'All'));
  });

  // ── Sort using Schwartzian transform — O(n log n) Date constructions → O(n) ──
  const revenueByDateArray = Array.from(revenueByDate.entries())
    .map(([date, data]) => ({ date, revenue: round(data.revenue, 2), units: round(data.units, 2), _ts: new Date(date).getTime() }))
    .sort((a, b) => a._ts - b._ts)
    .map(({ _ts: _discard, ...rest }) => rest);

  const revenueByCategory = Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      revenue: round(data.revenue, 2),
      units: round(data.units, 2),
      marginPct: data.revenue > 0 ? round(((data.revenue - data.cost) / data.revenue) * 100, 1) : 0,
      avgDiscount: data.count > 0 ? round(data.discountTotal / data.count, 2) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const paymentMethodShare = Array.from(paymentMap.entries())
    .map(([method, revenue]) => ({ method, revenue: round(revenue, 2) }))
    .sort((a, b) => b.revenue - a.revenue);

  const NON_PRODUCT_SKUS = new Set(['amazonfee', 'bank charges', 'post', 'postage', 'd', 'dot', 'm', 'cruk', 'pads', 'adjust', 'test', 'sample', 'manual', 'discount']);

  const topProducts = Array.from(productSalesMap.values())
    .filter((p) => !NON_PRODUCT_SKUS.has(String(p.sku).toLowerCase().trim()) && p.revenue > 0 && p.units > 0)
    .map((p) => ({
      ...p,
      marginPct: p.revenue > 0 ? round(((p.revenue - p.cost) / p.revenue) * 100, 1) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map((p, idx) => ({
      ...p,
      rank: idx + 1,
    }));

  const inventory = !hasStockData
    ? []
    : stock
        .map((row) => {
          const product = productMap.get(row.sku);
          const currentStock = toNumber(row.quantity) > 0 ? toNumber(row.quantity) : toNumber(row.beginning_stock);
          const reorderPoint = toNumber(row.reorder_point);
          return {
            sku: row.sku,
            name: product?.name ?? row.sku,
            beginningStock: currentStock,
            unitsSold: toNumber(row.units_sold),
            reorderPoint,
            stockRatio: reorderPoint > 0 ? round(currentStock / reorderPoint, 2) : 0,
            leadTime: toNumber(row.supplier_lead_time),
          };
        })
        .sort((a, b) => a.stockRatio - b.stockRatio)
        .slice(0, 8);

  const lowStockCount = !hasStockData
    ? 0
    : dataType === 'inventory_only'
      ? products.filter((p) => { const cost = toNumber(p.cost); const price = toNumber(p.price); return price > 0 && cost > price * 0.8; }).length
      : stock.filter((row) => {
          const cs = toNumber(row.quantity) > 0 ? toNumber(row.quantity) : toNumber(row.beginning_stock);
          const rp = toNumber(row.reorder_point);
          return rp > 0 && cs <= rp;
        }).length;

  const avgStockRatio = !hasStockData || !stock.length
    ? 0
    : round(
        stock.reduce((sum, row) => {
          const cs = toNumber(row.quantity) > 0 ? toNumber(row.quantity) : toNumber(row.beginning_stock);
          const rp = toNumber(row.reorder_point);
          return rp <= 0 ? sum : sum + cs / rp;
        }, 0) / stock.length,
        2,
      );

  const investmentRoi = investments
    .map((row) => ({
      date: row.date,
      expected: toNumber(row.expected_roi),
      actual: toNumber(row.actual_roi),
      amount: toNumber(row.amount),
      category: row.category,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const inventoryValue = !hasStockData
    ? 0
    : dataType === 'inventory_only'
      ? round(products.reduce((sum, p) => sum + toNumber(p.cost), 0), 2)
      : round(
          Array.from(productSalesMap.entries()).reduce((sum, [sku, data]) => {
            const unitCost = productMap.get(sku) ? toNumber(productMap.get(sku)!.cost) : 0;
            return sum + unitCost * data.units;
          }, 0),
          2,
        );

  const avgMarginPct =
    products.length > 0
      ? round(
          products.reduce((sum, p) => {
            const price = toNumber(p.price);
            const cost = isCostEstimated ? round(price * 0.65, 2) : toNumber(p.cost);
            return sum + (price > 0 ? ((price - cost) / price) * 100 : 0);
          }, 0) / products.length,
          1,
        )
      : totalRevenue > 0
      ? round(((totalRevenue - totalCost) / totalRevenue) * 100, 1)
      : 0;

  const topCategories = revenueByCategory.slice(0, 3);
  const categoryNames = topCategories.map((item) => item.category);
  const maxRevenue = Math.max(...topCategories.map((i) => i.revenue), 1);
  const maxUnits = Math.max(...topCategories.map((i) => i.units), 1);
  const maxMargin = Math.max(...topCategories.map((i) => i.marginPct), 1);
  const maxDiscount = Math.max(...topCategories.map((i) => i.avgDiscount), 1);
  const normalize = (v: number, max: number) => round((v / max) * 10, 1);

  const categoryRadar = [
    { metric: 'Revenue', ...Object.fromEntries(topCategories.map((c) => [c.category, normalize(c.revenue, maxRevenue)])) },
    { metric: 'Units', ...Object.fromEntries(topCategories.map((c) => [c.category, normalize(c.units, maxUnits)])) },
    { metric: 'Margin %', ...Object.fromEntries(topCategories.map((c) => [c.category, normalize(c.marginPct, maxMargin)])) },
    { metric: 'Avg Discount', ...Object.fromEntries(topCategories.map((c) => [c.category, normalize(c.avgDiscount, maxDiscount)])) },
  ];

  const currencyConfig = detectCurrencyFromSales(dataset.sales);

  return {
    kpis: {
      totalRevenue: round(totalRevenue, 2),
      totalCost: round(totalCost, 2),
      totalProfit: round(totalRevenue - totalCost, 2),
      profitMarginPct: totalRevenue > 0 ? round(((totalRevenue - totalCost) / totalRevenue) * 100, 1) : 0,
      totalUnits: round(totalUnits, 0),
      avgDiscount: effectiveSales.length > 0 && totalDiscount > 0 ? round(totalDiscount / effectiveSales.length, 2) : 0,
      grossMarginPct: totalRevenue > 0 ? round(((totalRevenue - totalCost) / totalRevenue) * 100, 1) : 0,
      skuCount: skuSet.size,      // O(1) — built inline during forEach
      citiesCount: hasSalesTransactions ? citySet.size : 1,
      lowStockCount,
      dataType,
      inventoryValue,
      avgMarginPct,
      costDataType,
      isCostEstimated,
      isCategoryInferred,
      hasStockData,
      currency: currencyConfig.currency,
      currencySymbol: currencyConfig.symbol,
    },
    revenueByDate: revenueByDateArray,
    revenueByCategory,
    paymentMethodShare: dataType === 'inventory_only'
      ? [{ method: 'Estimated (product-based)', revenue: round(totalRevenue, 2) }]
      : paymentMethodShare,
    topProducts,
    investmentRoi,
    inventory: dataType === 'inventory_only'
      ? products.slice(0, 8).map((p) => ({
          sku: p.sku, name: p.name, beginningStock: 1, unitsSold: 0, reorderPoint: 0, stockRatio: 1, leadTime: 0,
        }))
      : inventory,
    inventorySummary: {
      belowReorder: lowStockCount,
      avgStockRatio: dataType === 'inventory_only' ? avgMarginPct / 100 : avgStockRatio,
    },
    categoryRadar,
    categoryNames,
    paymentLabel: dataType === 'inventory_only' ? 'Data Source' : 'Payment Method Mix',
  };
}

/**
 * Universal metrics dispatcher that executes domain-specific KPI rulesets
 * while preserving existing retail analytics for retail transactions.
 */
export function buildMetrics(dataset: MarketDataset): MarketMetrics {
  if (dataset.domain && dataset.domain !== 'retail_transactions') {
    return getMetricsModule(dataset.domain).buildMarketMetrics({
      sales: dataset.sales,
      products: dataset.products,
      stock: dataset.stock,
      investments: dataset.investments,
      domain: dataset.domain,
      roles: dataset.roles,
    });
  }
  return buildRetailMetrics(dataset);
}

// ─── buildHistory (pure, no side-effects) ────────────────────────────────────

export function buildHistory(
  { sales, products, stock }: Pick<MarketDataset, 'sales' | 'products' | 'stock'>,
  months: number,
): MarketHistory {
  const productMap = new Map(products.map((p) => [p.sku, p]));

  const hasSalesTransactions = sales.length > 0 && sales.some((s) => toNumber(s.revenue) > 0 || toNumber(s.quantity) > 0);
  let effectiveSales = sales;
  if (!hasSalesTransactions && products.length > 0) {
    effectiveSales = products.map((product, index) => {
      const price = toNumber(product.price);
      const estimatedUnits = price > 1000 ? 50 : price > 500 ? 100 : price > 100 ? 200 : 500;
      return {
        sku: product.sku,
        date: `2025-${String((index % 12) + 1).padStart(2, '0')}-01`,
        quantity: estimatedUnits,
        revenue: price * estimatedUnits,
        discount: 0,
        payment_method: 'Estimated',
        store_city: 'All',
      } satisfies SalesRow;
    });
  }

  const monthSales = new Map<string, { revenue: number; cost: number; payment: Map<string, number> }>();

  effectiveSales.forEach((sale) => {
    const month = monthKey(sale.date);
    const revenue = toNumber(sale.revenue);
    const quantity = toNumber(sale.quantity);
    const product = productMap.get(sale.sku);
    const cost = quantity * (product ? toNumber(product.cost) : 0);
    const entry = monthSales.get(month) ?? { revenue: 0, cost: 0, payment: new Map<string, number>() };
    entry.revenue += revenue;
    entry.cost += cost;
    const method = sale.payment_method || 'Unknown';
    entry.payment.set(method, (entry.payment.get(method) ?? 0) + revenue);
    monthSales.set(month, entry);
  });

  const stockByMonthMap = new Map<string, { items: MarketHistory['stockByMonth'][number]['items'] }>();
  const stockSummaryMap = new Map<string, { lowStock: number; avgRatio: number }>();

  stock.forEach((row) => {
    const month = monthKey(row.date);
    const beginningStock = toNumber(row.beginning_stock);
    const reorderPoint = toNumber(row.reorder_point);
    const stockRatio = reorderPoint > 0 ? round(beginningStock / reorderPoint, 2) : 0;

    const entry = stockByMonthMap.get(month) ?? { items: [] };
    entry.items.push({ sku: row.sku, name: productMap.get(row.sku)?.name ?? row.sku, beginningStock, reorderPoint, stockRatio });
    stockByMonthMap.set(month, entry);

    const summary = stockSummaryMap.get(month) ?? { lowStock: 0, avgRatio: 0 };
    if (reorderPoint > 0 && beginningStock <= reorderPoint) summary.lowStock++;
    summary.avgRatio += reorderPoint > 0 ? beginningStock / reorderPoint : 0;
    stockSummaryMap.set(month, summary);
  });

  // O(n) deduplication using Set — replaces original O(n²) self.indexOf
  const allMonths = Array.from(new Set([...monthSales.keys(), ...stockByMonthMap.keys()]))
    .sort((a, b) => new Date(`${b}-01`).getTime() - new Date(`${a}-01`).getTime());

  const trimmedMonths = allMonths.slice(0, months);

  const historyMonths: MarketHistoryMonth[] = trimmedMonths.map((month) => {
    const salesEntry = monthSales.get(month);
    const revenue = salesEntry ? round(salesEntry.revenue, 2) : 0;
    const profit = salesEntry ? round(salesEntry.revenue - salesEntry.cost, 2) : 0;
    const marginPct = salesEntry && salesEntry.revenue > 0
      ? round(((salesEntry.revenue - salesEntry.cost) / salesEntry.revenue) * 100, 1)
      : 0;

    let paymentTopMethod = 'Unknown';
    let paymentTopRevenue = 0;
    if (salesEntry) {
      for (const [method, value] of salesEntry.payment.entries()) {
        if (value > paymentTopRevenue) { paymentTopRevenue = value; paymentTopMethod = method; }
      }
    }

    const stockItems = stockByMonthMap.get(month)?.items ?? [];
    const stockSummary = stockSummaryMap.get(month);
    const avgRatio = stockItems.length
      ? round(stockItems.reduce((sum, item) => sum + item.stockRatio, 0) / stockItems.length, 2)
      : 0;

    return {
      month, revenue, profit, marginPct, paymentTopMethod,
      paymentTopRevenue: round(paymentTopRevenue, 2),
      lowStockCount: stockSummary?.lowStock ?? 0,
      avgStockRatio: stockSummary ? round(stockSummary.avgRatio / Math.max(stockItems.length, 1), 2) : avgRatio,
    };
  });

  const stockByMonth = trimmedMonths.map((month) => ({
    month,
    items: (stockByMonthMap.get(month)?.items ?? [])
      .sort((a, b) => a.stockRatio - b.stockRatio)
      .slice(0, 8),
  }));

  return { months: historyMonths, stockByMonth };
}
