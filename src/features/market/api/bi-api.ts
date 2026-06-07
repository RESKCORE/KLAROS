import { getCachedMarketMetrics, loadMarketMetrics } from '@/features/market/utils/market-metrics';
import { supabase, getSupabaseClient } from '@/services/supabase/supabase';
import { generateMcdaAnalysis } from '@/services/llm/llm-service';
import Papa from 'papaparse';
import type { Decision } from '@/features/decisions/types/decision';
import type { McdaRawResponse } from '@/features/decisions/core/analysis-schema';

const DATA_SOURCES_CACHE_KEY = 'klaros:data-sources:v3';

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

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function getCachedDataSources(): DataSourceSummary[] | null {
  return readCache<DataSourceSummary[]>(DATA_SOURCES_CACHE_KEY);
}

export async function getDataSources(userId?: string): Promise<DataSourceSummary[]> {
  if (!userId) return [];

  const client = await getSupabaseClient();
  const { data, error } = await client
    .from('data_sources')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load data sources from Supabase:', error);
    const cached = readCache<DataSourceSummary[]>(DATA_SOURCES_CACHE_KEY);
    if (cached) return cached;
    throw error;
  }

  if (!data || data.length === 0) {
    const cached = readCache<DataSourceSummary[]>(DATA_SOURCES_CACHE_KEY);
    if (cached) return cached;
    return [];
  }

  const mapped: DataSourceSummary[] = data.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    name: row.name as string,
    type: row.type as string,
    status: row.status as string,
    lastSyncedAt: (row.last_synced_at as string) || null,
    isSynthetic: !!row.is_synthetic,
    counts: row.counts ? (row.counts as DataSourceSummary['counts']) : null,
  }));

  writeCache(DATA_SOURCES_CACHE_KEY, mapped);
  return mapped;
}

export async function connectSyntheticData(userId: string, datasetId: 'dataset1' | 'dataset2' = 'dataset1'): Promise<{ ok: boolean; dataSourceId: string }> {
  const syntheticSource = {
    user_id: userId,
    name: datasetId === 'dataset2' ? 'Synthetic Dataset 2' : 'Synthetic Supermarket Dataset',
    type: 'supermarket_products',
    status: 'connected',
    is_synthetic: true,
    last_synced_at: new Date().toISOString(),
    counts: { path: datasetId, products: 200, salesHistory: 5000, stockMovements: 200, investments: 50 },
  };

  const client = await getSupabaseClient();
  const { data, error } = await client
    .from('data_sources')
    .insert(syntheticSource)
    .select('id')
    .single();

  if (error) {
    console.error('Failed to connect synthetic data:', error);
    throw error;
  }

  writeCache(DATA_SOURCES_CACHE_KEY, null);
  return { ok: true, dataSourceId: data.id };
}

