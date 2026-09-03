/**
 * @file dataset-classifier.test.ts
 * @description Unit test suite for universal domain detection and column role classification.
 */

import { describe, it, expect } from 'vitest';
import { classifyDatasetHeuristic, classifyDataset } from './dataset-classifier';

describe('Universal Dataset Domain Classifier', () => {
  // ── 1. Retail Transactions ────────────────────────────────────────────────
  it('correctly classifies retail sales transaction log with high confidence', async () => {
    const headers = ['Invoice', 'StockCode', 'Description', 'Quantity', 'InvoiceDate', 'Price', 'Customer ID', 'Country'];
    const sampleRows = [
      { Invoice: '489434', StockCode: '85048', Description: '15CM CHRISTMAS BALL', Quantity: 12, InvoiceDate: '2009-12-01', Price: 6.95, 'Customer ID': '13085', Country: 'United Kingdom' },
    ];

    const result = classifyDatasetHeuristic(headers, sampleRows);
    expect(result.domain).toBe('retail_transactions');
    expect(result.score).toBeGreaterThanOrEqual(0.85);
    expect(result.roles.idField).toBe('StockCode');
    expect(result.roles.valueField).toBe('Price');
    expect(result.roles.volumeField).toBe('Quantity');
    expect(result.roles.dateField).toBe('InvoiceDate');
  });

  // ── 2. Market Securities ──────────────────────────────────────────────────
  it('correctly classifies stock / equity OHLC price and volume series', async () => {
    const headers = ['Date', 'Ticker', 'Open', 'High', 'Low', 'Close', 'Adj Close', 'Volume'];
    const sampleRows = [
      { Date: '2024-01-02', Ticker: 'RELIANCE', Open: 2580.0, High: 2610.5, Low: 2575.0, Close: 2602.3, 'Adj Close': 2602.3, Volume: 4500000 },
    ];

    const result = classifyDatasetHeuristic(headers, sampleRows);
    expect(result.domain).toBe('market_securities');
    expect(result.score).toBeGreaterThanOrEqual(0.85);
    expect(result.roles.idField).toBe('Ticker');
    expect(result.roles.valueField).toBe('Close');
    expect(result.roles.volumeField).toBe('Volume');
    expect(result.roles.dateField).toBe('Date');
  });

  // ── 3. Inventory & Warehouse Stock ────────────────────────────────────────
  it('correctly classifies warehouse inventory snapshot without sales data', async () => {
    const headers = ['SKU', 'Item_Name', 'Warehouse_Location', 'On_Hand_Qty', 'Reorder_Point', 'Unit_Cost'];
    const sampleRows = [
      { SKU: 'SKU-001', Item_Name: 'Stainless Steel Bolt', Warehouse_Location: 'North Hub', On_Hand_Qty: 500, Reorder_Point: 100, Unit_Cost: 15.5 },
    ];

    const result = classifyDatasetHeuristic(headers, sampleRows);
    expect(result.domain).toBe('inventory_stock');
    expect(result.score).toBeGreaterThanOrEqual(0.85);
    expect(result.roles.idField).toBe('SKU');
    expect(result.roles.volumeField).toBe('On_Hand_Qty');
    expect(result.roles.categoryField).toBe('Warehouse_Location');
  });

  // ── 4. Financial Ledger ───────────────────────────────────────────────────
  it('correctly classifies double-entry accounting ledger entries', async () => {
    const headers = ['Txn_Date', 'Voucher_No', 'Account_Code', 'Particulars', 'Debit', 'Credit', 'Cost_Centre'];
    const sampleRows = [
      { Txn_Date: '2024-03-01', Voucher_No: 'JV-1002', Account_Code: 'ACC-5001', Particulars: 'Office Electricity Bill', Debit: 12500, Credit: 0, Cost_Centre: 'Admin' },
    ];

    const result = classifyDatasetHeuristic(headers, sampleRows);
    expect(result.domain).toBe('financial_ledger');
    expect(result.score).toBeGreaterThanOrEqual(0.85);
    expect(result.roles.valueField).toBe('Debit');
    expect(result.roles.secondaryValueField).toBe('Credit');
  });

  // ── 5. Subscription & SaaS ────────────────────────────────────────────────
  it('correctly classifies recurring subscription SaaS dataset', async () => {
    const headers = ['Customer_ID', 'Customer_Name', 'Subscription_Plan', 'MRR', 'ARR', 'Status', 'Renewal_Date', 'Seats'];
    const sampleRows = [
      { Customer_ID: 'CUST-88', Customer_Name: 'Acme Corp', Subscription_Plan: 'Enterprise Tier', MRR: 45000, ARR: 540000, Status: 'Active', Renewal_Date: '2025-01-15', Seats: 25 },
    ];

    const result = classifyDatasetHeuristic(headers, sampleRows);
    expect(result.domain).toBe('subscription_saas');
    expect(result.score).toBeGreaterThanOrEqual(0.85);
    expect(result.roles.valueField).toBe('MRR');
    expect(result.roles.categoryField).toBe('Subscription_Plan');
  });

  // ── 6. Generic Tabular Fallback ───────────────────────────────────────────
  it('gracefully classifies unconstrained arbitrary business dataset without throwing error', async () => {
    const headers = ['Region', 'Facility_Code', 'Inspection_Score', 'Employee_Count', 'Audit_Date'];
    const sampleRows = [
      { Region: 'South-West', Facility_Code: 'FAC-9', Inspection_Score: 88.5, Employee_Count: 140, Audit_Date: '2024-02-10' },
    ];

    const result = await classifyDataset(headers, sampleRows);
    expect(result.domain).toBe('generic_tabular');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    expect(result.detectedRoles.dateField).toBe('Audit_Date');
  });
});
