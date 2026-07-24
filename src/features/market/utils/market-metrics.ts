/**
 * @file market-metrics.ts
 * @description Public API for loading and caching market metrics.
 *
 * Architecture changes:
 *
 *  1. WEB WORKER — KPI computation (buildMetrics / buildHistory) now runs in
 *     a dedicated background thread via market-metrics.worker.ts, keeping the
 *     main thread free for React rendering even on 50 MB CSV files.
 *
 *  2. PROMISE CACHE FINALLY BLOCK — the in-flight promise caches are always
 *     cleaned up in a `finally` block.  The original code deleted the promise
 *     only on success, leaving rejected promises in the cache forever ("zombie"
 *     promises that prevented any retry on the same dataset ID).
 *
 *  3. SCHWARTZIAN SORT + O(n) DEDUP — moved to market-metrics-core.ts where
 *     the pure computation lives.
 *
 *  4. LOCALSTORAGE CACHE — retained for offline support but now clearly
 *     documented as a best-effort persistent layer; TanStack Query is the
 *     recommended authoritative cache for React components.
 */

import Papa from 'papaparse';
import type {
  MarketDataset,
  MarketMetrics,
  MarketHistory,
  SalesRow,
  ProductRow,
  StockRow,
  InvestmentRow,
} from './market-metrics-core';
import { buildMetrics, buildHistory } from './market-metrics-core';

// Re-export types for backward compatibility
export type { MarketMetrics, MarketHistory, MarketHistoryMonth, DataSourceType } from './market-metrics-core';

// ─── Worker Helpers ───────────────────────────────────────────────────────────

/**
 * Runs buildMetrics in a Web Worker and resolves with the result.
 * Falls back to the synchronous implementation if Workers are unavailable
 * (e.g. Jest / Node test environment).
 */
async function buildMetricsInWorker(dataset: MarketDataset): Promise<MarketMetrics> {
  if (typeof Worker === 'undefined') {
    // Test / SSR environment — run synchronously
    return buildMetrics(dataset);
  }

  return new Promise<MarketMetrics>((resolve, reject) => {
    const worker = new Worker(
      new URL('./market-metrics.worker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.onmessage = (event: MessageEvent<{ type: string; payload: MarketMetrics | string }>) => {
      worker.terminate();
      if (event.data.type === 'METRICS_RESULT') {
        resolve(event.data.payload as MarketMetrics);
      } else {
        reject(new Error(String(event.data.payload)));
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(new Error(`Worker error: ${err.message}`));
    };

    worker.postMessage({ type: 'BUILD_METRICS', payload: dataset });
  });
}

/**
 * Runs buildHistory in a Web Worker and resolves with the result.
 */
async function buildHistoryInWorker(
  dataset: Pick<MarketDataset, 'sales' | 'products' | 'stock'>,
  months: number,
): Promise<MarketHistory> {
  if (typeof Worker === 'undefined') {
    return buildHistory(dataset, months);
  }

  return new Promise<MarketHistory>((resolve, reject) => {
    const worker = new Worker(
      new URL('./market-metrics.worker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.onmessage = (event: MessageEvent<{ type: string; payload: MarketHistory | string }>) => {
      worker.terminate();
      if (event.data.type === 'HISTORY_RESULT') {
        resolve(event.data.payload as MarketHistory);
      } else {
        reject(new Error(String(event.data.payload)));
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(new Error(`Worker error: ${err.message}`));
    };

    worker.postMessage({ type: 'BUILD_HISTORY', payload: { dataset, months } });
  });
}

// ─── localStorage Cache ───────────────────────────────────────────────────────

const METRICS_CACHE_VERSION = 'v2'; // bump when MarketMetrics shape changes
const METRICS_CACHE_KEY = `klaros:market-metrics:${METRICS_CACHE_VERSION}:`;
const HISTORY_CACHE_KEY = `klaros:market-history:${METRICS_CACHE_VERSION}:`;
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

function readCache<T>(key: string): T | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { timestamp: number; value: T };
    if (!parsed?.timestamp) return null;
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      window.localStorage.removeItem(key);
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, value: T): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), value }));
  } catch {
    // Ignore quota errors (private mode, storage full, etc.)
  }
}

// ─── CSV Parsing ──────────────────────────────────────────────────────────────