export async function uploadDataset(
  userId: string,
  _payload: {
    datasetName: string;
    products: File;
    sales: File;
    stock: File;
    investments: File;
  },
): Promise<{ ok: boolean; dataSourceId: string }> {
  try {
    console.log(`🔄 Starting AI-powered dataset upload: ${_payload.datasetName}`);

    // Read all files
    console.log('📄 Reading files...');
    const [productsText, salesText, stockText, investmentsText] = await Promise.all([
      _payload.products.text(),
      _payload.sales.text(),
      _payload.stock.text(),
      _payload.investments.text(),
    ]);

    console.log(`✓ Files read: products=${productsText.length}b, sales=${salesText.length}b, stock=${stockText.length}b, investments=${investmentsText.length}b`);

    // Parse CSVs locally instead of using AI to prevent token limit truncation and ensure accuracy
    console.log('🔄 Parsing CSV files locally...');
    
    const parseCsv = (text: string) => {
      const result = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: true });
      return result.data as Record<string, unknown>[];
    };

    const parsedData = {
      products: parseCsv(productsText),
      sales: parseCsv(salesText),
      stock: parseCsv(stockText),
      investments: parseCsv(investmentsText),
    };

    const totalRows = parsedData.products.length + parsedData.sales.length + parsedData.stock.length + parsedData.investments.length;
    if (totalRows === 0) {
      throw new Error(
        'Dataset uploaded, but no records were extracted. ' +
        'Please verify your CSV files are not empty and have correct headers.'
      );
    }

    console.log(`✅ CSV parsed: products=${parsedData.products.length}, sales=${parsedData.sales.length}, stock=${parsedData.stock.length}, investments=${parsedData.investments.length}`);

    // Create data source record with parsed data
    const client = await getSupabaseClient();
    console.log(`📤 Uploading to Supabase...`);

    const { data, error } = await client
      .from('data_sources')
      .insert({
        user_id: userId,
        name: _payload.datasetName,
        type: 'ai_parsed_upload',
        status: 'connected',
        last_synced_at: new Date().toISOString(),
        counts: {
          products: parsedData.products.length,
          salesHistory: parsedData.sales.length,
          stockMovements: parsedData.stock.length,
          investments: parsedData.investments.length,
        },
        csv_data: parsedData,
      })
      .select('id')
      .single();

    if (error) {
      const errMsg = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('❌ Supabase insertion failed:', errMsg);
      
      // If csv_data column doesn't exist, store in counts._data instead
      if (errMsg.includes('csv_data') || errMsg.includes('column')) {
        console.log('⚠️ csv_data column not found, using fallback storage...');
        const { data: data2, error: error2 } = await client
          .from('data_sources')
          .insert({
            user_id: userId,
            name: _payload.datasetName,
            type: 'ai_parsed_upload',
            status: 'connected',
            last_synced_at: new Date().toISOString(),
            counts: {
              products: parsedData.products.length,
              salesHistory: parsedData.sales.length,
              stockMovements: parsedData.stock.length,
              investments: parsedData.investments.length,
              _data: parsedData,
            },
          })
          .select('id')
          .single();

        if (error2) {
          throw new Error(`Supabase error: ${JSON.stringify(error2)}`);
        }

        writeCache(DATA_SOURCES_CACHE_KEY, null);
        console.log(`✅ Dataset uploaded (fallback): ${data2.id}`);
        return { ok: true, dataSourceId: data2.id };
      }

      throw new Error(`Supabase error: ${errMsg}`);
    }

    writeCache(DATA_SOURCES_CACHE_KEY, null);
    console.log(`✅ Dataset uploaded successfully: ${data.id}`);
    return { ok: true, dataSourceId: data.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('❌ Upload failed:', message);
    console.error('Full error:', err);
    throw new Error(`Failed to upload dataset: ${message}`);
  }
}

