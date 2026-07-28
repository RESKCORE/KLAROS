/**
 * @file schema-mapper.ts
 * @description AI-Powered Dynamic Schema Mapping and Heuristic Normalisation.
 * Maps non-standard dataset headers to KLAROS canonical financial schemas.
 */

export type TableType = 'sales' | 'products' | 'stock' | 'investments' | 'unknown';

export type FieldMapping = {
  canonicalField: string;
  sourceHeader: string | null; // null if unmapped
  confidence: number; // 0 to 1
  isAutoFilled?: boolean;
};

export type TableMappingResult = {
  tableName: string;
  detectedTableType: TableType;
  confidence: number;
  fieldMappings: FieldMapping[];
};

// ─── Synonyms Dictionary for Fast Heuristic Mapping ──────────────────────────

const CANONICAL_SCHEMAS: Record<TableType, Record<string, string[]>> = {
  sales: {
    sku: ['sku', 'product_id', 'item_code', 'code', 'id', 'product_code', 'item_id', 'sku_id', 'product_sku', 'prod_id', 'prodcode'],
    date: ['date', 'transaction_date', 'sale_date', 'time', 'created_at', 'dt', 'order_date', 'timestamp', 'txn_date', 'txn_time'],
    quantity: ['quantity', 'qty', 'units', 'units_sold', 'count', 'volume', 'quantity_sold', 'number_sold', 'items_sold', 'in_stock_qty'],
    revenue: ['revenue', 'total_sales', 'amount', 'sales', 'total_amount', 'price_total', 'turnover', 'total_price', 'selling_price', 'sale_amount', 'gross_sales', 'selling_price_inr'],
    cost: ['cost', 'cost_price', 'unit_cost', 'cogs', 'cost_per_unit', 'buying_price', 'purchase_cost'],
    discount: ['discount', 'discount_amount', 'disc', 'rebate', 'markdown', 'savings', 'promo_discount'],
    payment_method: ['payment_method', 'payment_type', 'pay_mode', 'payment', 'mode', 'channel', 'pay_type'],
    store_city: ['store_city', 'city', 'location', 'branch', 'store', 'region', 'place', 'city_name', 'branch_location'],
  },
  products: {
    sku: ['sku', 'product_id', 'item_code', 'code', 'id', 'product_code', 'item_id', 'prod_id', 'prodcode'],
    name: ['name', 'product_name', 'title', 'item_name', 'product', 'item_title', 'description', 'prod_name', 'itemdesc', 'item_desc', 'prod_desc', 'product_desc', 'itemdescription'],
    category: ['category', 'dept', 'department', 'group', 'type', 'cat', 'class', 'category_name', 'dept_group'],
    subcategory: ['subcategory', 'sub_category', 'sub_dept', 'subcat', 'family'],
    brand: ['brand', 'make', 'manufacturer', 'vendor', 'company', 'label'],
    price: ['price', 'selling_price', 'unit_price', 'mrp', 'retail_price', 'list_price', 'rate', 'sell_price', 'selling_price_inr', 'unit_price_inr'],
    cost: ['cost', 'cost_price', 'unit_cost', 'purchase_price', 'cogs', 'buying_price', 'buy_rate', 'cost_per_unit'],
    supplier: ['supplier', 'vendor', 'distributor', 'supplier_name', 'source'],
    shelf_life_days: ['shelf_life_days', 'shelf_life', 'expiry_days', 'exp_days', 'life_span'],
    weight_kg: ['weight_kg', 'weight', 'unit_weight', 'net_weight', 'size_kg'],
    launch_date: ['launch_date', 'created_date', 'added_date', 'release_date'],
  },
  stock: {
    sku: ['sku', 'product_id', 'item_code', 'code', 'id'],
    date: ['date', 'stock_date', 'as_of_date', 'snapshot_date'],
    quantity: ['quantity', 'stock_quantity', 'current_stock', 'stock_level', 'available_stock', 'in_stock', 'on_hand', 'qty', 'units'],
    beginning_stock: ['beginning_stock', 'start_stock', 'initial_stock', 'opening_stock'],
    units_sold: ['units_sold', 'qty_sold', 'sold_units', 'sales_units'],
    reorder_point: ['reorder_point', 'reorder_threshold', 'min_stock', 'alert_level', 'safety_stock', 'min_qty'],
    supplier_lead_time: ['supplier_lead_time', 'lead_time', 'delivery_days', 'lead_time_days', 'lead_days'],
  },
  investments: {
    date: ['date', 'investment_date', 'spent_date', 'created_at'],
    amount: ['amount', 'investment_amount', 'cost', 'spend', 'expenditure', 'budget', 'capital'],
    category: ['category', 'type', 'department', 'channel'],
    description: ['description', 'details', 'purpose', 'name', 'memo', 'note'],
    expected_roi: ['expected_roi', 'roi', 'return_pct', 'expected_return', 'roi_pct'],
  },
  unknown: {},
};

