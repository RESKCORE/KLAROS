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
    sku: [
      'sku', 'product_id', 'item_code', 'code', 'id', 'product_code', 'item_id', 'sku_id', 'product_sku',
      'prod_id', 'prodcode', 'stockcode', 'stock_code', 'item_identifier', 'ticker', 'symbol', 'isin',
      'account', 'account_code', 'account_no', 'voucherno', 'voucher_no', 'customer_id', 'subscriber_id',
    ],
    name: [
      'name', 'product_name', 'title', 'item_name', 'product', 'item_title', 'description', 'prod_name',
      'itemdesc', 'item_desc', 'prod_desc', 'product_desc', 'itemdescription', 'item_type', 'particulars',
      'narration', 'memo', 'account_name', 'plan', 'tier', 'subscription_tier', 'sector',
    ],
    date: [
      'date', 'transaction_date', 'sale_date', 'time', 'created_at', 'dt', 'order_date', 'timestamp',
      'txn_date', 'txn_time', 'invoicedate', 'invoice_date', 'billing_date', 'snapshot_date', 'as_of_date',
    ],
    quantity: [
      'quantity', 'qty', 'units', 'units_sold', 'count', 'volume', 'vol', 'shares', 'quantity_sold',
      'number_sold', 'items_sold', 'in_stock_qty', 'on_hand', 'seats', 'licenses',
    ],
    revenue: [
      'revenue', 'total_sales', 'amount', 'sales', 'total_amount', 'price_total', 'turnover', 'total_price',
      'selling_price', 'sale_amount', 'gross_sales', 'selling_price_inr', 'total', 'item_outlet_sales',
      'price', 'unitprice', 'unit_price', 'rate', 'mrp', 'item_mrp', 'close', 'adj_close', 'debit',
      'credit', 'mrr', 'arr', 'fee', 'charge', 'valuation',
    ],
    price: [
      'price', 'unitprice', 'unit_price', 'rate', 'selling_price', 'selling_price_inr', 'mrp', 'item_mrp',
      'open', 'high', 'low', 'close', 'last_price', 'unit_cost',
    ],
    cost: [
      'cost', 'cost_price', 'unit_cost', 'cogs', 'cost_per_unit', 'buying_price', 'purchase_cost',
      'expense', 'outflow', 'debit',
    ],
    discount: ['discount', 'discount_amount', 'disc', 'rebate', 'markdown', 'savings', 'promo_discount'],
    payment_method: [
      'payment_method', 'payment_type', 'pay_mode', 'payment', 'mode', 'channel', 'pay_type',
      'invoice', 'invoiceno', 'invoice_no', 'transaction_type', 'voucher_type', 'status', 'billing_cycle',
    ],
    store_city: [
      'store_city', 'city', 'location', 'branch', 'store', 'region', 'place', 'city_name',
      'branch_location', 'country', 'outlet_identifier', 'outlet_type', 'warehouse', 'exchange',
    ],
  },
  products: {
    sku: [
      'sku', 'product_id', 'item_code', 'code', 'id', 'product_code', 'item_id', 'prod_id', 'prodcode',
      'stockcode', 'stock_code', 'item_identifier', 'ticker', 'symbol', 'account_code',
    ],
    name: [
      'name', 'product_name', 'title', 'item_name', 'product', 'item_title', 'description', 'prod_name',
      'itemdesc', 'item_desc', 'prod_desc', 'product_desc', 'itemdescription', 'particulars', 'plan',
    ],
    category: [
      'category', 'dept', 'department', 'group', 'type', 'cat', 'class', 'category_name', 'dept_group',
      'item_type', 'sector', 'industry', 'account_type', 'tier',
    ],
    subcategory: ['subcategory', 'sub_category', 'sub_dept', 'subcat', 'family', 'item_fat_content'],
    brand: ['brand', 'make', 'manufacturer', 'vendor', 'company', 'label', 'exchange'],
    price: [
      'price', 'selling_price', 'unit_price', 'mrp', 'retail_price', 'list_price', 'rate', 'sell_price',
      'selling_price_inr', 'unit_price_inr', 'item_mrp', 'close', 'last_price',
    ],
    cost: ['cost', 'cost_price', 'unit_cost', 'purchase_price', 'cogs', 'buying_price', 'buy_rate', 'cost_per_unit'],
    supplier: ['supplier', 'vendor', 'distributor', 'supplier_name', 'source', 'issuer'],
    shelf_life_days: ['shelf_life_days', 'shelf_life', 'expiry_days', 'exp_days', 'life_span', 'outlet_establishment_year'],
    weight_kg: ['weight_kg', 'weight', 'unit_weight', 'net_weight', 'size_kg', 'item_weight'],
    launch_date: ['launch_date', 'created_date', 'added_date', 'release_date', 'ipo_date', 'start_date'],
  },
  stock: {
    sku: ['sku', 'product_id', 'item_code', 'code', 'id', 'product_code', 'ticker', 'symbol', 'part_number'],
    date: ['date', 'stock_date', 'as_of_date', 'snapshot_date'],
    quantity: ['quantity', 'stock_quantity', 'current_stock', 'stock_level', 'available_stock', 'in_stock', 'on_hand', 'qty', 'units', 'shares'],
    beginning_stock: ['beginning_stock', 'start_stock', 'initial_stock', 'opening_stock'],
    units_sold: ['units_sold', 'qty_sold', 'sold_units', 'sales_units'],
    reorder_point: ['reorder_point', 'reorder_threshold', 'min_stock', 'alert_level', 'safety_stock', 'min_qty'],
    supplier_lead_time: ['supplier_lead_time', 'lead_time', 'delivery_days', 'lead_time_days', 'lead_days'],
  },
  investments: {
    date: ['date', 'investment_date', 'spent_date', 'created_at'],
    amount: ['amount', 'investment_amount', 'cost', 'spend', 'expenditure', 'budget', 'capital', 'debit', 'credit'],
    category: ['category', 'type', 'department', 'channel', 'asset_class'],
    description: ['description', 'details', 'purpose', 'name', 'memo', 'note', 'narration'],
    expected_roi: ['expected_roi', 'roi', 'return_pct', 'expected_return', 'roi_pct'],
  },
  unknown: {},
};

