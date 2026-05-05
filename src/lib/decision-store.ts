import type { Decision, DecisionStatus } from '@/types/decision';
import { apiFetch } from '@/lib/api';
import type { TokenProvider } from '@/lib/api';

const DECISIONS_CACHE_TTL_MS = 1000 * 60 * 5;
const DECISIONS_CACHE_PREFIX = 'klaros:decisions:v1:';

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
    if (Date.now() - parsed.timestamp > DECISIONS_CACHE_TTL_MS) {
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
  getToken?: TokenProvider,
): Promise<Decision[]> {
  const params = new URLSearchParams();
  if (filters?.status?.length) {
    filters.status.forEach((status) => params.append('status', status));
  }
  if (filters?.search) {
    params.set('search', normalizeSearch(filters.search));
  }

  const query = params.toString();
  const path = query ? `/api/decisions?${query}` : '/api/decisions';
  const decisions = await apiFetch<Decision[]>(path, { method: 'GET' }, getToken);
  if (!filters?.search && !filters?.status?.length) {
    writeCache(`${DECISIONS_CACHE_PREFIX}${userId}`, decisions);
  }
  return decisions;
}

export function getCachedUserDecisions(userId: string): Decision[] | null {
  return readCache<Decision[]>(`${DECISIONS_CACHE_PREFIX}${userId}`);
}

export async function getDecision(id: string, getToken?: TokenProvider): Promise<Decision> {
  return apiFetch<Decision>(`/api/decisions/${id}`, { method: 'GET' }, getToken);
}

export async function updateDecisionStatus(
  id: string,
  status: DecisionStatus,
  getToken?: TokenProvider,
): Promise<void> {
  await apiFetch<Decision>(
    `/api/decisions/${id}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    },
    getToken,
  );
}

export async function archiveDecision(id: string, getToken?: TokenProvider): Promise<void> {
  await updateDecisionStatus(id, 'archived', getToken);
}

export async function deleteDecision(id: string, getToken?: TokenProvider): Promise<void> {
  await apiFetch<void>(`/api/decisions/${id}`, { method: 'DELETE' }, getToken);
}
