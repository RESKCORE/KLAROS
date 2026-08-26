export function readCache<T>(key: string, ttlMs?: number): T | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'timestamp' in parsed && 'value' in parsed) {
      if (ttlMs && Date.now() - (parsed as { timestamp: number }).timestamp > ttlMs) {
        window.localStorage.removeItem(key);
        return null;
      }
      return (parsed as { value: T }).value;
    }
    return parsed as T;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, value: T, withTimestamp = false): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const payload = withTimestamp ? { timestamp: Date.now(), value } : value;
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore quota/security storage errors
  }
}