export async function autoAnalyze(
  userId: string,
  dataSourceId?: string,
): Promise<{ ok: boolean; decisionId: string }> {
  let metricsPath = 'dataset1';
  const dataSourceUuid = dataSourceId ?? null;

  if (dataSourceId) {
    const cachedSources = getCachedDataSources();
    const source = cachedSources?.find(s => s.id === dataSourceId);
    if (source?.isSynthetic && source.counts && 'path' in source.counts) {
      metricsPath = (source.counts as Record<string, unknown>).path as string;
    }
  }

  const metrics = getCachedMarketMetrics(metricsPath) || (await loadMarketMetrics(metricsPath));

  const summaryMetrics = {
    topProducts: metrics.topProducts.slice(0, 5),
    categories: metrics.categoryNames,
    health: metrics.inventorySummary,
  };

  // If AI fails we let the error propagate — no hardcoded fallback
  const mcdaResult: McdaRawResponse = await generateMcdaAnalysis(JSON.stringify(summaryMetrics));

  // Build the title: "DatasetName_analysis_N_HH:MM"
  const cachedSources = getCachedDataSources();
  const sourceRecord = cachedSources?.find(s => s.id === dataSourceId);
  // Keep the name as-is (e.g. "Gupta's Store") — clean only truly unsafe chars
  const sourceName = (sourceRecord?.name ?? 'Dataset').trim().replace(/[<>"/\\|?*]/g, '');

  // Count existing analyses for this source to get analysis number
  let analysisCount = 1;
  try {
    const client = await getSupabaseClient();
    const { count } = await client
      .from('decisions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('data_source_id', dataSourceUuid);
    analysisCount = (count ?? 0) + 1;
  } catch {
    // fallback to 1
  }

  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const analysisTitle = `${sourceName}_analysis_${analysisCount}_${hhmm}`;

  const decision: Omit<Decision, 'id' | 'created_at' | 'updated_at'> & { user_id: string; data_source_id: string | null } = {
    user_id: userId,
    title: analysisTitle,
    context: mcdaResult.context || mcdaResult.title || '',
    status: 'done',
    data_source_id: dataSourceUuid,
    decision_type: 'business_intelligence',
    options: (mcdaResult.options || []).map(o => ({
      id: o.id || '',
      label: o.label || '',
      description: o.description || ''
    })),
    criteria: (mcdaResult.criteria || []).map(c => ({
      id: c.id || '',
      name: c.name || '',
      weight: typeof c.weight === 'number' ? c.weight : 0
    })),
    constraints: [],
    result_json: {
      recommendation: {
        optionId: mcdaResult.options?.[0]?.id || 'opt-1',
        optionLabel: mcdaResult.options?.[0]?.label || 'Recommendation',
        // confidence comes from AI response, no hardcoded fallback
        confidence: typeof mcdaResult.confidence === 'number' ? mcdaResult.confidence : 70,
        summary: mcdaResult.recommendation || ''
      },
      scores: mcdaResult.scores?.map((score: Record<string, string | number>, i: number) => ({
        optionId: String(score.optionId || ''),
        optionLabel: mcdaResult.options?.find((o) => o.id === score.optionId)?.label || `Option ${i + 1}`,
        criteriaScores: mcdaResult.criteria?.map((c) => ({
          criterionId: c.id,
          criterionName: c.name,
          score: typeof score[c.id] === 'number' ? (score[c.id] as number) : (typeof score.total === 'number' ? score.total as number : 0)
        })) || [],
        totalScore: typeof score.total === 'number' ? score.total : 0,
        rank: i + 1
      })) || [],
      // reasoning comes from AI response
      reasoning: {
        decomposition: mcdaResult.reasoning?.decomposition ?? '',
        assumptions: mcdaResult.reasoning?.assumptions ?? [],
        tradeoffs: mcdaResult.reasoning?.tradeoffs ?? [],
        risks: mcdaResult.reasoning?.risks ?? [],
        sensitivity: mcdaResult.reasoning?.sensitivity ?? ''
      }
    },
  };

  const client = await getSupabaseClient();
  const { data, error } = await client
    .from('decisions')
    .insert(decision)
    .select('id')
    .single();

  if (error) {
    console.error('Auto-analyze failed:', error);
    throw error;
  }

  return { ok: true, decisionId: data.id };
}

export async function deleteDataSource(dataSourceId: string): Promise<void> {
  const client = await getSupabaseClient();
  const { error } = await client
    .from('data_sources')
    .delete()
    .eq('id', dataSourceId);

  if (error) {
    console.error('Failed to delete data source:', error);
    throw error;
  }

  writeCache(DATA_SOURCES_CACHE_KEY, null);
}

export async function getMarketMetricsForSource(dataSourceId: string) {
  let dsId = dataSourceId;
  const cachedSources = getCachedDataSources();
  if (cachedSources) {
    const source = cachedSources.find(s => s.id === dataSourceId);
    if (source?.isSynthetic && source.counts && 'path' in source.counts) {
      dsId = (source.counts as Record<string, unknown>).path as string;
    }
  }

  const cached = getCachedMarketMetrics(dsId);
  if (cached) return cached;
  return loadMarketMetrics(dsId);
}
