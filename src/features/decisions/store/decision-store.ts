import type { Decision, DecisionStatus } from '@/features/decisions/types/decision';
import { supabase, getSupabaseClient } from '@/services/supabase/supabase';

const DECISIONS_CACHE_PREFIX = 'klaros:decisions:v3:';

type DecisionRow = {
  id: string;
  user_id: string;
  title: string;
  context: string | null;
  status: string;
  data_source_id: string | null;
  decision_type: string | null;
  options: unknown;
  criteria: unknown;
  constraints: unknown;
  result_json: unknown;
  created_at: string;
  updated_at: string;
};

function mapRowToDecision(row: DecisionRow): Decision {
  return {
    id: row.id,
    title: row.title,
    context: row.context || undefined,
    status: row.status as DecisionStatus,
    data_source_id: row.data_source_id,
    decision_type: row.decision_type,
    options: Array.isArray(row.options) ? row.options : [],
    criteria: Array.isArray(row.criteria) ? row.criteria : [],
    constraints: Array.isArray(row.constraints) ? row.constraints : [],
    result_json: row.result_json as Decision['result_json'] | undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
    user_id: row.user_id,
  };
}

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

type DecisionFilters = {
  status?: DecisionStatus[];
  search?: string;
};

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

export async function getUserDecisions(
  userId: string,
  filters?: DecisionFilters,
): Promise<Decision[]> {
  const client = await getSupabaseClient();
  let query = client
    .from('decisions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (filters?.status?.length) {
    query = query.in('status', filters.status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to load decisions from Supabase:', error);
    const cached = readCache<Decision[]>(`${DECISIONS_CACHE_PREFIX}${userId}`);
    if (cached) return cached;
    throw error;
  }

  let decisions = (data as DecisionRow[]).map(mapRowToDecision);

  if (filters?.search) {
    const q = normalizeSearch(filters.search);
    decisions = decisions.filter((d) => d.title.toLowerCase().includes(q));
  }

  if (!filters?.status?.length && !filters?.search) {
    writeCache(`${DECISIONS_CACHE_PREFIX}${userId}`, decisions);
  }

  return decisions;
}

export function getCachedUserDecisions(userId: string): Decision[] | null {
  return readCache<Decision[]>(`${DECISIONS_CACHE_PREFIX}${userId}`);
}

export async function getDecision(id: string): Promise<Decision> {
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from('decisions')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Decision not found');
  }

  return mapRowToDecision(data as DecisionRow);
}

export async function updateDecisionStatus(id: string, status: DecisionStatus): Promise<void> {
  const client = await getSupabaseClient();
  const { error } = await client
    .from('decisions')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Failed to update decision status:', error);
    throw error;
  }
}

export async function archiveDecision(id: string): Promise<void> {
  await updateDecisionStatus(id, 'archived');
}

export async function deleteDecision(id: string): Promise<void> {
  const client = await getSupabaseClient();
  const { error } = await client
    .from('decisions')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Failed to delete decision:', error);
    throw error;
  }
}
