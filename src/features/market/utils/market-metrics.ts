import Papa from "papaparse";

export type DataSourceType = 'transactional' | 'inventory_only' | 'mixed';

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
  topProducts: { sku: string; name: string; revenue: number; units: number; marginPct: number }[];
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
  inventorySummary: {
    belowReorder: number;
    avgStockRatio: number;
  };
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

type SalesRow = {
  sku: string;
  date: string;
  quantity: number;
  revenue: number;
  discount: number;
  payment_method: string;
  store_city: string;
};

type ProductRow = {
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

type StockRow = {
  sku: string;
  date: string;
  quantity: number;          // current stock on hand (primary)
  beginning_stock: number;  // initial stock before sales (fallback)
  units_sold: number;
  reorder_point: number;
  supplier_lead_time: number;
};

type InvestmentRow = {
  date: string;
  amount: number;
  category: string;
  description: string;
  expected_roi: number;
  actual_roi: number;
};

type MarketDataset = {
  sales: SalesRow[];
  products: ProductRow[];
  stock: StockRow[];
  investments: InvestmentRow[];
};

const METRICS_CACHE_VERSION = "v1";
const METRICS_CACHE_KEY = `klaros:market-metrics:${METRICS_CACHE_VERSION}:`;
const HISTORY_CACHE_KEY = `klaros:market-history:${METRICS_CACHE_VERSION}:`;
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

const datasetCache = new Map<string, MarketDataset>();
const datasetPromiseCache = new Map<string, Promise<MarketDataset>>();
const metricsCache = new Map<string, MarketMetrics>();
const metricsPromiseCache = new Map<string, Promise<MarketMetrics>>();
const historyCache = new Map<string, MarketHistory>();
const historyPromiseCache = new Map<string, Promise<MarketHistory>>();

function readCache<T>(key: string): T | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { timestamp: number; value: T };
    if (!parsed?.timestamp) {
      return null;
    }
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      window.localStorage.removeItem(key);
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, value: T) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), value }));
  } catch {
    // Ignore storage errors (quota, private mode, etc.)
  }
}