// ─── Intelligent Category Inference from Product Name ────────────────────────

import { normalizeDateToYMD } from '@/features/market/utils/date-utils';

export function inferCategoryFromName(name: string): string {
  const n = (name || '').toLowerCase();
  if (!n.trim()) return 'General Merchandise';

  // 1. Toys & Party (check early so party bunting, snap games, etc. don't get trapped by kitchen/bags)
  if (
    n.includes('bunting') ||
    n.includes('toy') ||
    n.includes('game') ||
    n.includes('doll') ||
    n.includes('puzzle') ||
    n.includes('balloon') ||
    n.includes('party') ||
    n.includes('child') ||
    n.includes('kids') ||
    n.includes('play') ||
    n.includes('teddy') ||
    /\bbear\b/i.test(n) ||
    n.includes('costume') ||
    n.includes('confetti') ||
    n.includes('streamer') ||
    n.includes('snap card') ||
    n.includes('playing card')
  ) {
    return 'Toys & Party';
  }

  // 2. Garden & Outdoor (e.g. ceramic garden planter should be Garden, not Kitchen)
  if (
    n.includes('garden') ||
    n.includes('plant') ||
    n.includes('planter') ||
    n.includes('flower') ||
    n.includes('outdoor') ||
    n.includes('seed') ||
    n.includes('watering') ||
    n.includes('feeder') ||
    n.includes('shed') ||
    n.includes('lawn') ||
    n.includes('patio')
  ) {
    return 'Garden & Outdoor';
  }

  // 3. Home & Decor
  if (
    n.includes('heart') ||
    n.includes('light') ||
    n.includes('t-light') ||
    n.includes('tealight') ||
    n.includes('candle') ||
    n.includes('holder') ||
    n.includes('frame') ||
    n.includes('cushion') ||
    n.includes('clock') ||
    n.includes('home') ||
    n.includes('doormat') ||
    /\bmat\b/i.test(n) ||
    n.includes('decor') ||
    n.includes('lantern') ||
    n.includes('garland') ||
    n.includes('wicker') ||
    n.includes('hanging') ||
    n.includes('plaque') ||
    /\bsigns?\b/i.test(n) ||
    n.includes('wall sign') ||
    n.includes('metal sign') ||
    n.includes('door sign') ||
    n.includes('vase') ||
    n.includes('drawer') ||
    n.includes('furniture') ||
    n.includes('shelf') ||
    n.includes('cabinet') ||
    /\brugs?\b/i.test(n) ||
    n.includes('mirror') ||
    n.includes('candelabra') ||
    n.includes('chalkboard') ||
    n.includes('blackboard') ||
    n.includes('hook') ||
    n.includes('hanger') ||
    n.includes('knob') ||
    n.includes('christmas') ||
    n.includes('xmas') ||
    n.includes('festive') ||
    n.includes('easter')
  ) {
    return 'Home & Decor';
  }

  // 4. Kitchen & Dining
  if (
    n.includes('tea') ||
    n.includes('coffee') ||
    n.includes('mug') ||
    /\bcups?\b/i.test(n) ||
    n.includes('bowl') ||
    n.includes('plate') ||
    n.includes('kitchen') ||
    n.includes('baking') ||
    n.includes('cake') ||
    /\btins?\b/i.test(n) ||
    n.includes('spoon') ||
    n.includes('fork') ||
    n.includes('cutlery') ||
    n.includes('glass') ||
    n.includes('bottle') ||
    n.includes('ceramic') ||
    n.includes('dish') ||
    n.includes('toaster') ||
    /\bpots?\b/i.test(n) ||
    /\bpans?\b/i.test(n) ||
    n.includes('saucepan') ||
    n.includes('frying pan') ||
    n.includes('teapot') ||
    n.includes('jug') ||
    n.includes('coaster') ||
    n.includes('tray') ||
    n.includes('cakestand') ||
    n.includes('bakeware') ||
    n.includes('cookware') ||
    n.includes('dining') ||
    n.includes('pitcher') ||
    n.includes('jar') ||
    n.includes('napkin') ||
    n.includes('placemat') ||
    n.includes('cake case')
  ) {
    return 'Kitchen & Dining';
  }

  // 5. Gifts & Bags
  if (
    n.includes('bag') ||
    n.includes('pouch') ||
    n.includes('purse') ||
    n.includes('wallet') ||
    n.includes('tote') ||
    n.includes('gift') ||
    n.includes('wrap') ||
    n.includes('ribbon') ||
    /\btags?\b/i.test(n) ||
    n.includes('box') ||
    n.includes('card') ||
    n.includes('ornament') ||
    n.includes('charm') ||
    n.includes('trinket') ||
    n.includes('novelty') ||
    n.includes('badge') ||
    n.includes('keyring') ||
    n.includes('keychain') ||
    n.includes('souvenir') ||
    n.includes('suki') ||
    n.includes('storage')
  ) {
    return 'Gifts & Bags';
  }

  // 6. Stationery & Craft
  if (
    n.includes('pen') ||
    n.includes('pencil') ||
    n.includes('notebook') ||
    n.includes('paper') ||
    n.includes('sticker') ||
    n.includes('tape') ||
    n.includes('craft') ||
    n.includes('book') ||
    n.includes('stationery') ||
    n.includes('rubber') ||
    n.includes('scissor') ||
    n.includes('folder') ||
    n.includes('envelope') ||
    n.includes('stamp') ||
    n.includes('ruler') ||
    n.includes('chalk') ||
    n.includes('paint') ||
    n.includes('canvas')
  ) {
    return 'Stationery & Craft';
  }

  // 7. Bath & Beauty
  if (
    n.includes('soap') ||
    n.includes('bath') ||
    n.includes('towel') ||
    n.includes('wash') ||
    n.includes('lotion') ||
    n.includes('cream') ||
    n.includes('hygiene') ||
    n.includes('beauty') ||
    n.includes('perfume') ||
    n.includes('shampoo') ||
    n.includes('spa') ||
    n.includes('lip') ||
    n.includes('cosmetic') ||
    n.includes('sponge')
  ) {
    return 'Bath & Beauty';
  }

  // 8. Apparel & Accessories
  if (
    n.includes('shirt') ||
    n.includes('t-shirt') ||
    n.includes('sock') ||
    n.includes('glove') ||
    n.includes('scarf') ||
    n.includes('hat') ||
    n.includes('cap') ||
    n.includes('apron') ||
    n.includes('dress') ||
    n.includes('jacket') ||
    n.includes('umbrella') ||
    n.includes('slippers') ||
    n.includes('apparel') ||
    n.includes('wear') ||
    n.includes('shoe') ||
    n.includes('boot') ||
    n.includes('warmer')
  ) {
    return 'Apparel & Accessories';
  }

  // 9. Snacks & Food
  if (
    n.includes('chocolate') ||
    n.includes('sweet') ||
    n.includes('candy') ||
    n.includes('biscuit') ||
    n.includes('cookie') ||
    n.includes('snack') ||
    n.includes('crisp') ||
    n.includes('chips') ||
    n.includes('food') ||
    n.includes('fruit') ||
    n.includes('vegetable') ||
    n.includes('honey') ||
    n.includes('jam') ||
    n.includes('sauce') ||
    n.includes('spice')
  ) {
    return 'Snacks & Food';
  }

  // 10. Beverages
  if (
    n.includes('juice') ||
    n.includes('drink') ||
    n.includes('water') ||
    n.includes('cola') ||
    n.includes('pepsi') ||
    n.includes('beverage') ||
    n.includes('milk') ||
    n.includes('soda') ||
    n.includes('syrup')
  ) {
    return 'Beverages';
  }

  return 'General Merchandise';
}

