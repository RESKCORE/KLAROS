export type DatasetType = 'supermarket' | 'retail' | 'generic';
export type AutoAnalysisStatus = 'pending' | 'running' | 'completed' | 'error';
export type ImportFileType = 'products' | 'sales' | 'stock' | 'investments';

// Database row types
export interface DataSource {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  dataset_type: DatasetType;
  created_at: string;
  updated_at: string;
}

export interface SupermarketProduct {
  id: string;
  data_source_id: string;
  sku: string;
  name: string;
  category: string | null;
  subcategory: string | null;
  brand: string | null;
  price: number | null;
  cost: number | null;
  supplier: string | null;
  shelf_life_days: number | null;
  weight_kg: number | null;
  launch_date: string | null;
}

export interface SalesRecord {
  id: string;
  product_id: string;
  date: string;
  quantity: number;
  revenue: number;
  discount: number | null;
  customer_id: string | null;
  payment_method: string | null;
  store_city: string | null;
}

export interface StockLevel {
  id: string;
  product_id: string;
  date: string;
  beginning_stock: number | null;
  units_sold: number | null;
  quantity: number;
  reorder_point: number | null;
  supplier_lead_time: number | null;
}

export interface Investment {
  id: string;
  data_source_id: string;
  date: string | null;
  amount: number;
  category: string | null;
  description: string | null;
  expected_roi: number | null;
  actual_roi: number | null;
}

export interface AutoAnalysis {
  id: string;
  data_source_id: string;
  decision_id: string | null;
  status: AutoAnalysisStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductAggregate {
  product_id: string;
  sku: string;
  name: string;
  category: string | null;
  price: number;
  cost: number;
  margin_pct: number;
  total_units_sold: number;
  total_revenue: number;
  avg_stock_level: number;
  reorder_point: number;
  stockout_risk: 'high' | 'medium' | 'low';
  months_covered: number;
}

export interface SalesAggregate {
  total_revenue: number;
  total_units: number;
  avg_monthly_revenue: number;
  top_categories: Array<{ category: string; revenue: number; units: number }>;
  revenue_trend: 'growing' | 'declining' | 'stable';
  months_covered: number;
  date_range: { from: string; to: string } | null;
}

export interface StockAggregate {
  total_products: number;
  stockout_count: number;
  overstock_count: number;
  avg_turnover_ratio: number;
  critical_items: Array<{
    sku: string;
    name: string;
    current_stock: number;
    reorder_point: number;
  }>;
}

export interface InvestmentAggregate {
  total_invested: number;
  avg_expected_roi: number;
  avg_actual_roi: number;
  roi_gap: number;
  categories: Array<{ category: string; amount: number; expected_roi: number }>;
}

export interface BusinessDataContext {
  dataSourceId: string;
  dataSourceName: string;
  products: ProductAggregate[];
  sales: SalesAggregate;
  stock: StockAggregate;
  investments: InvestmentAggregate;
  generatedAt: string;
}

export interface AICriterion {
  name: string;
  description: string;
  weight: number;
  rationale: string;
}

export interface AIOption {
  title: string;
  description: string;
  pros: string[];
  cons: string[];
  estimated_cost?: number;
  data_citations: string[];
}

export interface AIScore {
  option_title: string;
  criterion_name: string;
  score: number;
  justification: string;
}

export interface AIRecommendation {
  top_option: string;
  confidence: number;
  reasoning: string;
  key_risks: string[];
  next_steps: string[];
}

export interface AIAnalysisResponse {
  decision_title: string;
  decision_context: string;
  criteria: AICriterion[];
  options: AIOption[];
  scores: AIScore[];
  recommendation: AIRecommendation;
}

export interface DataSourceSummary {
  dataSourceId: string;
  name: string;
  productCount: number;
  salesCount: number;
  stockCount: number;
  investmentCount: number;
  monthsCovered: number;
  totalRevenue: number;
  dateRange: { from: string; to: string } | null;
}

export interface AutoAnalyzeResult {
  decisionId: string;
  autoAnalysisId: string;
  dataSourceId: string;
}

export interface CSVImportResult {
  success: boolean;
  dataSourceId: string;
  counts: {
    products: number;
    sales: number;
    stock: number;
    investments: number;
  };
  errors: string[];
}

export interface DataIngestionProgress {
  stage: string;
  progress: number;
  message: string;
}

export interface ImportedDataFile {
  type: ImportFileType;
  file: File;
}
