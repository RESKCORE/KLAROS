/**
 * @file date-utils.ts
 * @description Robust date normalization utilities for raw dataset rows, Excel dates, and AI forecasts.
 */

/**
 * Safely converts any date value (Date object, timestamp, ISO string,
 * UK/US date format "DD/MM/YYYY" or "YYYY-MM-DD") to a clean "YYYY-MM-DD" string.
 * Prevents String(new Date()).split(' ')[0] from accidentally returning day-of-week strings ("Tue", "Wed").
 */
export function normalizeDateToYMD(val: unknown): string {
  if (!val && val !== 0) return '2025-01-01';

  // 1. Native Date instance
  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, '0');
      const d = String(val.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return '2025-01-01';
  }

  // 2. Excel serial number or Unix timestamp
  if (typeof val === 'number' && !isNaN(val)) {
    // Excel serial date (e.g. 40148 is 2009-12-01)
    if (val >= 25569 && val <= 60000) {
      const epochMs = (val - 25569) * 86400 * 1000;
      const d = new Date(epochMs);
      if (!isNaN(d.getTime())) {
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      }
    }
    // Millisecond timestamp
    if (val > 100000000000) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
    }
  }

  const str = String(val).trim();
  if (!str || str === 'undefined' || str === 'null') return '2025-01-01';

  // 3. String starting with YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // 4. String like DD/MM/YYYY or DD-MM-YYYY (common in UK retail data)
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // 5. General parseable string (e.g. "Tue Dec 01 2009 07:45:00 GMT+0000")
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return '2025-01-01';
}

/**
 * Returns YYYY-MM from any date value or string
 */
export function toMonthKey(val: unknown): string {
  return normalizeDateToYMD(val).slice(0, 7);
}
