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
import { detectTableType, mapTableHeuristic, transformRowsToCanonical, inferCategoryFromName, TableType, TableMappingResult } from '@/services/llm/schema-mapper';
import { classifyDataset, type DatasetDomain, type ColumnRoles, DOMAIN_METADATA } from '@/services/llm/domain/dataset-classifier';
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
    domain?: DatasetDomain;
    roles?: ColumnRoles;
    isCostEstimated?: boolean;
  }) => void;
}

export function MappingPreviewModal({ isOpen, onClose, extractionResults, onConfirm }: MappingPreviewModalProps) {
  const [selectedDomain, setSelectedDomain] = useState<DatasetDomain>('retail_transactions');
  const [domainConfidence, setDomainConfidence] = useState<number>(0.95);
  const [domainReasoning, setDomainReasoning] = useState<string>('');
  const [detectedRoles, setDetectedRoles] = useState<ColumnRoles>({});

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

    // Classify primary dataset domain
    const primarySheet = extractionResults[0]?.sheets[0];
    if (primarySheet) {
      classifyDataset(primarySheet.headers, primarySheet.data.slice(0, 10)).then((res) => {
        setSelectedDomain(res.domain);
        setDomainConfidence(res.confidence);
        setDomainReasoning(res.reasoning);
        setDetectedRoles(res.detectedRoles);
      });
    }

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

    // Check whether the user has mapped a genuine unit cost column
    const hasMappedCost = tableMappings.some((t) =>
      t.mapping.fieldMappings.some((m) => m.canonicalField === 'cost' && Boolean(m.sourceHeader))
    );
    const isCostEstimated = !hasMappedCost;

    // Auto-derive Products catalogue if missing from uploaded single-file data
    if (products.length === 0 && (sales.length > 0 || tableMappings.length > 0)) {
      const seenSkus = new Set<string>();

      // Scan rows across all tables to collect unique SKUs, names, and prices
      for (const t of tableMappings) {
        for (const row of t.data) {
          const rawSku = row['StockCode'] ?? row['stock_code'] ?? row['stockcode'] ?? row['Item_Identifier'] ?? row['prod_id'] ?? row['product_id'] ?? row['item_code'] ?? row['sku'] ?? row['code'] ?? row['id'];
          const sku = rawSku ? String(rawSku).trim() : '';
          if (!sku || seenSkus.has(sku)) continue;
          seenSkus.add(sku);

          const rawName = row['Description'] ?? row['description'] ?? row['Item_Type'] ?? row['item_desc'] ?? row['product_name'] ?? row['item_name'] ?? row['title'] ?? row['name'];
          const name = rawName ? String(rawName).trim() : `Item ${sku}`;

          const rawCategory = row['dept_group'] ?? row['category'] ?? row['department'] ?? row['Item_Type'];
          const category = rawCategory ? String(rawCategory).trim() : inferCategoryFromName(name);

          const rawPrice = Number(row['selling_price_inr'] ?? row['unit_price'] ?? row['price'] ?? row['rate'] ?? row['mrp'] ?? row['UnitPrice'] ?? row['Price'] ?? 100);
          const price = isNaN(rawPrice) || rawPrice <= 0 ? 100 : Math.abs(rawPrice);

          const rawCost = hasMappedCost ? Number(row['cost_per_unit'] ?? row['unit_cost'] ?? row['cost_price'] ?? row['cogs'] ?? row['cost']) : 0;
          const cost = !isNaN(rawCost) && rawCost > 0 ? rawCost : 0;

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

          // Safeguard to prevent excessive memory on huge catalogues
          if (products.length >= 50000) break;
        }
        if (products.length >= 50000) break;
      }
    }

    // Note: Pure transactional sales files do not contain inventory snapshots.
    // We intentionally leave stock empty rather than synthesizing fabricated stock rows,
    // allowing the UI to accurately mark inventory as "Not Tracked / No Stock Data".

    onConfirm({
      sales,
      products,
      stock,
      investments,
      domain: selectedDomain,
      roles: detectedRoles,
      isCostEstimated,
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Universal Schema Mapper & Multi-Domain Classifier
          </DialogTitle>
          <DialogDescription>
            KLAROS automatically classifies your dataset domain and maps columns to specialized business intelligence rulesets.
          </DialogDescription>
        </DialogHeader>

        {/* Domain Classification & User Override Banner */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-slate-50 border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs my-1">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Detected Domain</span>
                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200 text-[10px] font-bold">
                  {Math.round(domainConfidence * 100)}% Confidence
                </Badge>
              </div>
              <p className="text-sm font-bold text-slate-900 mt-0.5">
                {DOMAIN_METADATA[selectedDomain]?.displayName || selectedDomain}
              </p>
              <p className="text-xs text-slate-500 line-clamp-1">{domainReasoning}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-500 font-semibold whitespace-nowrap">Domain Override:</span>
            <Select
              value={selectedDomain}
              onValueChange={(val) => {
                setSelectedDomain(val as DatasetDomain);
              }}
            >
              <SelectTrigger className="h-9 w-48 rounded-xl bg-white border-slate-200 text-xs font-bold text-slate-800 shadow-sm">
                <SelectValue placeholder="Select domain" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="retail_transactions">Retail Transactions</SelectItem>
                <SelectItem value="market_securities">Market Securities</SelectItem>
                <SelectItem value="inventory_stock">Inventory & Stock</SelectItem>
                <SelectItem value="financial_ledger">Financial Ledger</SelectItem>
                <SelectItem value="subscription_saas">SaaS Subscriptions</SelectItem>
                <SelectItem value="generic_tabular">General Business Data</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

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
