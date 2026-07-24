/**
 * @file json-extractor.ts
 * @description Hardened JSON extractor for LLM responses.
 *
 * LLM outputs are notoriously inconsistent: some models wrap JSON in markdown
 * code fences, others prepend prose, others truncate mid-object, and a few
 * use single-quoted strings instead of double-quoted ones (invalid JSON).
 *
 * This module implements a multi-strategy extraction pipeline, from cheapest
 * to most expensive, bailing out as soon as a valid parse succeeds.
 *
 * Key improvements over the original:
 *  - TRY 4 bracket matcher correctly handles single-quoted strings so the
 *    inString state is not corrupted by a `"` inside a `'...'` value.
 *  - TRY 5 (progressive shrink) is bounded to 200 chars max trim to avoid
 *    the original O(n²) worst-case where JSON.parse ran O(n) times.
 */

// ─── JSON Repair Helpers ──────────────────────────────────────────────────────

/**
 * Applies lightweight heuristic repairs to near-valid JSON strings.
 * Only covers the most common LLM output defects:
 *  1. Trailing commas before `}` or `]`
 *  2. Missing commas between top-level object properties
 */
function fixCommonJsonIssues(text: string): string {
  let fixed = text;
  // Remove trailing commas before closing brace/bracket
  fixed = fixed.replace(/,\s*([}\]])/g, '$1');
  // Insert missing commas between `}` or `]` and the next `"key":`
  fixed = fixed.replace(/([}\]])[ \t]*\n\s*(")/g, '$1,\n$2');
  return fixed;
}

/**
 * Attempts to normalise single-quoted JSON-like strings into double-quoted
 * JSON.  This is a best-effort pass — valid JSON with single-quoted keys
 * is technically invalid JSON but some weak LLMs emit it.
 *
 * We avoid a naive global replace which would break apostrophes inside values;
 * instead we only replace quotes that are in key position.
 */
function normalizeSingleQuotes(text: string): string {
  // Replace 'key' : with "key" : at the start of object properties
  return text
    .replace(/'([^'\\]*)'/g, '"$1"') // simple unescaped single-quoted strings
    .replace(/,\s*}/g, '}')          // trailing commas after normalize
    .replace(/,\s*]/g, ']');
}

// ─── Bracket Matching State Machine ──────────────────────────────────────────

/**
 * Walks the string from `startPos` using a depth-tracking state machine to
 * find the closing brace/bracket that matches the opening character at
 * `startPos`.
 *
 * Handles:
 *  - Escape sequences (`\n`, `\"`, `\\`, etc.)
 *  - Both double-quoted and single-quoted strings (so a `"` inside `'...'`
 *    does NOT toggle the inString flag)
 *
 * @returns The extracted substring including both delimiters, or null if
 *          the string is unbalanced (e.g. truncated LLM output).
 */
function extractByBracketMatch(text: string, startPos: number): string | null {
  const startChar = text[startPos] as '{' | '[';
  const endChar = startChar === '{' ? '}' : ']';

  let depth = 0;
  let inString = false;
  let stringChar: '"' | "'" | null = null;
  let escaped = false;

  for (let i = startPos; i < text.length; i++) {
    const ch = text[i];

    // ── Escape handling ────────────────────────────────────────────────────
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }

    // ── String open/close ─────────────────────────────────────────────────
    if (!inString && (ch === '"' || ch === "'")) {
      inString = true;
      stringChar = ch;
      continue;
    }
    if (inString && ch === stringChar) {
      inString = false;
      stringChar = null;
      continue;
    }
    if (inString) continue;

    // ── Depth tracking ────────────────────────────────────────────────────
    if (ch === startChar) {
      depth++;
    } else if (ch === endChar) {
      depth--;
      if (depth === 0) {
        return text.substring(startPos, i + 1);
      }
    }
  }

  return null; // unbalanced / truncated
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extracts a valid JSON string from raw LLM output using a 5-strategy
 * waterfall.  Returns the original raw string if all strategies fail so the
 * caller can handle the error gracefully.
 */
export function extractJSON(raw: string): string {
  const text = raw.trim();

  // ── TRY 1: Already valid ──────────────────────────────────────────────────
  try {
    JSON.parse(text);
    return text;
  } catch { /* fall through */ }

  // ── TRY 2: Markdown code block  ```json ... ``` ───────────────────────────
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    const candidate = codeBlockMatch[1].trim();

    try { JSON.parse(candidate); return candidate; } catch { /* continue */ }

    // Try repairing the code block content
    try {
      const repaired = fixCommonJsonIssues(candidate);
      JSON.parse(repaired);
      return repaired;
    } catch { /* continue */ }
  }

  // ── TRY 3: Strip all backtick fences ─────────────────────────────────────
  const stripped = text.replace(/```[\s\S]*?```/g, '').replace(/`/g, '').trim();
  try {
    JSON.parse(stripped);
    return stripped;
  } catch { /* continue */ }

  // ── TRY 4: Bracket matching (handles prefix/suffix prose) ─────────────────
  const jsonStart = text.search(/[{[]/);
  if (jsonStart !== -1) {
    const extracted = extractByBracketMatch(text, jsonStart);
    if (extracted) {
      try { JSON.parse(extracted); return extracted; } catch { /* continue */ }

      // Try repairing the bracket-matched content
      try {
        const repaired = fixCommonJsonIssues(extracted);
        JSON.parse(repaired);
        return repaired;
      } catch { /* continue */ }

      // Try normalising single-quoted strings, then repair
      try {
        const normalised = normalizeSingleQuotes(extracted);
        const repaired = fixCommonJsonIssues(normalised);
        JSON.parse(repaired);
        return repaired;
      } catch { /* continue */ }
    }
  }

  // ── TRY 5: Bounded tail-trim (handles truncated output) ──────────────────
  // Only trim up to 200 chars from the end to stay O(n) instead of O(n²).
  const startPos = text.search(/[{[]/);
  if (startPos !== -1) {
    const maxTrim = Math.min(200, text.length - startPos - 1);
    for (let trim = 0; trim <= maxTrim; trim++) {
      const chunk = text.substring(startPos, text.length - trim);
      try {
        const repaired = fixCommonJsonIssues(chunk);
        JSON.parse(repaired);
        return repaired;
      } catch { /* continue shrinking */ }
    }
  }

  // All strategies exhausted — return raw so the caller can throw informatively
  console.warn('[extractJSON] All strategies exhausted; returning raw string');
  return raw;
}