// ─── Table Type Auto-Detection ────────────────────────────────────────────────

/**
 * Automatically infers whether a table is sales, products, stock, or investments
 * based on header similarity with canonical dictionaries.
 */
export function detectTableType(headers: string[]): { tableType: TableType; confidence: number } {
  const normHeaders = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

  let bestType: TableType = 'unknown';
  let maxScore = 0;

  for (const [tType, schema] of Object.entries(CANONICAL_SCHEMAS)) {
    if (tType === 'unknown') continue;
    let matches = 0;
    const fields = Object.keys(schema);

    for (const [, synonyms] of Object.entries(schema)) {
      const match = normHeaders.some((h) => synonyms.some((syn) => syn.replace(/[^a-z0-9]/g, '') === h || h.includes(syn)));
      if (match) matches++;
    }

    const score = matches / fields.length;
    if (score > maxScore) {
      maxScore = score;
      bestType = tType as TableType;
    }
  }

  return {
    tableType: bestType,
    confidence: Math.min(1, maxScore * 1.4), // Scale confidence up slightly
  };
}

// ─── Heuristic Schema Mapping ─────────────────────────────────────────────────

/**
 * Performs fast heuristic matching between raw headers and target canonical fields.
 */
export function mapTableHeuristic(headers: string[], targetType: TableType): TableMappingResult {
  const schema = CANONICAL_SCHEMAS[targetType] ?? {};
  const canonicalFields = Object.keys(schema);
  const normHeaders = headers.map((h) => ({ raw: h, norm: h.toLowerCase().replace(/[^a-z0-9]/g, '') }));

  const usedHeaders = new Set<string>();
  const fieldMappings: FieldMapping[] = [];

  for (const field of canonicalFields) {
    const synonyms = schema[field];
    let matchedHeader: string | null = null;
    let confidence = 0;

    // 1. Exact match
    const exact = normHeaders.find((h) => !usedHeaders.has(h.raw) && (h.norm === field || synonyms.includes(h.norm)));
    if (exact) {
      matchedHeader = exact.raw;
      confidence = 1.0;
      usedHeaders.add(exact.raw);
    } else {
      // 2. Fuzzy inclusion match
      const fuzzy = normHeaders.find((h) => !usedHeaders.has(h.raw) && synonyms.some((syn) => h.norm.includes(syn) || syn.includes(h.norm)));
      if (fuzzy) {
        matchedHeader = fuzzy.raw;
        confidence = 0.8;
        usedHeaders.add(fuzzy.raw);
      }
    }

    fieldMappings.push({
      canonicalField: field,
      sourceHeader: matchedHeader,
      confidence,
    });
  }

  const mappedCount = fieldMappings.filter((m) => m.sourceHeader !== null).length;
  const overallConfidence = canonicalFields.length > 0 ? mappedCount / canonicalFields.length : 0;

  return {
    tableName: targetType,
    detectedTableType: targetType,
    confidence: overallConfidence,
    fieldMappings,
  };
}

// ─── Transform & Normalise Data Rows ──────────────────────────────────────────

/**
 * Transforms raw data rows into canonical records based on field mappings.
 * Fills in smart default values for any missing or unmapped required fields.
 */
