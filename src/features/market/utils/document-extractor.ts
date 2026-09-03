/**
 * @file document-extractor.ts
 * @description Universal multi-format file parser for KLAROS.
 * Parses CSV, XLSX, JSON, XML, PDF, DOCX, and TXT files into raw tabular records.
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export type ExtractedSheet = {
  name: string;
  data: Record<string, unknown>[];
  headers: string[];
};

export type ExtractionResult = {
  fileName: string;
  fileType: 'csv' | 'xlsx' | 'json' | 'xml' | 'pdf' | 'docx' | 'txt' | 'unknown';
  sheets: ExtractedSheet[];
};

/**
 * Parses any uploaded File object into a unified ExtractionResult containing
 * headers and row records per sheet/table.
 */
export async function parseDocument(file: File): Promise<ExtractionResult> {
  const name = file.name;
  const ext = name.split('.').pop()?.toLowerCase() ?? '';

  if (ext === 'csv') {
    return parseCsv(file);
  }
  if (ext === 'xlsx' || ext === 'xls') {
    return parseExcel(file);
  }
  if (ext === 'json') {
    return parseJson(file);
  }
  if (ext === 'xml') {
    return parseXml(file);
  }
  if (ext === 'txt' || ext === 'pdf' || ext === 'docx') {
    return parseTextOrDoc(file, ext);
  }

  // Fallback try as text or csv
  return parseCsv(file);
}

// ─── Quote Sanitizer for Robust CSV Parsing ──────────────────────────────────

/**
 * Sanitizes stray/unescaped quotes in CSV text so PapaParse never swallows
 * subsequent lines into an unclosed multi-line quote.
 * Handles retail descriptions containing unescaped inch marks (e.g. 4" CAKESTAND)
 * or unbalanced quotes.
 */
export function sanitizeCsvText(text: string): string {
  if (!text.includes('"')) return text;

  const lines = text.split(/\r?\n/);
  const sanitizedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (!line) {
      sanitizedLines.push(line);
      continue;
    }

    // Count double quotes in this line
    let quoteCount = 0;
    for (let c = 0; c < line.length; c++) {
      if (line[c] === '"') quoteCount++;
    }

    // If odd number of quotes, an unescaped quote has opened and wasn't closed on this line
    if (quoteCount % 2 !== 0) {
      // Replace stray internal quotes that are neither preceded nor followed by delimiter/boundary
      // e.g. 4" CAKESTAND -> 4' CAKESTAND
      line = line.replace(/(?<!^|,)"(?!,|$)/g, "'");

      // Recount quotes
      let newCount = 0;
      for (let c = 0; c < line.length; c++) {
        if (line[c] === '"') newCount++;
      }

      // If still odd, close it at the end of the line
      if (newCount % 2 !== 0) {
        line = line + '"';
      }
    }

    sanitizedLines.push(line);
  }

  return sanitizedLines.join('\n');
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────

async function parseCsv(file: File): Promise<ExtractionResult> {
  const rawText = await readFileAsText(file);
  const cleanText = sanitizeCsvText(rawText);

  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(cleanText, {
      header: true,
      skipEmptyLines: 'greedy',
      dynamicTyping: true,
      complete: (results) => {
        const headers = results.meta.fields ?? (results.data[0] ? Object.keys(results.data[0]) : []);
        console.log(`[DocumentExtractor] Successfully parsed ${results.data.length} rows from CSV ${file.name}`);
        resolve({
          fileName: file.name,
          fileType: 'csv',
          sheets: [
            {
              name: 'Sheet1',
              data: results.data,
              headers,
            },
          ],
        });
      },
      error: (err) => reject(new Error(`CSV parse error: ${err.message}`)),
    });
  });
}

// ─── Excel Parser (Supports Multi-Sheet Workbooks) ────────────────────────────

async function parseExcel(file: File): Promise<ExtractionResult> {
  const buffer = await file.arrayBuffer();
  // Parse full workbook across all sheets with dense cell storage for memory efficiency
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true, dense: true });

  const sheets: ExtractedSheet[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
    if (data.length === 0) continue;

    const headers = Object.keys(data[0]);
    sheets.push({
      name: sheetName,
      data,
      headers,
    });
  }

  return {
    fileName: file.name,
    fileType: 'xlsx',
    sheets,
  };
}

