/**
 * @file document-extractor.test.ts
 * @description Stress-testing unit test suite for multi-format document extraction and edge cases.
 */

import { describe, it, expect } from 'vitest';
import { parseDocument } from './document-extractor';
import { mapTableHeuristic, detectTableType, transformRowsToCanonical, inferCategoryFromName } from '@/services/llm/schema-mapper';
import { buildMetrics } from './market-metrics-core';
import { detectCurrencyFromSales, getCurrencyFormatter } from './currency-utils';
import { generateAiNarrative, generateAiInsightsFromMetrics } from '@/services/llm/domain/insights';

describe('Universal Document Extractor & Schema Mapper Stress Tests', () => {
  // ── Iteration 1: Messy & Non-Standard Headers ────────────────────────────
  it('Iteration 1: Handles messy real-world header synonyms', () => {
    const messyHeaders = ['Prod_ID', 'Item Desc', 'Dept_Group', 'Selling_Price_INR', 'Cost_Per_Unit', 'Available_Stock_Qty'];
    const { tableType } = detectTableType(messyHeaders);
    expect(['sales', 'products']).toContain(tableType);

    const mapped = mapTableHeuristic(messyHeaders, 'products');
    
    // Check key mappings
    const skuMap = mapped.fieldMappings.find((f) => f.canonicalField === 'sku');
    const nameMap = mapped.fieldMappings.find((f) => f.canonicalField === 'name');
    const priceMap = mapped.fieldMappings.find((f) => f.canonicalField === 'price');
    const costMap = mapped.fieldMappings.find((f) => f.canonicalField === 'cost');

    expect(skuMap?.sourceHeader).toBe('Prod_ID');
    expect(nameMap?.sourceHeader).toBe('Item Desc');
    expect(priceMap?.sourceHeader).toBe('Selling_Price_INR');
    expect(costMap?.sourceHeader).toBe('Cost_Per_Unit');
  });

  // ── Iteration 2: Missing Required Columns (Auto-Healing & Math Derivation) ─────
  it('Iteration 2: Calculates revenue and cost dynamically from unit rates and quantities', () => {
    const incompleteHeaders = ['prod_id', 'item_desc', 'selling_price_inr', 'cost_per_unit', 'available_stock_qty'];
    const mapped = mapTableHeuristic(incompleteHeaders, 'sales');

    const rawRows = [{ prod_id: 'SKU-1001', item_desc: 'Milk', selling_price_inr: 65, cost_per_unit: 45, available_stock_qty: 10 }];
    const transformed = transformRowsToCanonical<Record<string, unknown>>(rawRows, 'sales', mapped.fieldMappings);

    // Revenue should be calculated as 65 * 10 = 650
    expect(transformed[0].revenue).toBe(650);
    // Cost should be calculated as 45 * 10 = 450
    expect(transformed[0].cost).toBe(450);
    expect(transformed[0].sku).toBe('SKU-1001');
  });

  // ── Iteration 3: Multi-Format Parsing (CSV, JSON, XML, Text) ──────────────
  it('Iteration 3: Parses structured JSON array format', async () => {
    const jsonContent = JSON.stringify([
      { sku: 'PROD-101', name: 'Almond Milk', price: 180, cost: 120 },
      { sku: 'PROD-102', name: 'Oat Crunch', price: 90, cost: 50 },
    ]);
    const file = new File([jsonContent], 'catalogue.json', { type: 'application/json' });

    const result = await parseDocument(file);
    expect(result.fileType).toBe('json');
    expect(result.sheets.length).toBe(1);
    expect(result.sheets[0].data.length).toBe(2);
    expect(result.sheets[0].headers).toContain('sku');
    expect(result.sheets[0].headers).toContain('name');
  });

  it('Iteration 3b: Parses XML element format', async () => {
    const xmlContent = `
      <inventory>
        <item code="SKU-88" stock="120" min_alert="15" />
        <item code="SKU-89" stock="45" min_alert="10" />
      </inventory>
    `;
    const file = new File([xmlContent], 'inventory.xml', { type: 'text/xml' });

    const result = await parseDocument(file);
    expect(result.fileType).toBe('xml');
    expect(result.sheets.length).toBe(1);
    expect(result.sheets[0].data.length).toBe(2);
  });

  it('Iteration 3c: Parses Tab-delimited text/PDF table format', async () => {
    const txtContent = `Product_ID\tItem_Name\tUnit_Price\tStock_Qty\nSKU-999\tGreen Tea\t150\t40\n`;
    const file = new File([txtContent], 'report.txt', { type: 'text/plain' });

    const result = await parseDocument(file);
    expect(result.fileType).toBe('txt');
    expect(result.sheets[0].headers).toContain('Product_ID');
    expect(result.sheets[0].data.length).toBe(1);
  });

  // ── Iteration 4: Edge Case & Graceful Degradation on Bad Files ─────────────
  it('Iteration 4: Handles empty or corrupted files gracefully', async () => {
    const emptyFile = new File([''], 'empty.csv', { type: 'text/csv' });
    const result = await parseDocument(emptyFile);

    expect(result.sheets[0].data.length).toBe(0);

    // Transforming 0 rows returns empty array without throwing error
    const mapped = mapTableHeuristic([], 'sales');
    const transformed = transformRowsToCanonical([], 'sales', mapped.fieldMappings);
    expect(transformed.length).toBe(0);
  });

  // ── Iteration 5: Unescaped Quotes in CSV Does NOT Swallow Subsequent Rows ──
  it('Iteration 5: Unescaped internal quotes (e.g. 4" CAKESTAND) do not truncate subsequent rows', async () => {
    const rawCsv = [
      'Invoice,StockCode,Description,Quantity,InvoiceDate,Price',
      '489434,85048,"15CM CHRISTMAS BALL",12,2009-12-01,6.95',
      '491725,22423,REGENCY 4" CAKESTAND 3 TIER,1,2009-12-11,12.75',
      '491726,22086,MUG RETROSPOT,6,2009-12-11,2.55',
      '491727,23084,RABBIT NIGHT LIGHT,4,2009-12-11,2.08',
    ].join('\n');

    const file = new File([rawCsv], 'online_retail_sample.csv', { type: 'text/csv' });
    const result = await parseDocument(file);

    expect(result.fileType).toBe('csv');
    // All 4 data rows must be parsed — row 3 must not swallow rows 4 & 5
    expect(result.sheets[0].data.length).toBe(4);
    expect(result.sheets[0].data[1]['StockCode']).toBe(22423);
    expect(result.sheets[0].data[2]['StockCode']).toBe(22086);
    expect(result.sheets[0].data[3]['StockCode']).toBe(23084);
  });

  // ── Iteration 6: Retail Category Inference Granularity ─────────────────────
  it('Iteration 6: Accurately infers distinct retail categories from product titles without defaulting to single bucket', () => {
    expect(inferCategoryFromName('REGENCY CAKESTAND 3 TIER')).toBe('Kitchen & Dining');
    expect(inferCategoryFromName('SET/5 RED RETROSPOT SPOTTY TEA SPOONS')).toBe('Kitchen & Dining');
    expect(inferCategoryFromName('JUMBO BAG RED RETROSPOT')).toBe('Gifts & Bags');
    expect(inferCategoryFromName('ASSORTED COLOUR BIRD ORNAMENT')).toBe('Gifts & Bags');
    expect(inferCategoryFromName('WHITE HANGING HEART T-LIGHT HOLDER')).toBe('Home & Decor');
    expect(inferCategoryFromName('DOORMAT WELCOME TO OUR HOME')).toBe('Home & Decor');
    expect(inferCategoryFromName('PEN SET WITH NOTEBOOK')).toBe('Stationery & Craft');
    expect(inferCategoryFromName('PLUSH TEDDY BEAR TOY')).toBe('Toys & Party');
    expect(inferCategoryFromName('AROMATHERAPY SOAP & LOTION')).toBe('Bath & Beauty');
    expect(inferCategoryFromName('KNITTED WINTER SCARF')).toBe('Apparel & Accessories');
    expect(inferCategoryFromName('CERAMIC GARDEN PLANTER POT')).toBe('Garden & Outdoor');
    expect(inferCategoryFromName('UNKNOWN ITEM XYZ123')).toBe('General Merchandise');
  });

  // ── Iteration 7: Explicit Cost and Margin Estimation Flags ─────────────────
  it('Iteration 7: Accurately flags isCostEstimated and isCategoryInferred when columns are missing', () => {
    // Dataset with NO cost column and inferred categories
    const unmeasuredDataset = {
      sales: [
        { sku: '22423', date: '2009-12-01', quantity: 10, revenue: 1000, discount: 0, payment_method: 'Card', store_city: 'UK' },
      ],
      products: [
        { sku: '22423', name: 'REGENCY CAKESTAND 3 TIER', category: 'General', subcategory: 'Standard', brand: 'Generic', price: 100, cost: 0, supplier: 'Main', shelf_life_days: 180, weight_kg: 1, launch_date: '2009-12-01' },
      ],
      stock: [],
      investments: [],
    };

    const metrics = buildMetrics(unmeasuredDataset);
    expect(metrics.kpis.isCostEstimated).toBe(true);
    expect(metrics.kpis.costDataType).toBe('estimated');
    expect(metrics.kpis.profitMarginPct).toBe(35.0); // 1000 rev - 650 COGS = 350 profit (35%)
    expect(metrics.kpis.grossMarginPct).toBe(35.0);
    expect(metrics.kpis.avgMarginPct).toBe(35.0); // Benchmark consistent across all margin KPI fields
    expect(metrics.kpis.isCategoryInferred).toBe(true);
  });

  // ── Iteration 8: Currency Auto-Detection & Formatting ───────────────────────
  it('Iteration 8: Correctly detects GBP vs INR currency from sales locations', () => {
    const ukSales = [
      { sku: '22423', date: '2010-01-01', quantity: 5, revenue: 50, discount: 0, payment_method: 'Card', store_city: 'United Kingdom' },
    ];
    const { currency: ukCurr, symbol: ukSym } = detectCurrencyFromSales(ukSales);
    expect(ukCurr).toBe('GBP');
    expect(ukSym).toBe('£');

    const inrSales = [
      { sku: 'SKU1', date: '2024-01-01', quantity: 2, revenue: 1200, discount: 0, payment_method: 'UPI', store_city: 'Mumbai, India' },
    ];
    const { currency: inrCurr, symbol: inrSym } = detectCurrencyFromSales(inrSales);
    expect(inrCurr).toBe('INR');
    expect(inrSym).toBe('₹');

    const ukFormatter = getCurrencyFormatter(ukCurr);
    expect(ukFormatter.format(1000)).toContain('£');
    expect(ukFormatter.format(1000)).not.toContain('₹');
  });

  // ── Iteration 9: Top Products Rank Order Derived from Post-Filtered List ────
  it('Iteration 9: Top Products rank order is assigned post-filter without skipping #1-#5', () => {
    const mixedDataset = {
      sales: [
        // Fee and postage codes with large revenues that must be excluded from product ranks
        { sku: 'DOT', name: 'DOTCOM POSTAGE', date: '2010-01-01', quantity: 10, revenue: 200000, discount: 0, payment_method: 'Invoice', store_city: 'UK' },
        { sku: 'POST', name: 'POSTAGE', date: '2010-01-01', quantity: 5, revenue: 150000, discount: 0, payment_method: 'Invoice', store_city: 'UK' },
        { sku: 'AMAZONFEE', name: 'AMAZON FEE', date: '2010-01-01', quantity: -10, revenue: -50000, discount: 0, payment_method: 'Invoice', store_city: 'UK' },
        // Valid products
        { sku: '22423', name: 'REGENCY CAKESTAND 3 TIER', date: '2010-01-01', quantity: 200, revenue: 327814, discount: 0, payment_method: 'Card', store_city: 'United Kingdom' },
        { sku: '85123A', name: 'WHITE HANGING HEART T-LIGHT HOLDER', date: '2010-01-01', quantity: 500, revenue: 253720, discount: 0, payment_method: 'Card', store_city: 'United Kingdom' },
        { sku: '85099B', name: 'JUMBO BAG RED WHITE SPOTTY', date: '2010-01-01', quantity: 400, revenue: 181279, discount: 0, payment_method: 'Card', store_city: 'United Kingdom' },
        { sku: '47566', name: 'PARTY BUNTING', date: '2010-01-01', quantity: 150, revenue: 147948, discount: 0, payment_method: 'Card', store_city: 'United Kingdom' },
        { sku: '84879', name: 'ASSORTED COLOUR BIRD ORNAMENT', date: '2010-01-01', quantity: 300, revenue: 131414, discount: 0, payment_method: 'Card', store_city: 'United Kingdom' },
        { sku: '22086', name: 'PAPER CHAIN KIT', date: '2010-01-01', quantity: 100, revenue: 121662, discount: 0, payment_method: 'Card', store_city: 'United Kingdom' },
      ],
      products: [],
      stock: [],
      investments: [],
    };

    const metrics = buildMetrics(mixedDataset);

    // Fee codes DOT, POST, AMAZONFEE must NOT be in topProducts
    const skus = metrics.topProducts.map((p) => p.sku);
    expect(skus).not.toContain('DOT');
    expect(skus).not.toContain('POST');
    expect(skus).not.toContain('AMAZONFEE');

    // Rank #1 must be SKU 22423 with exact rank number 1
    expect(metrics.topProducts[0].sku).toBe('22423');
    expect(metrics.topProducts[0].rank).toBe(1);
    expect(metrics.topProducts[0].revenue).toBe(327814);

    // Ranks 1-5 must be sequential without gaps
    expect(metrics.topProducts[1].sku).toBe('85123A');
    expect(metrics.topProducts[1].rank).toBe(2);

    expect(metrics.topProducts[2].sku).toBe('85099B');
    expect(metrics.topProducts[2].rank).toBe(3);

    expect(metrics.topProducts[3].sku).toBe('47566');
    expect(metrics.topProducts[3].rank).toBe(4);

    expect(metrics.topProducts[4].sku).toBe('84879');
    expect(metrics.topProducts[4].rank).toBe(5);
  });

  // ── Iteration 10: Executive Insights Currency & Data-Grounded Narrative ─────
  it('Iteration 10: AI Executive Insights uses detected currency and provides data-grounded actions', async () => {
    const ukDataset = {
      sales: [
        { sku: '22423', name: 'REGENCY CAKESTAND 3 TIER', date: '2010-01-01', quantity: 200, revenue: 327814, discount: 0, payment_method: 'Card', store_city: 'United Kingdom' },
      ],
      products: [],
      stock: [],
      investments: [],
    };

    const metrics = buildMetrics(ukDataset);
    const narrative = await generateAiNarrative(metrics);
    const insights = await generateAiInsightsFromMetrics(metrics);

    // Narrative must mention the currency symbol £ and SKU 22423
    expect(narrative).toContain('£');
    expect(narrative).not.toContain('₹');
    expect(narrative).toContain('REGENCY CAKESTAND 3 TIER');

    // Insights executive summary and actions must not be generic placeholders
    expect(insights.executive_summary).toContain('£');
    expect(insights.executive_summary).not.toContain('₹');
    expect(insights.executive_summary).toContain('REGENCY CAKESTAND 3 TIER');
    expect(insights.opportunities.length).toBeGreaterThan(0);
    expect(insights.risk_alerts.length).toBeGreaterThan(0);
  });
});