export function transformRowsToCanonical<T extends Record<string, unknown>>(
  data: Record<string, unknown>[],
  tableType: TableType,
  mappings: FieldMapping[],
): T[] {
  const num = (v: unknown): number => {
    if (typeof v === 'number') return isNaN(v) ? 0 : v;
    if (typeof v === 'string') {
      const p = parseFloat(v.replace(/[^0-9.-]/g, ''));
      return isNaN(p) ? 0 : p;
    }
    return 0;
  };

  return data.map((row, idx) => {
    const canonical: Record<string, unknown> = {};

    // Extract raw numeric rates if available in row
    const rawQty = num(row['available_stock_qty'] ?? row['quantity'] ?? row['qty'] ?? row['units'] ?? row['units_sold']);
    const rawUnitPrice = num(row['selling_price_inr'] ?? row['unit_price'] ?? row['price'] ?? row['rate'] ?? row['mrp'] ?? row['retail_price'] ?? row['unit_price_inr']);
    const rawUnitCost = num(row['cost_per_unit'] ?? row['unit_cost'] ?? row['cost_price'] ?? row['cogs'] ?? row['cost'] ?? row['buy_rate']);

    for (const mapItem of mappings) {
      const field = mapItem.canonicalField;
      const srcHeader = mapItem.sourceHeader;
      let val = srcHeader ? row[srcHeader] : undefined;

      // Smart Defaults & Calculated Derivations for missing or unmapped values
      if (val === undefined || val === null || val === '') {
        if (field === 'sku') {
          const rawSku = row['prod_id'] ?? row['product_id'] ?? row['item_code'] ?? row['sku'];
          val = rawSku ? String(rawSku) : `SKU-${String(idx + 1).padStart(4, '0')}`;
        } else if (field === 'name') {
          const rawName = row['item_desc'] ?? row['product_name'] ?? row['item_name'] ?? row['title'] ?? row['name'];
          val = rawName ? String(rawName) : `Item ${idx + 1}`;
        } else if (field === 'category') {
          const rawCat = row['dept_group'] ?? row['category'] ?? row['department'] ?? row['group'];
          val = rawCat ? String(rawCat) : 'General';
        } else if (field === 'date') {
          const rawDate = row['txn_date'] ?? row['transaction_date'] ?? row['sale_date'] ?? row['date'];
          val = rawDate ? String(rawDate) : new Date().toISOString().split('T')[0];
        } else if (field === 'quantity' || field === 'units' || field === 'units_sold') {
          val = rawQty > 0 ? rawQty : 1;
        } else if (field === 'price') {
          val = rawUnitPrice > 0 ? rawUnitPrice : 100;
        } else if (field === 'discount') val = 0;
        else if (field === 'payment_method') val = 'UPI';
        else if (field === 'store_city') val = 'Mumbai';
        else if (field === 'subcategory') val = 'Standard';
        else if (field === 'brand') val = 'Generic';
        else if (field === 'supplier') val = 'Main Supplier';
        else if (field === 'shelf_life_days') val = 180;
        else if (field === 'weight_kg') val = 1.0;
        else if (field === 'launch_date') val = '2024-01-01';
        else if (field === 'beginning_stock') val = rawQty > 0 ? rawQty + 10 : 50;
        else if (field === 'reorder_point') val = 10;
        else if (field === 'supplier_lead_time') val = 3;
        else if (field === 'description') val = 'General Investment';
        else if (field === 'expected_roi') val = 15;
      }

      // Dynamic calculation of total revenue & cost from unit prices & quantities
      if (field === 'revenue' || field === 'amount') {
        const nVal = num(val);
        if (nVal > 0 && (nVal === rawUnitPrice || srcHeader?.toLowerCase().includes('price') || srcHeader?.toLowerCase().includes('rate') || srcHeader?.toLowerCase().includes('inr'))) {
          val = nVal * (rawQty > 0 ? rawQty : 1);
        } else if (val === undefined || val === null || val === '' || nVal === 0) {
          val = rawUnitPrice > 0 && rawQty > 0 ? rawUnitPrice * rawQty : rawUnitPrice > 0 ? rawUnitPrice * 5 : 100;
        }
      }

      if (field === 'cost') {
        const nVal = num(val);
        if (nVal > 0 && (nVal === rawUnitCost || srcHeader?.toLowerCase().includes('unit') || srcHeader?.toLowerCase().includes('per'))) {
          val = nVal * (rawQty > 0 ? rawQty : 1);
        } else if (val === undefined || val === null || val === '' || nVal === 0) {
          if (rawUnitCost > 0 && rawQty > 0) val = rawUnitCost * rawQty;
          else if (rawUnitCost > 0) val = rawUnitCost * 5;
          else if (canonical.revenue && num(canonical.revenue) > 0) val = Math.round(num(canonical.revenue) * 0.65);
          else val = 60;
        }
      }

      // Type coercions
      if (typeof val === 'string' && ['quantity', 'revenue', 'price', 'cost', 'discount', 'amount', 'shelf_life_days', 'weight_kg', 'beginning_stock', 'units_sold', 'reorder_point', 'supplier_lead_time', 'expected_roi'].includes(field)) {
        val = num(val);
      }

      canonical[field] = val;
    }

    return canonical as T;
  });
}