async function parseCsv<T>(url: string): Promise<T[]> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load ${url} (${response.status})`);

    const text = await response.text();
    const parsed = Papa.parse<T>(text, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });

    const criticalErrors = parsed.errors.filter((e) => e.type === 'Delimiter');
    if (criticalErrors.length) {
      console.warn(`CSV parsing issues for ${url}:`, criticalErrors.slice(0, 1));
    }

    const data = parsed.data.filter(Boolean) as T[];
    console.log(`✅ Parsed ${url}: ${data.length} rows`);
    return data;
  } catch (err) {
    console.error(`❌ Failed to parse ${url}:`, err instanceof Error ? err.message : String(err));
    return [];
  }
}

// ─── In-Memory + Promise Caches ───────────────────────────────────────────────

// Module-level in-memory cache (survives React re-renders, cleared on page refresh)
const datasetCache = new Map<string, MarketDataset>();
const metricsCache = new Map<string, MarketMetrics>();
const historyCache = new Map<string, MarketHistory>();

/**
 * Promise caches prevent concurrent callers from launching duplicate requests.
 * CRITICAL: All entries are cleaned up in finally blocks to prevent "zombie"
 * rejected promises that would permanently block retries for a dataset ID.
 */
const datasetPromiseCache = new Map<string, Promise<MarketDataset>>();
const metricsPromiseCache = new Map<string, Promise<MarketMetrics>>();
const historyPromiseCache = new Map<string, Promise<MarketHistory>>();

// ─── Dataset Loading ──────────────────────────────────────────────────────────

async function loadMarketDataset(datasetId: string): Promise<MarketDataset> {
  // 1. In-memory hit
  const cached = datasetCache.get(datasetId);
  if (cached) return cached;

  // 2. Deduplicate concurrent requests via promise cache
  const inFlight = datasetPromiseCache.get(datasetId);
  if (inFlight) return inFlight;

  const isUploaded = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(datasetId);

  const promise = (async (): Promise<MarketDataset> => {
    try {
      if (isUploaded) {
        // Load from Supabase for uploaded datasets
        const { getSupabaseClient } = await import('@/services/supabase/supabase');
        const client = await getSupabaseClient();

        let data: { csv_data?: unknown; counts?: unknown } | null = null;
        let error: { code?: string; message?: string } | null = null;

        const result1 = await client.from('data_sources').select('csv_data, counts').eq('id', datasetId).single();
        if (result1.error?.code === '42703') {
          const result2 = await client.from('data_sources').select('counts').eq('id', datasetId).single();
          data = result2.data;
          error = result2.error;
        } else {
          data = result1.data;
          error = result1.error;
        }

        if (error) throw new Error(`Dataset not found: ${datasetId}`);

        interface ParsedCsvData { sales?: unknown[]; products?: unknown[]; stock?: unknown[]; investments?: unknown[] }

        let csvData = data?.csv_data as ParsedCsvData | null | undefined;
        if (!csvData && data?.counts) {
          const countsObj = data.counts as Record<string, unknown>;
          if (countsObj._data) csvData = countsObj._data as ParsedCsvData;
        }
        if (!csvData) csvData = { products: [], sales: [], stock: [], investments: [] };

        const dataset: MarketDataset = {
          sales: (csvData.sales ?? []) as SalesRow[],
          products: (csvData.products ?? []) as ProductRow[],
          stock: (csvData.stock ?? []) as StockRow[],
          investments: (csvData.investments ?? []) as InvestmentRow[],
        };

        datasetCache.set(datasetId, dataset);
        return dataset;
      } else {
        // Load from public CSV files for synthetic datasets
        const basePath = `/market-dataset/${datasetId}`;
        const [salesData, productsData, stockData, investmentsData] = await Promise.all([
          parseCsv<SalesRow>(`${basePath}/sales.csv`),
          parseCsv<ProductRow>(`${basePath}/products.csv`),
          parseCsv<StockRow>(`${basePath}/stock.csv`),
          parseCsv<InvestmentRow>(`${basePath}/investments.csv`),
        ]);
        const dataset = { sales: salesData, products: productsData, stock: stockData, investments: investmentsData };
        datasetCache.set(datasetId, dataset);
        return dataset;
      }
    } finally {
      // Always clean up — prevents zombie promises on rejection
      datasetPromiseCache.delete(datasetId);
    }
  })();

  datasetPromiseCache.set(datasetId, promise);
  return promise;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getCachedMarketMetrics(datasetId = 'dataset1'): MarketMetrics | null {
  return metricsCache.get(datasetId) ?? readCache<MarketMetrics>(`${METRICS_CACHE_KEY}${datasetId}`);
}

export function getCachedMarketHistory(datasetId = 'dataset1', months = 3): MarketHistory | null {
  const key = `${HISTORY_CACHE_KEY}${datasetId}:${months}`;
  return historyCache.get(key) ?? readCache<MarketHistory>(key);
}

/**
 * Loads and computes MarketMetrics for the given dataset.
 * KPI computation runs in a Web Worker to avoid blocking the UI thread.
 */
export async function loadMarketMetrics(datasetId = 'dataset1'): Promise<MarketMetrics> {
  // 1. Cache check
  const cached = getCachedMarketMetrics(datasetId);
  if (cached) {
    metricsCache.set(datasetId, cached);
    return cached;
  }

  // 2. Deduplicate concurrent requests
  const inFlight = metricsPromiseCache.get(datasetId);
  if (inFlight) return inFlight;

  const promise = (async (): Promise<MarketMetrics> => {
    try {
      const dataset = await loadMarketDataset(datasetId);
      // Off main thread — never blocks React rendering
      const result = await buildMetricsInWorker(dataset);
      metricsCache.set(datasetId, result);
      writeCache(`${METRICS_CACHE_KEY}${datasetId}`, result);
      return result;
    } finally {
      metricsPromiseCache.delete(datasetId);
    }
  })();

  metricsPromiseCache.set(datasetId, promise);
  return promise;
}

/**
 * Loads and computes MarketHistory (month-over-month trend data).
 * History computation also runs in a Web Worker.
 */
export async function loadMarketHistory(datasetId = 'dataset1', months = 3): Promise<MarketHistory> {
  const cacheKey = `${HISTORY_CACHE_KEY}${datasetId}:${months}`;

  // 1. Cache check
  const cached = getCachedMarketHistory(datasetId, months);
  if (cached) {
    historyCache.set(cacheKey, cached);
    return cached;
  }

  // 2. Deduplicate concurrent requests
  const inFlight = historyPromiseCache.get(cacheKey);
  if (inFlight) return inFlight;

  const promise = (async (): Promise<MarketHistory> => {
    try {
      const { sales, products, stock } = await loadMarketDataset(datasetId);
      const result = await buildHistoryInWorker({ sales, products, stock }, months);
      historyCache.set(cacheKey, result);
      writeCache(cacheKey, result);
      return result;
    } finally {
      historyPromiseCache.delete(cacheKey);
    }
  })();

  historyPromiseCache.set(cacheKey, promise);
  return promise;
}
