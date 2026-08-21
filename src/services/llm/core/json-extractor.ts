/**
 * @file json-extractor.ts
 * @description Hardened JSON extractor and repair engine for LLM responses.
 */

// ─── Pre-processing & Sanitization Helpers ────────────────────────────────────

/**
 * Removes thinking/reasoning tags emitted by reasoning models (DeepSeek-R1, Qwen 2.5/3, etc.)
 */
function stripReasoningTags(raw: string): string {
  let text = raw;
  // Remove completed think/thought blocks
  text = text.replace(/<(?:think|thought)>[\s\S]*?<\/(?:think|thought)>/gi, '');
  // Remove unclosed think/thought blocks at the start
  text = text.replace(/^<(?:think|thought)>[\s\S]*?<\/(?:think|thought)>\s*/gi, '');
  // If only closing tag remains, drop everything before it
  if (text.includes('</think>')) {
    text = text.split('</think>').pop() || text;
  }
  if (text.includes('</thought>')) {
    text = text.split('</thought>').pop() || text;
  }
  return text.trim();
}

/**
 * Removes single-line and multi-line comments outside of string literals.
 */
function stripComments(text: string): string {
  let inString = false;
  let stringChar = '';
  let escaped = false;
  let result = '';

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (escaped) {
      escaped = false;
      result += ch;
      continue;
    }

    if (ch === '\\') {
      escaped = true;
      result += ch;
      continue;
    }

    if (!inString && (ch === '"' || ch === "'")) {
      inString = true;
      stringChar = ch;
      result += ch;
      continue;
    }

    if (inString && ch === stringChar) {
      inString = false;
      stringChar = '';
      result += ch;
      continue;
    }

    if (!inString) {
      if (ch === '/' && next === '/') {
        // Skip till end of line
        const endOfLine = text.indexOf('\n', i);
        if (endOfLine === -1) break;
        i = endOfLine;
        result += '\n';
        continue;
      }
      if (ch === '/' && next === '*') {
        // Skip till end of block comment
        const endOfBlock = text.indexOf('*/', i + 2);
        if (endOfBlock === -1) break;
        i = endOfBlock + 1;
        continue;
      }
    }

    result += ch;
  }

  return result;
}

/**
 * Applies lightweight heuristic repairs to near-valid JSON strings.
 */
function fixCommonJsonIssues(text: string): string {
  let fixed = text;
  // Remove trailing commas before closing brace/bracket
  fixed = fixed.replace(/,\s*([}\]])/g, '$1');
  // Insert missing commas between `}` or `]` and the next `"key":`
  fixed = fixed.replace(/([}\]])[ \t]*\n\s*(")/g, '$1,\n$2');
  // Remove unprintable control characters except newline and tab
  fixed = fixed.split('').filter((ch) => {
    const code = ch.charCodeAt(0);
    return code >= 32 || code === 10 || code === 9 || code === 13;
  }).join('');
  return fixed;
}

/**
 * Attempts to normalise single-quoted JSON-like strings into double-quoted JSON.
 */
function normalizeSingleQuotes(text: string): string {
  return text
    .replace(/'([^'\\]*)'/g, '"$1"')
    .replace(/,\s*}/g, '}')
    .replace(/,\s*]/g, ']');
}

/**
 * Auto-closes unclosed quotes, brackets, and braces if the JSON was truncated at token limits.
 */
function autoCloseJsonStructure(text: string): string {
  const stack: ('}' | ']')[] = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') {
      if (stack.length > 0 && stack[stack.length - 1] === ch) {
        stack.pop();
      }
    }
  }

  let closed = text;
  if (inString) {
    closed += '"';
  }

  // Remove any trailing comma before closing
  closed = closed.replace(/,\s*$/, '');

  while (stack.length > 0) {
    closed += stack.pop();
  }

  return closed;
}

// ─── Bracket Matching State Machine ──────────────────────────────────────────

function extractByBracketMatch(text: string, startPos: number): string | null {
  const startChar = text[startPos] as '{' | '[';
  const endChar = startChar === '{' ? '}' : ']';

  let depth = 0;
  let inString = false;
  let stringChar: '"' | "'" | null = null;
  let escaped = false;

  for (let i = startPos; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }

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

    if (ch === startChar) {
      depth++;
    } else if (ch === endChar) {
      depth--;
      if (depth === 0) {
        return text.substring(startPos, i + 1);
      }
    }
  }

  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extracts a valid JSON string from raw LLM output using a multi-strategy waterfall.
 */
export function extractJSON(raw: string): string {
  if (!raw || typeof raw !== 'string') return '{}';

  // 0. Pre-clean reasoning tags & comments
  let text = stripReasoningTags(raw.trim());
  text = stripComments(text).trim();

  // ── TRY 1: Already valid ──────────────────────────────────────────────────
  try {
    JSON.parse(text);
    return text;
  } catch { /* fall through */ }

  // ── TRY 2: Markdown code block  ```json ... ``` or unclosed ``` ──────────
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    const candidate = codeBlockMatch[1].trim();

    try { JSON.parse(candidate); return candidate; } catch { /* continue */ }

    try {
      const repaired = fixCommonJsonIssues(candidate);
      JSON.parse(repaired);
      return repaired;
    } catch { /* continue */ }

    try {
      const closed = autoCloseJsonStructure(candidate);
      const repaired = fixCommonJsonIssues(closed);
      JSON.parse(repaired);
      return repaired;
    } catch { /* continue */ }
  }

  // ── TRY 3: Substring between first `{` or `[` and last `}` or `]` ─────────
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');
  let firstIdx = -1;
  if (firstBrace !== -1 && firstBracket !== -1) firstIdx = Math.min(firstBrace, firstBracket);
  else if (firstBrace !== -1) firstIdx = firstBrace;
  else if (firstBracket !== -1) firstIdx = firstBracket;

  const lastBrace = text.lastIndexOf('}');
  const lastBracket = text.lastIndexOf(']');
  const lastIdx = Math.max(lastBrace, lastBracket);

  if (firstIdx !== -1 && lastIdx > firstIdx) {
    const candidate = text.substring(firstIdx, lastIdx + 1);
    try { JSON.parse(candidate); return candidate; } catch { /* continue */ }

    try {
      const repaired = fixCommonJsonIssues(candidate);
      JSON.parse(repaired);
      return repaired;
    } catch { /* continue */ }
  }

  // ── TRY 4: Bracket matching state machine ─────────────────────────────────
  if (firstIdx !== -1) {
    const extracted = extractByBracketMatch(text, firstIdx);
    if (extracted) {
      try { JSON.parse(extracted); return extracted; } catch { /* continue */ }

      try {
        const repaired = fixCommonJsonIssues(extracted);
        JSON.parse(repaired);
        return repaired;
      } catch { /* continue */ }

      try {
        const normalised = normalizeSingleQuotes(extracted);
        const repaired = fixCommonJsonIssues(normalised);
        JSON.parse(repaired);
        return repaired;
      } catch { /* continue */ }
    }
  }

  // ── TRY 5: Auto-close truncated structure ─────────────────────────────────
  if (firstIdx !== -1) {
    const candidateFromStart = text.substring(firstIdx);
    try {
      const closed = autoCloseJsonStructure(candidateFromStart);
      const repaired = fixCommonJsonIssues(closed);
      JSON.parse(repaired);
      return repaired;
    } catch { /* continue */ }
  }

  console.warn('[extractJSON] All strategies exhausted; returning raw string');
  return raw;
}
