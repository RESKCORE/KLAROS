/**
 * @file dataset-classifier.ts
 * @description Intelligent Domain Detection and Column Role Classifier for tabular business datasets.
 * Analyzes headers and sample rows to classify data into 6 business domains and infer column roles.
 */

import { callLLMProxy, isProxyConfigured } from '@/services/llm/core/llm-proxy-client';
import { extractJSON } from '@/services/llm/core/json-extractor';

export type DatasetDomain =
  | 'retail_transactions'
  | 'market_securities'
  | 'inventory_stock'
  | 'financial_ledger'
  | 'subscription_saas'
  | 'generic_tabular';

export interface ColumnRoles {
  dateField?: string;
  idField?: string;
  nameField?: string;
  categoryField?: string;
  valueField?: string;          // Primary monetary or valuation metric
  secondaryValueField?: string; // Secondary metric (e.g. credit, cost, open)
  volumeField?: string;         // Quantity, units, or volume traded
  additionalNumericFields?: string[];
  additionalCategoricalFields?: string[];
}

export interface DomainBenchmark {
  label: string;
  valuePct?: number;
  description: string;
}

export interface ClassificationResult {
  domain: DatasetDomain;
  domainDisplayName: string;
  confidence: number; // 0.0 to 1.0
  reasoning: string;
  detectedRoles: ColumnRoles;
  recommendedBenchmark?: DomainBenchmark;
}

export const DOMAIN_METADATA: Record<
  DatasetDomain,
  {
    displayName: string;
    description: string;
    defaultBenchmark?: DomainBenchmark;
  }
> = {
  retail_transactions: {
    displayName: 'Retail Transactions',
    description: 'Transaction-level retail sales logs with SKU, quantity, price, and customer/invoice records.',
    defaultBenchmark: {
      label: 'Retail Benchmark COGS',
      valuePct: 65.0,
      description: 'Standard 65% Cost of Goods Sold (35% gross profit margin).',
    },
  },
  market_securities: {
    displayName: 'Market Securities & Equities',
    description: 'Stock, ETF, crypto, or bond price series with OHLC bars, traded volumes, and returns.',
    defaultBenchmark: {
      label: 'Securities Pricing',
      description: 'Pure price action, volatility, and returns (no COGS or margin concept).',
    },
  },
  inventory_stock: {
    displayName: 'Inventory & Warehouse Stock',
    description: 'Warehouse snapshots of on-hand stock quantities, reorder points, valuation, and holding safety.',
    defaultBenchmark: {
      label: 'Carrying Cost Benchmark',
      valuePct: 18.0,
      description: 'Annualized 18% inventory carrying and warehousing cost benchmark.',
    },
  },
  financial_ledger: {
    displayName: 'Financial Ledger & Accounts',
    description: 'Double-entry accounting, general ledgers, journal entries, and income vs expense line items.',
    defaultBenchmark: {
      label: 'Direct Ledger Balance',
      description: 'Exact measured credits vs debits with net cash position (no synthetic margin modeling).',
    },
  },
  subscription_saas: {
    displayName: 'SaaS & Subscriptions',
    description: 'Recurring subscription revenue logs with customer tiers, MRR/ARR, churn, and renewal cycles.',
    defaultBenchmark: {
      label: 'SaaS Gross Margin Benchmark',
      valuePct: 20.0,
      description: 'Standard 20% Cost of Service benchmark (80% software gross margin).',
    },
  },
  generic_tabular: {
    displayName: 'General Tabular Business Data',
    description: 'Universal business metrics, tabular survey data, operational logs, or multi-attribute datasets.',
    defaultBenchmark: {
      label: 'Descriptive Distribution',
      description: 'Standard statistical aggregation and distribution (sums, averages, frequencies).',
    },
  },
};

// ─── Deterministic Signature Matcher ──────────────────────────────────────────

interface DomainScore {
  domain: DatasetDomain;
  score: number;
  roles: ColumnRoles;
  reason: string;
}

function cleanHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Fast, deterministic pattern matcher that inspects column headers and sample values.
 */