// ─── Table Type Auto-Detection ────────────────────────────────────────────────

/**
 * Automatically infers whether a table is sales, products, stock, or investments
 * based on header similarity with canonical dictionaries.
 */
export function detectTableType(headers: string[]): { tableType: TableType; confidence: number } {
  const normHeaders = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

  // Strong explicit heuristics for Retail Sales Transactions
  const isInvoiceTable = normHeaders.some((h) => h.includes('invoice') || h.includes('invoiceno') || h.includes('invoicedate'));
  const hasPriceAndQty = normHeaders.some((h) => h.includes('price') || h.includes('rate') || h.includes('mrp') || h.includes('amount')) &&
                         normHeaders.some((h) => h.includes('quantity') || h.includes('qty') || h.includes('units'));

  if (isInvoiceTable && hasPriceAndQty) {
    return { tableType: 'sales', confidence: 0.95 };
  }

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
    confidence: Math.min(1, Math.max(0.4, maxScore * 1.5)),
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
    const synonyms = schema[field] ?? [];
    let matchedHeader: string | null = null;
    let confidence = 0;

    // 1. Exact match
    const exact = normHeaders.find((h) => !usedHeaders.has(h.raw) && synonyms.some((syn) => syn.replace(/[^a-z0-9]/g, '') === h.norm));
    if (exact) {
      matchedHeader = exact.raw;
      confidence = 1.0;
      usedHeaders.add(exact.raw);
    } else {
      // 2. Partial / Fuzzy inclusion match
      const fuzzy = normHeaders.find((h) => !usedHeaders.has(h.raw) && synonyms.some((syn) => h.norm.includes(syn.replace(/[^a-z0-9]/g, ''))));
      if (fuzzy) {
        matchedHeader = fuzzy.raw;
        confidence = 0.85;
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

    // Extract raw numeric rates if available in row (preserve sign for retail cancellations/returns)
    const rawQtyVal = row['available_stock_qty'] ?? row['quantity'] ?? row['qty'] ?? row['units'] ?? row['units_sold'] ?? row['Quantity'];
    const rawQty = rawQtyVal !== undefined ? num(rawQtyVal) : 1;
    const rawUnitPrice = Math.abs(num(row['selling_price_inr'] ?? row['unit_price'] ?? row['price'] ?? row['rate'] ?? row['mrp'] ?? row['retail_price'] ?? row['unit_price_inr'] ?? row['Price'] ?? row['UnitPrice']));
    const rawUnitCost = Math.abs(num(row['cost_per_unit'] ?? row['unit_cost'] ?? row['cost_price'] ?? row['cogs'] ?? row['cost'] ?? row['buy_rate']));

    for (const mapItem of mappings) {
      const field = mapItem.canonicalField;
      const srcHeader = mapItem.sourceHeader;
      let val = srcHeader ? row[srcHeader] : undefined;

      // Smart Defaults & Calculated Derivations for missing or unmapped values
      if (val === undefined || val === null || val === '') {
        if (field === 'sku') {
          const rawSku = row['prod_id'] ?? row['product_id'] ?? row['item_code'] ?? row['sku'] ?? row['StockCode'] ?? row['stockcode'] ?? row['Item_Identifier'];
          val = rawSku ? String(rawSku) : `SKU-${String(idx + 1).padStart(4, '0')}`;
        } else if (field === 'name') {
          const rawName = row['item_desc'] ?? row['product_name'] ?? row['item_name'] ?? row['title'] ?? row['name'] ?? row['Description'] ?? row['description'] ?? row['Item_Type'];
          val = rawName ? String(rawName) : `Item ${idx + 1}`;
        } else if (field === 'category') {
          const rawCat = row['dept_group'] ?? row['category'] ?? row['department'] ?? row['group'] ?? row['Item_Type'];
          const rawName = String(row['Description'] ?? row['description'] ?? row['item_desc'] ?? row['name'] ?? '');
          val = rawCat ? String(rawCat) : inferCategoryFromName(rawName);
        } else if (field === 'date') {
          const rawDate = row['txn_date'] ?? row['transaction_date'] ?? row['sale_date'] ?? row['date'] ?? row['InvoiceDate'] ?? row['invoicedate'];
          val = rawDate ? normalizeDateToYMD(rawDate) : new Date().toISOString().split('T')[0];
        } else if (field === 'quantity' || field === 'units' || field === 'units_sold') {
          val = rawQty;
        } else if (field === 'price') {
          val = rawUnitPrice > 0 ? rawUnitPrice : 100;
        } else if (field === 'discount') val = 0;
        else if (field === 'payment_method') val = 'Card / Electronic';
        else if (field === 'store_city') val = String(row['Country'] ?? row['country'] ?? 'Main Store');
        else if (field === 'subcategory') val = 'Standard';
        else if (field === 'brand') val = 'Generic';
        else if (field === 'supplier') val = 'Main Supplier';
        else if (field === 'shelf_life_days') val = 180;
        else if (field === 'weight_kg') val = 1.0;
        else if (field === 'launch_date') val = '2024-01-01';
        else if (field === 'beginning_stock') val = Math.abs(rawQty) + 15;
        else if (field === 'reorder_point') val = 10;
        else if (field === 'supplier_lead_time') val = 3;
        else if (field === 'description') val = 'General Investment';
        else if (field === 'expected_roi') val = 15;
      }

      // If category is "General", try to infer a specific retail category from the item name
      if (field === 'category' && (val === 'General' || val === '' || !val)) {
        const itemName = String(canonical.name || row['Description'] || row['description'] || '');
        val = inferCategoryFromName(itemName);
      }

      // Dynamic calculation of total revenue & cost from unit prices & quantities
      if (field === 'revenue' || field === 'amount') {
        const nVal = num(val);
        if (nVal !== 0 && (nVal === rawUnitPrice || srcHeader?.toLowerCase().includes('price') || srcHeader?.toLowerCase().includes('rate') || srcHeader?.toLowerCase().includes('unit'))) {
          val = nVal * rawQty;
        } else if (val === undefined || val === null || val === '' || nVal === 0) {
          val = rawUnitPrice > 0 ? rawUnitPrice * rawQty : 0;
        }
      }

      if (field === 'cost') {
        const nVal = num(val);
        if (nVal !== 0 && (nVal === rawUnitCost || srcHeader?.toLowerCase().includes('unit') || srcHeader?.toLowerCase().includes('cost'))) {
          val = nVal * rawQty;
        } else if (val === undefined || val === null || val === '' || nVal === 0) {
          // If no raw unit cost exists in file, do NOT fabricate cost here so isCostEstimated remains true
          if (rawUnitCost > 0) val = rawUnitCost * rawQty;
          else val = 0;
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
