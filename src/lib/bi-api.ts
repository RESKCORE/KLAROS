const DEFAULT_API_BASE = 'http://localhost:4000';
const DATA_SOURCES_CACHE_KEY = 'klaros:data-sources:v1';
const DATA_SOURCES_TTL_MS = 1000 * 60 * 5;

type CachePayload<T> = { timestamp: number; value: T };

function readCache<T>(key: string): T | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as CachePayload<T>;
    if (!parsed?.timestamp) {
      return null;
    }
    if (Date.now() - parsed.timestamp > DATA_SOURCES_TTL_MS) {
      window.localStorage.removeItem(key);
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, value: T) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), value }));
  } catch {
    // Ignore storage errors.
  }
}

async function protectedFetch(path: string, options: RequestInit = {}) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE;
  if (window.Clerk && !window.Clerk.loaded) {
    await window.Clerk.load();
  }

  let token: string | null = null;
  try {
    token = await window.Clerk?.session?.getToken();
  } catch (err) {
    console.error('Failed to get token', err);
  }

  if (!token) {
    await window.Clerk?.signOut();
    throw new Error('no_auth_token');
  }

  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  let response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    const data = await response.json().catch(() => ({}));
    const errorCode = data?.error || 'unauthorized';

    if (errorCode === 'token_expired') {
      try {
        const freshToken = await window.Clerk?.session?.getToken({ skipCache: true });
        if (freshToken) {
          headers.set('Authorization', `Bearer ${freshToken}`);
          response = await fetch(`${baseUrl}${path}`, {
            ...options,
            headers,
          });

          if (response.ok) {
            return response.status === 204 ? undefined : response.json();
          }
        }
      } catch (err) {
        console.error('Failed to refresh token', err);
      }
    }

    if (errorCode === 'token_expired') {
      console.warn('Token expired - user should re-login');
      await window.Clerk?.signOut();
    }

    throw new Error(errorCode);
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error || 'Request failed');
  }

  if (response.status === 204) {
    return undefined;
  }

  return response.json();
}

export type DataSourceSummary = {
  id: string;
  name: string;
  type: string;
  status: string;
  lastSyncedAt?: string | null;
  isSynthetic?: boolean;
  counts?: {
    products: number;
    salesHistory: number;
    stockMovements: number;
    investments: number;
  } | null;
};

export function getCachedDataSources(): DataSourceSummary[] | null {
  return readCache<DataSourceSummary[]>(DATA_SOURCES_CACHE_KEY);
}

export async function getDataSources() {
  const sources = (await protectedFetch('/api/data-sources', { method: 'GET' })) as DataSourceSummary[];
  writeCache(DATA_SOURCES_CACHE_KEY, sources);
  return sources;
}

export async function connectSyntheticData() {
  return (await protectedFetch('/api/connect-data', { method: 'POST' })) as {
    ok: boolean;
    dataSourceId: string;
  };
}

export async function autoAnalyze(dataSourceId?: string) {
  return (await protectedFetch('/api/auto-analyze', {
    method: 'POST',
    body: JSON.stringify({ dataSourceId }),
  })) as {
    ok: boolean;
    decisionId: string;
  };
}

export async function uploadDataset(payload: {
  datasetName: string;
  products: File;
  sales: File;
  stock: File;
  investments: File;
}) {
  const formData = new FormData();
  formData.append('datasetName', payload.datasetName);
  formData.append('products', payload.products);
  formData.append('sales', payload.sales);
  formData.append('stock', payload.stock);
  formData.append('investments', payload.investments);

  return (await protectedFetch('/api/upload-dataset', {
    method: 'POST',
    body: formData,
  })) as { ok: boolean; dataSourceId: string };
}

export async function getMarketMetricsForSource(dataSourceId: string) {
  return (await protectedFetch(`/api/market-metrics/${dataSourceId}`, {
    method: 'GET',
  })) as {
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
}