export function classifyDatasetHeuristic(
  headers: string[],
  sampleRows: Record<string, unknown>[] = [],
): DomainScore {
  const cleaned = headers.map(cleanHeader);
  const rawHeaders = headers;

  const has = (...candidates: string[]) => {
    return candidates.some((c) => {
      const target = cleanHeader(c);
      return cleaned.some((h) => h === target || h.includes(target));
    });
  };

  const findHeader = (...candidates: string[]): string | undefined => {
    for (const c of candidates) {
      const target = cleanHeader(c);
      const idx = cleaned.findIndex((h) => h === target || h.includes(target));
      if (idx !== -1) return rawHeaders[idx];
    }
    return undefined;
  };

  // Find generic column roles first
  const dateField = findHeader('date', 'time', 'timestamp', 'createdat', 'invoicedate', 'txndate', 'datetime', 'day');
  const idField = findHeader('id', 'code', 'sku', 'stockcode', 'ticker', 'symbol', 'account', 'customerno', 'itemid');
  const nameField = findHeader('description', 'name', 'title', 'itemname', 'productname', 'accountname', 'memo');
  const categoryField = findHeader('category', 'department', 'dept', 'type', 'group', 'class', 'sector', 'plan');

  // 1. Check Market Securities
  const hasOHLC = (has('open') || has('high') || has('low')) && has('close');
  const hasSecuritiesTerms = has('ticker', 'symbol', 'isin', 'adjclose', 'vwap');
  const hasVolume = has('volume', 'vol', 'shares');

  if (hasOHLC || (hasSecuritiesTerms && (has('price') || has('close') || hasVolume))) {
    let score = 0.7;
    if (hasOHLC) score += 0.2;
    if (hasSecuritiesTerms) score += 0.1;
    if (hasVolume) score += 0.05;

    return {
      domain: 'market_securities',
      score: Math.min(score, 0.99),
      reason: 'Detected securities trading fields (OHLC prices, ticker symbols, or market volume).',
      roles: {
        dateField,
        idField: findHeader('ticker', 'symbol', 'isin') || idField,
        nameField,
        categoryField: findHeader('sector', 'exchange', 'assettype') || categoryField,
        valueField: findHeader('close', 'adjclose', 'price', 'lastprice'),
        secondaryValueField: findHeader('open', 'high', 'low'),
        volumeField: findHeader('volume', 'shares', 'vol'),
      },
    };
  }

  // 2. Check Financial Ledger
  const hasDebit = has('debit', 'dr', 'outflow', 'expense');
  const hasCredit = has('credit', 'cr', 'inflow', 'income');
  const hasLedgerTerms = has('voucher', 'account', 'ledger', 'narration', 'journal', 'chartofaccount', 'taxamount');

  if ((hasDebit && hasCredit) || (hasLedgerTerms && (hasDebit || hasCredit || has('amount', 'balance')))) {
    let score = 0.75;
    if (hasDebit && hasCredit) score += 0.2;
    if (hasLedgerTerms) score += 0.05;

    return {
      domain: 'financial_ledger',
      score: Math.min(score, 0.98),
      reason: 'Detected accounting ledger structure (debit, credit, voucher, or account entries).',
      roles: {
        dateField,
        idField: findHeader('voucher', 'voucherno', 'entryno', 'txnid', 'accountcode') || idField,
        nameField: findHeader('narration', 'particulars', 'memo', 'accountname') || nameField,
        categoryField: findHeader('accounttype', 'head', 'category', 'costcentre') || categoryField,
        valueField: findHeader('debit', 'amount', 'expense'),
        secondaryValueField: findHeader('credit', 'income', 'balance'),
      },
    };
  }

  // 3. Check Subscription / SaaS
  const hasSaaSTerms = has('mrr', 'arr', 'churn', 'subscription', 'billingcycle', 'renew', 'renewaldate', 'seats');
  const hasPlan = has('plan', 'tier', 'package') && (has('customer', 'user', 'account', 'subscriber') || has('status'));

  if (hasSaaSTerms || (hasPlan && has('amount', 'price', 'fee', 'charge'))) {
    let score = 0.72;
    if (has('mrr') || has('arr')) score += 0.22;
    if (has('churn')) score += 0.06;

    return {
      domain: 'subscription_saas',
      score: Math.min(score, 0.98),
      reason: 'Detected subscription recurring revenue indicators (MRR, ARR, plan tiers, or renewal cycles).',
      roles: {
        dateField: findHeader('renewaldate', 'startdate', 'billingdate', 'date') || dateField,
        idField: findHeader('customerid', 'subscriberid', 'subscriptionid', 'accountid') || idField,
        nameField: findHeader('customername', 'user', 'name') || nameField,
        categoryField: findHeader('plan', 'tier', 'subscriptiontier', 'package') || categoryField,
        valueField: findHeader('mrr', 'arr', 'amount', 'fee', 'charge'),
        secondaryValueField: findHeader('arr', 'ltv', 'cac'),
        volumeField: findHeader('seats', 'licenses', 'quantity'),
      },
    };
  }

  // 4. Check Inventory Stock Snapshot
  const hasInventoryTerms = has('onhand', 'reorderpoint', 'safetystock', 'warehouse', 'stocklevel', 'availableqty', 'binlocation');
  const isNotSales = !has('invoiceno', 'quantitysold', 'unitssold', 'orderno');

  if (hasInventoryTerms && isNotSales) {
    let score = 0.75;
    if (has('onhand') || has('reorderpoint')) score += 0.15;
    if (has('warehouse') || has('location')) score += 0.08;

    return {
      domain: 'inventory_stock',
      score: Math.min(score, 0.98),
      reason: 'Detected warehouse inventory indicators (on-hand quantities, reorder points, or storage locations).',
      roles: {
        dateField: findHeader('snapshotdate', 'asofdate', 'stockdate', 'date') || dateField,
        idField: findHeader('sku', 'productid', 'itemcode', 'partnumber') || idField,
        nameField: findHeader('itemname', 'description', 'productname') || nameField,
        categoryField: findHeader('warehouse', 'location', 'bin', 'category') || categoryField,
        valueField: findHeader('unitcost', 'cost', 'valuation', 'itemprice'),
        volumeField: findHeader('onhand', 'availableqty', 'quantity', 'stocklevel'),
        secondaryValueField: findHeader('reorderpoint', 'safetystock', 'minqty'),
      },
    };
  }

  // 5. Check Retail Transactions
  const hasRetailSku = has('stockcode', 'sku', 'productid', 'itemid', 'itemidentifier', 'prodcode');
  const hasRetailQty = has('quantity', 'qty', 'unitssold', 'quantitysold');
  const hasRetailPrice = has('price', 'unitprice', 'sellingprice', 'revenue', 'mrp', 'amount');
  const hasRetailOrder = has('invoice', 'invoiceno', 'orderno', 'orderid', 'customerid', 'customer');

  if ((hasRetailSku && hasRetailQty && hasRetailPrice) || (hasRetailOrder && (hasRetailQty || hasRetailPrice))) {
    let score = 0.75;
    if (has('stockcode') || has('invoiceno')) score += 0.2;
    if (hasRetailOrder) score += 0.05;

    return {
      domain: 'retail_transactions',
      score: Math.min(score, 0.99),
      reason: 'Detected retail sales transaction structure (SKU, quantity, unit price, and invoice/order records).',
      roles: {
        dateField: findHeader('invoicedate', 'orderdate', 'sale_date', 'date') || dateField,
        idField: findHeader('stockcode', 'sku', 'productid', 'itemid') || idField,
        nameField: findHeader('description', 'itemname', 'productname', 'title') || nameField,
        categoryField: findHeader('category', 'department', 'dept', 'deptgroup') || categoryField,
        valueField: findHeader('revenue', 'amount', 'totalsales', 'price', 'unitprice'),
        secondaryValueField: findHeader('cost', 'unitcost', 'cogs', 'buyingprice'),
        volumeField: findHeader('quantity', 'qty', 'unitssold'),
      },
    };
  }

  // 6. Universal Generic Tabular Fallback
  let candidateValueField: string | undefined = undefined;
  let candidateVolumeField: string | undefined = undefined;

  for (const h of rawHeaders) {
    const clean = cleanHeader(h);
    if (clean.includes('total') || clean.includes('amount') || clean.includes('score') || clean.includes('rate') || clean.includes('value')) {
      candidateValueField = h;
      break;
    }
  }

  if (sampleRows.length > 0) {
    const firstRow = sampleRows[0];
    for (const [key, val] of Object.entries(firstRow)) {
      if (typeof val === 'number') {
        if (!candidateValueField) candidateValueField = key;
        else if (!candidateVolumeField) candidateVolumeField = key;
      }
    }
  }

  return {
    domain: 'generic_tabular',
    score: 0.85,
    reason: 'Generic business dataset. Standard descriptive distribution and timeline statistics applied.',
    roles: {
      dateField,
      idField,
      nameField,
      categoryField,
      valueField: candidateValueField || rawHeaders[1] || rawHeaders[0],
      volumeField: candidateVolumeField,
    },
  };
}

