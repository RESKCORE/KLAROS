/**
 * @file MappingPreviewModal.tsx
 * @description Interactive UI Modal for previewing and customizing AI column mappings.
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, AlertTriangle, Sparkles, FileText, ArrowRight } from 'lucide-react';
import type { ExtractionResult } from '../utils/document-extractor';
import { detectTableType, mapTableHeuristic, transformRowsToCanonical, TableType, TableMappingResult } from '@/services/llm/schema-mapper';
import type { SalesRow, ProductRow, StockRow, InvestmentRow } from '../utils/market-metrics-core';

interface MappingPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  extractionResults: ExtractionResult[];
  onConfirm: (normalized: {
    sales: SalesRow[];
    products: ProductRow[];
    stock: StockRow[];
    investments: InvestmentRow[];
  }) => void;
}

export function MappingPreviewModal({ isOpen, onClose, extractionResults, onConfirm }: MappingPreviewModalProps) {
  const [tableMappings, setTableMappings] = useState<{
    key: string;
    sheetName: string;
    fileName: string;
    detectedType: TableType;
    headers: string[];
    data: Record<string, unknown>[];
    mapping: TableMappingResult;
  }[]>([]);

  const [activeTab, setActiveTab] = useState<string>('');

  useEffect(() => {
    if (!isOpen || extractionResults.length === 0) return;

    const prepared: typeof tableMappings = [];

    extractionResults.forEach((res, resIdx) => {
      res.sheets.forEach((sheet, sheetIdx) => {
        const key = `${resIdx}-${sheetIdx}`;
        const { tableType } = detectTableType(sheet.headers);
        const mappedType = tableType === 'unknown' ? (sheet.name.toLowerCase().includes('product') ? 'products' : sheet.name.toLowerCase().includes('stock') ? 'stock' : sheet.name.toLowerCase().includes('invest') ? 'investments' : 'sales') : tableType;

        const heuristicResult = mapTableHeuristic(sheet.headers, mappedType);

        prepared.push({
          key,
          sheetName: sheet.name,
          fileName: res.fileName,
          detectedType: mappedType,
          headers: sheet.headers,
          data: sheet.data,
          mapping: heuristicResult,
        });
      });
    });

    setTableMappings(prepared);
    if (prepared.length > 0) setActiveTab(prepared[0].key);
  }, [isOpen, extractionResults]);

  const handleFieldMapChange = (tableKey: string, canonicalField: string, newHeader: string) => {
    setTableMappings((prev) =>
      prev.map((item) => {
        if (item.key !== tableKey) return item;

        const updatedMappings = item.mapping.fieldMappings.map((fm) => {
          if (fm.canonicalField === canonicalField) {
            return {
              ...fm,
              sourceHeader: newHeader === '__NONE__' ? null : newHeader,
              confidence: newHeader === '__NONE__' ? 0 : 1.0,
            };
          }
          return fm;
        });

        return {
          ...item,
          mapping: {
            ...item.mapping,
            fieldMappings: updatedMappings,
          },
        };
      })
    );
  };

  const handleTableTypeChange = (tableKey: string, newType: TableType) => {
    setTableMappings((prev) =>
      prev.map((item) => {
        if (item.key !== tableKey) return item;
        const newMapping = mapTableHeuristic(item.headers, newType);
        return {
          ...item,
          detectedType: newType,
          mapping: newMapping,
        };
      })
    );
  };

  const handleConfirmAll = () => {
    let sales: SalesRow[] = [];
    let products: ProductRow[] = [];
    let stock: StockRow[] = [];
    let investments: InvestmentRow[] = [];

    tableMappings.forEach((item) => {
      const canonicalData = transformRowsToCanonical(item.data, item.detectedType, item.mapping.fieldMappings);
      if (item.detectedType === 'sales') sales = sales.concat(canonicalData as SalesRow[]);
      else if (item.detectedType === 'products') products = products.concat(canonicalData as ProductRow[]);
      else if (item.detectedType === 'stock') stock = stock.concat(canonicalData as StockRow[]);
      else if (item.detectedType === 'investments') investments = investments.concat(canonicalData as InvestmentRow[]);
    });

    // Auto-derive Products catalogue if missing from uploaded single-file data
    if (products.length === 0 && (sales.length > 0 || tableMappings.length > 0)) {
      const rawDataList = tableMappings.flatMap((t) => t.data);
      const seenSkus = new Set<string>();

      rawDataList.forEach((row, idx) => {
        const sku = String(row['prod_id'] ?? row['product_id'] ?? row['item_code'] ?? row['sku'] ?? `SKU-${idx + 1}`);
        if (seenSkus.has(sku)) return;
        seenSkus.add(sku);

        const name = String(row['item_desc'] ?? row['product_name'] ?? row['item_name'] ?? row['title'] ?? row['name'] ?? sku);
        const category = String(row['dept_group'] ?? row['category'] ?? row['department'] ?? 'General');
        const price = Number(row['selling_price_inr'] ?? row['unit_price'] ?? row['price'] ?? row['rate'] ?? 100);
        const cost = Number(row['cost_per_unit'] ?? row['unit_cost'] ?? row['cost_price'] ?? row['cogs'] ?? Math.round(price * 0.65));

        products.push({
          sku,
          name,
          category,
          subcategory: 'Standard',
          brand: 'Generic',
          price,
          cost,
          supplier: 'Main Supplier',
          shelf_life_days: 180,
          weight_kg: 1.0,
          launch_date: '2024-01-01',
        });
      });
    }

    // Auto-derive Stock inventory if missing from uploaded single-file data
    if (stock.length === 0 && (sales.length > 0 || tableMappings.length > 0)) {
      const rawDataList = tableMappings.flatMap((t) => t.data);
      const seenSkus = new Set<string>();

      rawDataList.forEach((row, idx) => {
        const sku = String(row['prod_id'] ?? row['product_id'] ?? row['item_code'] ?? row['sku'] ?? `SKU-${idx + 1}`);
        if (seenSkus.has(sku)) return;
        seenSkus.add(sku);

        const qty = Number(row['available_stock_qty'] ?? row['stock_level'] ?? row['stock'] ?? row['quantity'] ?? 50);
        const dateStr = String(row['txn_date'] ?? row['date'] ?? new Date().toISOString().split('T')[0]);

        stock.push({
          sku,
          date: dateStr,
          quantity: qty,
          beginning_stock: qty + 10,
          units_sold: 5,
          reorder_point: 15,
          supplier_lead_time: 3,
        });
      });
    }

    onConfirm({ sales, products, stock, investments });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Universal Schema Mapper & Data Normalizer
          </DialogTitle>
          <DialogDescription>
            KLAROS automatically detected your file schemas and mapped columns to the core retail analytics engine. Review or customize column bindings below.
          </DialogDescription>
        </DialogHeader>

        {tableMappings.length > 0 && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="w-full flex justify-start overflow-x-auto">
              {tableMappings.map((item) => (
                <TabsTrigger key={item.key} value={item.key} className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="truncate max-w-[150px]">{item.fileName} ({item.sheetName})</span>
                  <Badge variant="outline" className="capitalize text-xs">
                    {item.detectedType}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            {tableMappings.map((item) => (
              <TabsContent key={item.key} value={item.key} className="flex-1 overflow-y-auto space-y-4 py-3 pr-2">
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Dataset Type Classification:</span>
                    <Select value={item.detectedType} onValueChange={(val) => handleTableTypeChange(item.key, val as TableType)}>
                      <SelectTrigger className="w-[180px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sales">Sales Transactions</SelectItem>
                        <SelectItem value="products">Product Catalogue</SelectItem>
                        <SelectItem value="stock">Inventory & Stock</SelectItem>
                        <SelectItem value="investments">Capital Investments</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    AI Auto-Mapped ({Math.round(item.mapping.confidence * 100)}% Confidence)
                  </Badge>
                </div>

                {item.mapping.fieldMappings.some((fm) => !fm.sourceHeader) && (
                  <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <span className="font-semibold">Auto-Healing Notice:</span> Some required retail fields were not found in your file headers (
                      {item.mapping.fieldMappings.filter((fm) => !fm.sourceHeader).map((fm) => fm.canonicalField).join(', ')}
                      ). Standard estimated defaults will be applied to prevent financial calculation errors. You can map them to another column using the dropdowns below.
                    </div>
                  </div>
                )}

                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted text-muted-foreground font-medium border-b">
                      <tr>
                        <th className="p-3">Canonical Retail Field</th>
                        <th className="p-3">Source Header (Uploaded File)</th>
                        <th className="p-3">Field Origin & Auto-Healing Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {item.mapping.fieldMappings.map((fm) => (
                        <tr key={fm.canonicalField} className={!fm.sourceHeader ? "bg-amber-500/5 hover:bg-amber-500/10" : "hover:bg-muted/10"}>
                          <td className="p-3 font-mono font-medium text-foreground">
                            {fm.canonicalField}
                          </td>
                          <td className="p-3">
                            <Select
                              value={fm.sourceHeader ?? '__NONE__'}
                              onValueChange={(val) => handleFieldMapChange(item.key, fm.canonicalField, val)}
                            >
                              <SelectTrigger className="w-full max-w-[240px] h-8">
                                <SelectValue placeholder="-- Unmapped (Auto-Heal) --" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__NONE__">-- Auto-Heal (Apply Smart Default) --</SelectItem>
                                {item.headers.map((h) => (
                                  <SelectItem key={h} value={h}>
                                    {h}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-3">
                            {fm.sourceHeader ? (
                              <Badge variant="default" className="bg-green-600/15 text-green-600 border-green-600/30 flex items-center gap-1 w-fit">
                                <CheckCircle2 className="h-3 w-3" /> Source Column: "{fm.sourceHeader}"
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-500/40 bg-amber-500/15 flex items-center gap-1 w-fit font-medium">
                                <AlertTriangle className="h-3 w-3 text-amber-600" /> Auto-Healed (Estimated Default)
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}

        <DialogFooter className="pt-4 border-t flex items-center justify-between">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirmAll} className="gap-2">
            Confirm & Normalize Dataset
            <ArrowRight className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
