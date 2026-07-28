/**
 * @file document-extractor.test.ts
 * @description Stress-testing unit test suite for multi-format document extraction and edge cases.
 */

import { describe, it, expect } from 'vitest';
import { parseDocument } from './document-extractor';
import { mapTableHeuristic, detectTableType, transformRowsToCanonical } from '@/services/llm/schema-mapper';

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
});