// ─── Classification Entry Point (with LLM Refinement if Ambiguous) ───────────

/**
 * Classifies any tabular dataset into a business domain, combining fast heuristic signatures
 * with LLM verification if the heuristics are uncertain.
 */
export async function classifyDataset(
  headers: string[],
  sampleRows: Record<string, unknown>[] = [],
): Promise<ClassificationResult> {
  const heuristic = classifyDatasetHeuristic(headers, sampleRows);

  if (heuristic.score >= 0.85 || !isProxyConfigured()) {
    return {
      domain: heuristic.domain,
      domainDisplayName: DOMAIN_METADATA[heuristic.domain].displayName,
      confidence: heuristic.score,
      reasoning: heuristic.reason,
      detectedRoles: heuristic.roles,
      recommendedBenchmark: DOMAIN_METADATA[heuristic.domain].defaultBenchmark,
    };
  }

  try {
    const prompt = `You are an enterprise data classification system. Analyze the following table headers and sample records to determine which of these 6 domains best represents the dataset:
- retail_transactions: SKU/product/quantity/price/order rows
- market_securities: ticker/ISIN, OHLC price bars, volume, returns
- inventory_stock: warehouse/item on-hand stock, reorder thresholds, unit cost
- financial_ledger: accounting ledger with debits, credits, vouchers, or account codes
- subscription_saas: SaaS/subscriptions with MRR, ARR, churn, customer tiers
- generic_tabular: general business data not specifically fitting the above

HEADERS:
${JSON.stringify(headers)}

SAMPLE ROWS (up to 3):
${JSON.stringify(sampleRows.slice(0, 3))}

Return ONLY a valid JSON object matching this schema:
{
  "domain": "retail_transactions" | "market_securities" | "inventory_stock" | "financial_ledger" | "subscription_saas" | "generic_tabular",
  "confidence": 0.95,
  "reasoning": "brief explanation",
  "detectedRoles": {
    "dateField": "header name or omit",
    "idField": "header name or omit",
    "nameField": "header name or omit",
    "categoryField": "header name or omit",
    "valueField": "header name or omit",
    "volumeField": "header name or omit"
  }
}`;

    const raw = await callLLMProxy(prompt, { maxTokens: 400, temperature: 0.1, requireJson: true });
    const json = extractJSON(raw);
    const parsed = JSON.parse(json);

    if (parsed && parsed.domain && DOMAIN_METADATA[parsed.domain as DatasetDomain]) {
      const selectedDomain = parsed.domain as DatasetDomain;
      return {
        domain: selectedDomain,
        domainDisplayName: DOMAIN_METADATA[selectedDomain].displayName,
        confidence: Math.max(Number(parsed.confidence) || 0.85, 0.7),
        reasoning: parsed.reasoning || heuristic.reason,
        detectedRoles: { ...heuristic.roles, ...(parsed.detectedRoles || {}) },
        recommendedBenchmark: DOMAIN_METADATA[selectedDomain].defaultBenchmark,
      };
    }
  } catch (err) {
    console.warn('[dataset-classifier] LLM classification fallback to heuristic:', err);
  }

  return {
    domain: heuristic.domain,
    domainDisplayName: DOMAIN_METADATA[heuristic.domain].displayName,
    confidence: heuristic.score,
    reasoning: heuristic.reason,
    detectedRoles: heuristic.roles,
    recommendedBenchmark: DOMAIN_METADATA[heuristic.domain].defaultBenchmark,
  };
}