async function readFileAsText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

// ─── JSON Parser ───────────────────────────────────────────────────────────────

async function parseJson(file: File): Promise<ExtractionResult> {
  const text = await readFileAsText(file);
  const raw = JSON.parse(text);
  const sheets: ExtractedSheet[] = [];

  if (Array.isArray(raw)) {
    // Single list of objects
    const headers = raw.length > 0 && typeof raw[0] === 'object' && raw[0] !== null ? Object.keys(raw[0]) : [];
    sheets.push({
      name: 'Data',
      data: raw as Record<string, unknown>[],
      headers,
    });
  } else if (typeof raw === 'object' && raw !== null) {
    // Nested object where keys are table names (e.g. { sales: [...], products: [...] })
    for (const [key, value] of Object.entries(raw)) {
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
        const headers = Object.keys(value[0]);
        sheets.push({
          name: key,
          data: value as Record<string, unknown>[],
          headers,
        });
      }
    }
    // Fallback if no array property found
    if (sheets.length === 0) {
      sheets.push({
        name: 'Data',
        data: [raw as Record<string, unknown>],
        headers: Object.keys(raw),
      });
    }
  }

  return {
    fileName: file.name,
    fileType: 'json',
    sheets,
  };
}

// ─── XML Parser ───────────────────────────────────────────────────────────────

async function parseXml(file: File): Promise<ExtractionResult> {
  const text = await readFileAsText(file);
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(text, 'text/xml');

  const sheets: ExtractedSheet[] = [];
  const root = xmlDoc.documentElement;

  // Search child nodes for repeating elements
  const children = Array.from(root.children);
  const rows: Record<string, unknown>[] = [];

  for (const child of children) {
    const rowObj: Record<string, unknown> = {};
    for (const attr of Array.from(child.attributes)) {
      rowObj[attr.name] = attr.value;
    }
    for (const field of Array.from(child.children)) {
      rowObj[field.tagName] = field.textContent?.trim() ?? '';
    }
    if (Object.keys(rowObj).length > 0) {
      rows.push(rowObj);
    }
  }

  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  sheets.push({
    name: root.tagName || 'XML_Data',
    data: rows,
    headers,
  });

  return {
    fileName: file.name,
    fileType: 'xml',
    sheets,
  };
}

// ─── Text / PDF / DOCX Delimited Table Parser ───────────────────────────────

async function parseTextOrDoc(file: File, ext: string): Promise<ExtractionResult> {
  const text = await readFileAsText(file);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { fileName: file.name, fileType: ext as 'pdf' | 'docx' | 'txt', sheets: [] };
  }

  // Detect separator: Tab (\t), Pipe (|), Semicolon (;), Comma (,), or 2+ Spaces
  const sample = lines[0];
  let delimiter: string | RegExp = ',';
  if (sample.includes('\t')) delimiter = '\t';
  else if (sample.includes('|')) delimiter = '|';
  else if (sample.includes(';')) delimiter = ';';
  else if (/\s{2,}/.test(sample)) delimiter = /\s{2,}/;

  const rawHeaders = sample.split(delimiter).map((h) => h.replace(/^["'|]+|["'|]+$/g, '').trim());
  const rows: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(delimiter).map((p) => p.replace(/^["'|]+|["'|]+$/g, '').trim());
    const rowObj: Record<string, unknown> = {};
    rawHeaders.forEach((h, idx) => {
      const val = parts[idx] ?? '';
      // Try convert numeric string
      const num = Number(val);
      rowObj[h] = !isNaN(num) && val !== '' ? num : val;
    });
    rows.push(rowObj);
  }

  return {
    fileName: file.name,
    fileType: ext as 'pdf' | 'docx' | 'txt',
    sheets: [
      {
        name: 'ExtractedTable',
        data: rows,
        headers: rawHeaders,
      },
    ],
  };
}