async function parseCsv<T>(url: string): Promise<T[]> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load ${url} (${response.status})`);
    }

    const text = await response.text();
    const parsed = Papa.parse<T>(text, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(), // Trim header whitespace
    });

    if (parsed.errors.length) {
      // Only log critical errors, not warnings
      const criticalErrors = parsed.errors.filter((e) => e.type === 'Delimiter');
      if (criticalErrors.length) {
        console.warn(`CSV parsing notes for ${url}:`, criticalErrors.slice(0, 1));
      }
    }

    const data = parsed.data.filter(Boolean) as T[];
    console.log(`✅ Parsed ${url}: ${data.length} rows`);
    return data;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`❌ Failed to parse ${url}:`, message);
    return [];
  }
}

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value: number, digits = 2): number {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

function monthKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 7);
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

async function loadMarketDataset(datasetId: string): Promise<MarketDataset> {
  const cached = datasetCache.get(datasetId);
  if (cached) {
    return cached;
  }

  const inFlight = datasetPromiseCache.get(datasetId);
  if (inFlight) {
    return inFlight;
  }

  // Check if it's an uploaded dataset (UUID format)
  const isUploaded = datasetId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

  let promise: Promise<MarketDataset>;

  if (isUploaded) {
    // Load from Supabase for uploaded datasets
    promise = (async () => {
      try {
        const { getSupabaseClient } = await import('@/services/supabase/supabase');
        const client = await getSupabaseClient();
        
        // Try to get csv_data first, with fallback to counts only if column doesn't exist
        let data: { csv_data?: unknown; counts?: unknown } | null = null;
        let error: { code?: string; message?: string } | null = null;
        
        const result1 = await client
          .from('data_sources')
          .select('csv_data, counts')
          .eq('id', datasetId)
          .single();
        
        // If csv_data column doesn't exist (error 42703), try without it
        if (result1.error?.code === '42703') {
          console.log('⚠️ csv_data column not found, trying counts only...');
          const result2 = await client
            .from('data_sources')
            .select('counts')
            .eq('id', datasetId)
            .single();
          data = result2.data;
          error = result2.error;
        } else {
          data = result1.data;
          error = result1.error;
        }

        if (error) {
          console.error('Failed to load uploaded dataset from Supabase:', error);
          throw new Error(`Dataset not found: ${datasetId}`);
        }

        interface ParsedCsvData {
          sales?: unknown[];
          products?: unknown[];
          stock?: unknown[];
          investments?: unknown[];
        }

        // Try csv_data first, then fallback to counts._data
        let csvData = data?.csv_data as ParsedCsvData | null | undefined;
        
        if (!csvData && data?.counts) {
          const countsObj = data.counts as Record<string, unknown>;
          if (countsObj._data) {
            console.log('⚠️ Using fallback storage (counts._data)...');
            csvData = countsObj._data as ParsedCsvData;
          }
        }

        if (!csvData) {
          console.warn('⚠️ No CSV data found, using counts as dataset');
          csvData = {
            products: [],
            sales: [],
            stock: [],
            investments: [],
          };
        }

        console.log(`✅ Loaded uploaded dataset: ${datasetId}`);
        const dataset: MarketDataset = {
          sales: (csvData.sales || []) as SalesRow[],
          products: (csvData.products || []) as ProductRow[],
          stock: (csvData.stock || []) as StockRow[],
          investments: (csvData.investments || []) as InvestmentRow[],
        };

        datasetCache.set(datasetId, dataset);
        datasetPromiseCache.delete(datasetId);
        return dataset;
      } catch (err) {
        console.error('❌ Failed to load uploaded dataset:', err);
        throw err;
      }
    })();
  } else {
    // Load from public CSV files for synthetic datasets (dataset1, dataset2, etc.)
    const basePath = `/market-dataset/${datasetId}`;
    promise = Promise.all([
      parseCsv<SalesRow>(`${basePath}/sales.csv`),
      parseCsv<ProductRow>(`${basePath}/products.csv`),
      parseCsv<StockRow>(`${basePath}/stock.csv`),
      parseCsv<InvestmentRow>(`${basePath}/investments.csv`),
    ]).then(([sales, products, stock, investments]) => {
      const dataset = { sales, products, stock, investments };
      datasetCache.set(datasetId, dataset);
      datasetPromiseCache.delete(datasetId);
      return dataset;
    });
  }

  datasetPromiseCache.set(datasetId, promise);
  return promise;
}

export function getCachedMarketMetrics(datasetId = "dataset1"): MarketMetrics | null {
  return metricsCache.get(datasetId) || readCache<MarketMetrics>(`${METRICS_CACHE_KEY}${datasetId}`);
}

export function getCachedMarketHistory(datasetId = "dataset1", months = 3): MarketHistory | null {
  const cacheKey = `${HISTORY_CACHE_KEY}${datasetId}:${months}`;
  return historyCache.get(cacheKey) || readCache<MarketHistory>(cacheKey);
}

export async function loadMarketMetrics(datasetId = "dataset1"): Promise<MarketMetrics> {
  const cached = metricsCache.get(datasetId) || readCache<MarketMetrics>(`${METRICS_CACHE_KEY}${datasetId}`);
  if (cached) {
    metricsCache.set(datasetId, cached);
    return cached;
  }

  const inFlight = metricsPromiseCache.get(datasetId);
  if (inFlight) {
    return inFlight;
  }

  const promise = loadMarketDataset(datasetId).then(({ sales, products, stock, investments }) => {
    const result = buildMetrics({ sales, products, stock, investments });
    metricsCache.set(datasetId, result);
    writeCache(`${METRICS_CACHE_KEY}${datasetId}`, result);
    metricsPromiseCache.delete(datasetId);
    return result;
  });

  metricsPromiseCache.set(datasetId, promise);
  return promise;
}

function buildMetrics({
  sales,
  products,
  stock,
  investments,
}: MarketDataset): MarketMetrics {

  const productMap = new Map(products.map((product) => [product.sku, product]));

  // Detect dataset type — do we have actual sales transactions?
  const hasSalesTransactions = sales.length > 0 && sales.some((s) => toNumber(s.revenue) > 0 || toNumber(s.quantity) > 0);
  const hasProducts = products.length > 0;
  const dataType: DataSourceType = hasSalesTransactions
    ? 'transactional'
    : hasProducts
      ? 'inventory_only'
      : 'mixed';

  // For inventory-only datasets, generate estimated sales records from product data
  let effectiveSales = sales;
  if (!hasSalesTransactions && hasProducts) {
    console.log(`[buildMetrics] No sales transactions found. Generating estimated metrics from ${products.length} products...`);
    effectiveSales = products.map((product, index) => {
      const price = toNumber(product.price);
      const cost = toNumber(product.cost);
      // Estimate units sold based on price tier
      const estimatedUnits = price > 1000 ? 50 : price > 500 ? 100 : price > 100 ? 200 : 500;
      const estimatedRevenue = price * estimatedUnits;
      return {
        sku: product.sku,
        date: `2025-${String((index % 12) + 1).padStart(2, '0')}-01`,
        quantity: estimatedUnits,
        revenue: estimatedRevenue,
        discount: 0,
        payment_method: 'Estimated',
        store_city: 'All',
      } satisfies SalesRow;
    });
  }

  const revenueByDate = new Map<string, { revenue: number; units: number }>();
  const categoryMap = new Map<
    string,
    { revenue: number; units: number; cost: number; discountTotal: number; count: number }
  >();
  const paymentMap = new Map<string, number>();
  const productSalesMap = new Map<
    string,
    { sku: string; name: string; revenue: number; units: number; cost: number }
  >();

  let totalRevenue = 0;
  let totalUnits = 0;
  let totalDiscount = 0;
  let totalCost = 0;

  effectiveSales.forEach((sale) => {
    const revenue = toNumber(sale.revenue);
    const quantity = toNumber(sale.quantity);
    const discount = toNumber(sale.discount);

    totalRevenue += revenue;
    totalUnits += quantity;
    totalDiscount += discount;

    const product = productMap.get(sale.sku);
    const productCost = product ? toNumber(product.cost) : 0;
    const cost = quantity * productCost;
    totalCost += cost;

    const dateKey = sale.date;
    const dateEntry = revenueByDate.get(dateKey) || { revenue: 0, units: 0 };
    dateEntry.revenue += revenue;
    dateEntry.units += quantity;
    revenueByDate.set(dateKey, dateEntry);

    const category = product?.category || "Other";
    const categoryEntry = categoryMap.get(category) || {
      revenue: 0,
      units: 0,
      cost: 0,
      discountTotal: 0,
      count: 0,
    };
    categoryEntry.revenue += revenue;
    categoryEntry.units += quantity;
    categoryEntry.cost += cost;
    categoryEntry.discountTotal += discount;
    categoryEntry.count += 1;
    categoryMap.set(category, categoryEntry);

    const payment = sale.payment_method || "Unknown";
    paymentMap.set(payment, (paymentMap.get(payment) || 0) + revenue);

    const productName = product?.name || sale.sku;
    const productEntry = productSalesMap.get(sale.sku) || {
      sku: sale.sku,
      name: productName,
      revenue: 0,
      units: 0,
      cost: 0,
    };
    productEntry.revenue += revenue;
    productEntry.units += quantity;
    productEntry.cost += cost;
    productSalesMap.set(sale.sku, productEntry);
  });

  const revenueByDateArray = Array.from(revenueByDate.entries())
    .map(([date, data]) => ({ date, revenue: round(data.revenue, 2), units: round(data.units, 2) }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

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

  const topProducts = Array.from(productSalesMap.values())
    .map((product) => ({
      ...product,
      marginPct: product.revenue > 0 ? round(((product.revenue - product.cost) / product.revenue) * 100, 1) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  const inventory = stock
    .map((row) => {
      const product = productMap.get(row.sku);
      // Use `quantity` (current stock on hand) if present; fall back to `beginning_stock`
      const currentStock = toNumber(row.quantity) > 0
        ? toNumber(row.quantity)
        : toNumber(row.beginning_stock);
      const reorderPoint = toNumber(row.reorder_point);
      const unitsSold = toNumber(row.units_sold);
      return {
        sku: row.sku,
        name: product?.name || row.sku,
        beginningStock: currentStock,
        unitsSold,
        reorderPoint,
        stockRatio: reorderPoint > 0 ? round(currentStock / reorderPoint, 2) : 0,
        leadTime: toNumber(row.supplier_lead_time),
      };
    })
    .sort((a, b) => a.stockRatio - b.stockRatio)
    .slice(0, 8);

  const lowStockCount = dataType === 'inventory_only'
    ? products.filter((p) => {
        // For inventory-only, flag items with cost > price as "low margin"
        const cost = toNumber(p.cost);
        const price = toNumber(p.price);
        return price > 0 && cost > price * 0.8;
      }).length
    : stock.filter((row) => {
        // Use quantity (current stock on hand) if present, else beginning_stock
        const currentStock = toNumber(row.quantity) > 0
          ? toNumber(row.quantity)
          : toNumber(row.beginning_stock);
        const reorderPoint = toNumber(row.reorder_point);
        return reorderPoint > 0 && currentStock <= reorderPoint;
      }).length;

  const avgStockRatio = stock.length
    ? round(
        stock.reduce((sum, row) => {
          const currentStock = toNumber(row.quantity) > 0
            ? toNumber(row.quantity)
            : toNumber(row.beginning_stock);
          const reorderPoint = toNumber(row.reorder_point);
          if (reorderPoint <= 0) {
            return sum;
          }
          return sum + currentStock / reorderPoint;
        }, 0) / stock.length,
        2,
      )
    : 0;

  const investmentRoi = investments
    .map((row) => ({
      date: row.date,
      expected: toNumber(row.expected_roi),
      actual: toNumber(row.actual_roi),
      amount: toNumber(row.amount),
      category: row.category,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Inventory value: sum of cost × stock (or just cost as unit value when no stock data)
  const inventoryValue = dataType === 'inventory_only'
    ? round(products.reduce((sum, p) => sum + toNumber(p.cost), 0), 2)
    : round(Array.from(productSalesMap.entries()).reduce((sum, [sku, data]) => {
        const product = productMap.get(sku);
        const unitCost = product ? toNumber(product.cost) : 0;
        return sum + unitCost * data.units;
      }, 0), 2);

  // Average margin across products
  const avgMarginPct = products.length > 0
    ? round(products.reduce((sum, p) => {
        const price = toNumber(p.price);
        const cost = toNumber(p.cost);
        return sum + (price > 0 ? ((price - cost) / price) * 100 : 0);
      }, 0) / products.length, 1)
    : 0;

  const topCategories = revenueByCategory.slice(0, 3);
  const categoryNames = topCategories.map((item) => item.category);

  const maxRevenue = Math.max(...topCategories.map((item) => item.revenue), 1);
  const maxUnits = Math.max(...topCategories.map((item) => item.units), 1);
  const maxMargin = Math.max(...topCategories.map((item) => item.marginPct), 1);
  const maxDiscount = Math.max(...topCategories.map((item) => item.avgDiscount), 1);

  const normalizeToTen = (value: number, max: number) => round((value / max) * 10, 1);

  const categoryRadar = [
    {
      metric: "Revenue",
      ...Object.fromEntries(
        topCategories.map((category) => [
          category.category,
          normalizeToTen(category.revenue, maxRevenue),
        ]),
      ),
    },
    {
      metric: "Units",
      ...Object.fromEntries(
        topCategories.map((category) => [
          category.category,
          normalizeToTen(category.units, maxUnits),
        ]),
      ),
    },
    {
      metric: "Margin %",
      ...Object.fromEntries(
        topCategories.map((category) => [
          category.category,
          normalizeToTen(category.marginPct, maxMargin),
        ]),
      ),
    },
    {
      metric: "Avg Discount",
      ...Object.fromEntries(
        topCategories.map((category) => [
          category.category,
          normalizeToTen(category.avgDiscount, maxDiscount),
        ]),
      ),
    },
  ];

  const result = {
    kpis: {
      totalRevenue: round(totalRevenue, 2),
      totalCost: round(totalCost, 2),
      totalProfit: round(totalRevenue - totalCost, 2),
      profitMarginPct: totalRevenue > 0 ? round(((totalRevenue - totalCost) / totalRevenue) * 100, 1) : 0,
      totalUnits: round(totalUnits, 0),
      avgDiscount: effectiveSales.length > 0 && totalDiscount > 0 ? round(totalDiscount / effectiveSales.length, 2) : 0,
      grossMarginPct: totalRevenue > 0 ? round(((totalRevenue - totalCost) / totalRevenue) * 100, 1) : 0,
      skuCount: new Set(effectiveSales.map((sale) => sale.sku)).size,
      citiesCount: hasSalesTransactions ? new Set(sales.map((sale) => sale.store_city)).size : 1,
      lowStockCount,
      dataType,
      inventoryValue,
      avgMarginPct,
    },
    revenueByDate: revenueByDateArray,
    revenueByCategory,
    paymentMethodShare: dataType === 'inventory_only'
      ? [{ method: 'Estimated (product-based)', revenue: round(totalRevenue, 2) }]
      : paymentMethodShare,
    topProducts,
    investmentRoi,
    inventory: dataType === 'inventory_only'
      ? products.slice(0, 8).map((product) => ({
          sku: product.sku,
          name: product.name,
          beginningStock: 1,
          unitsSold: 0,
          reorderPoint: 0,
          stockRatio: 1,
          leadTime: 0,
        }))
      : inventory,
    inventorySummary: {
      belowReorder: lowStockCount,
      avgStockRatio: dataType === 'inventory_only' ? avgMarginPct / 100 : avgStockRatio,
    },
    categoryRadar,
    categoryNames,
  };

  return {
    ...result,
    paymentLabel: dataType === 'inventory_only' ? 'Data Source' : "Payment Method Mix",
  };
}

export async function loadMarketHistory(
  datasetId = "dataset1",
  months = 3,
): Promise<MarketHistory> {
  const cacheKey = `${HISTORY_CACHE_KEY}${datasetId}:${months}`;
  const cached = historyCache.get(cacheKey) || readCache<MarketHistory>(cacheKey);
  if (cached) {
    historyCache.set(cacheKey, cached);
    return cached;
  }

  const inFlight = historyPromiseCache.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const promise = loadMarketDataset(datasetId).then(({ sales, products, stock }) => {
    const result = buildHistory({ sales, products, stock }, months);
    historyCache.set(cacheKey, result);
    writeCache(cacheKey, result);
    historyPromiseCache.delete(cacheKey);
    return result;
  });

  historyPromiseCache.set(cacheKey, promise);
  return promise;
}

function buildHistory(
  { sales, products, stock }: Pick<MarketDataset, "sales" | "products" | "stock">,
  months: number,
): MarketHistory {
  const productMap = new Map(products.map((product) => [product.sku, product]));

  // For inventory-only datasets, generate estimated sales for history
  let effectiveSales = sales;
  const hasSalesTransactions = sales.length > 0 && sales.some((s) => toNumber(s.revenue) > 0 || toNumber(s.quantity) > 0);
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

  const monthSales = new Map<
    string,
    { revenue: number; cost: number; payment: Map<string, number> }
  >();

  effectiveSales.forEach((sale) => {
    const month = monthKey(sale.date);
    const revenue = toNumber(sale.revenue);
    const quantity = toNumber(sale.quantity);
    const product = productMap.get(sale.sku);
    const cost = quantity * (product ? toNumber(product.cost) : 0);

    const entry = monthSales.get(month) || {
      revenue: 0,
      cost: 0,
      payment: new Map<string, number>(),
    };

    entry.revenue += revenue;
    entry.cost += cost;
    const method = sale.payment_method || "Unknown";
    entry.payment.set(method, (entry.payment.get(method) || 0) + revenue);
    monthSales.set(month, entry);
  });

  const stockByMonthMap = new Map<
    string,
    { items: MarketHistory["stockByMonth"][number]["items"] }
  >();
  const stockSummaryMap = new Map<string, { lowStock: number; avgRatio: number }>();

  stock.forEach((row) => {
    const month = monthKey(row.date);
    const beginningStock = toNumber(row.beginning_stock);
    const reorderPoint = toNumber(row.reorder_point);
    const stockRatio = reorderPoint > 0 ? round(beginningStock / reorderPoint, 2) : 0;

    const entry = stockByMonthMap.get(month) || { items: [] };
    entry.items.push({
      sku: row.sku,
      name: productMap.get(row.sku)?.name || row.sku,
      beginningStock,
      reorderPoint,
      stockRatio,
    });
    stockByMonthMap.set(month, entry);

    const summary = stockSummaryMap.get(month) || { lowStock: 0, avgRatio: 0 };
    if (reorderPoint > 0 && beginningStock <= reorderPoint) {
      summary.lowStock += 1;
    }
    summary.avgRatio += reorderPoint > 0 ? beginningStock / reorderPoint : 0;
    stockSummaryMap.set(month, summary);
  });

  const allMonths = Array.from(monthSales.keys())
    .concat(Array.from(stockByMonthMap.keys()))
    .filter((value, index, self) => self.indexOf(value) === index)
    .sort((a, b) => new Date(`${b}-01`).getTime() - new Date(`${a}-01`).getTime());

  const trimmedMonths = allMonths.slice(0, months);

  const historyMonths: MarketHistoryMonth[] = trimmedMonths.map((month) => {
    const salesEntry = monthSales.get(month);
    const revenue = salesEntry ? round(salesEntry.revenue, 2) : 0;
    const profit = salesEntry ? round(salesEntry.revenue - salesEntry.cost, 2) : 0;
    const marginPct = salesEntry && salesEntry.revenue > 0
      ? round(((salesEntry.revenue - salesEntry.cost) / salesEntry.revenue) * 100, 1)
      : 0;

    let paymentTopMethod = "Unknown";
    let paymentTopRevenue = 0;
    if (salesEntry) {
      for (const [method, value] of salesEntry.payment.entries()) {
        if (value > paymentTopRevenue) {
          paymentTopRevenue = value;
          paymentTopMethod = method;
        }
      }
    }

    const stockSummary = stockSummaryMap.get(month);
    const stockItems = stockByMonthMap.get(month)?.items || [];
    const avgRatio = stockItems.length
      ? round(
          stockItems.reduce((sum, item) => sum + item.stockRatio, 0) / stockItems.length,
          2,
        )
      : 0;

    return {
      month,
      revenue,
      profit,
      marginPct,
      paymentTopMethod,
      paymentTopRevenue: round(paymentTopRevenue, 2),
      lowStockCount: stockSummary?.lowStock || 0,
      avgStockRatio: stockSummary ? round(stockSummary.avgRatio / Math.max(stockItems.length, 1), 2) : avgRatio,
    };
  });

  const stockByMonth = trimmedMonths.map((month) => {
    const items = (stockByMonthMap.get(month)?.items || [])
      .sort((a, b) => a.stockRatio - b.stockRatio)
      .slice(0, 8);
    return { month, items };
  });

  return { months: historyMonths, stockByMonth };
}
