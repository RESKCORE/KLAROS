import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/react';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowLeft,
  Sparkles,
  TrendingUp,
  ShieldAlert,
  AlertTriangle,
  AlertCircle,
  Zap,
  Package,
  Activity,
  Search,
  CheckCircle2,
  Calendar,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { getDecision } from '@/features/decisions/store/decision-store';
import { getCachedDataSources, getMarketMetricsForSource, getDataSources, autoAnalyze } from '@/features/market/api/bi-api';
import { getAiAnalytics, type AiAnalytics } from '@/features/market/api/ai-analytics';
import { inferCategoryFromName } from '@/services/llm/schema-mapper';
import { DecisionKpiCards } from '@/features/decisions/components/DecisionKpiCards';
import { DecisionChatWidget } from '@/features/decisions/components/DecisionChatWidget';
import type { Decision } from '@/features/decisions/types/decision';
import type { MarketMetrics } from '@/features/market/utils/market-metrics';
import type { DataSourceSummary } from '@/features/market/api/bi-api';

import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

import { getCurrencyFormatter } from '@/features/market/utils/currency-utils';

const numberFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 0,
});

const formatDateTick = (val: string) => {
  if (!val) return '';
  if (/^\d{4}-\d{2}$/.test(val)) {
    const [y, m] = val.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[parseInt(m, 10) - 1]} '${y.slice(2)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [y, m] = val.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[parseInt(m, 10) - 1]} '${y.slice(2)}`;
  }
  return val;
};

// Category mappings for visual styling using unified inference engine
function getProductCategory(name: unknown, sku: unknown): string {
  return inferCategoryFromName(String(name || sku || ''));
}

const CATEGORY_META: Record<string, { color: string; gradient: string; badgeClass: string; emoji: string }> = {
  toy: { color: '#ec4899', gradient: 'from-pink-500 to-rose-600', badgeClass: 'bg-pink-50 text-pink-700 border-pink-100', emoji: '🎈' },
  party: { color: '#ec4899', gradient: 'from-pink-500 to-rose-600', badgeClass: 'bg-pink-50 text-pink-700 border-pink-100', emoji: '🎉' },
  garden: { color: '#10b981', gradient: 'from-emerald-400 to-teal-600', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-100', emoji: '🌱' },
  outdoor: { color: '#10b981', gradient: 'from-emerald-400 to-teal-600', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-100', emoji: '🌿' },
  home: { color: '#6366f1', gradient: 'from-indigo-400 to-indigo-600', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-100', emoji: '🏠' },
  decor: { color: '#6366f1', gradient: 'from-indigo-400 to-indigo-600', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-100', emoji: '🕯️' },
  kitchen: { color: '#f97316', gradient: 'from-orange-400 to-amber-500', badgeClass: 'bg-orange-50 text-orange-700 border-orange-100', emoji: '🍽️' },
  dining: { color: '#f97316', gradient: 'from-orange-400 to-amber-500', badgeClass: 'bg-orange-50 text-orange-700 border-orange-100', emoji: '🥣' },
  gift: { color: '#d946ef', gradient: 'from-fuchsia-400 to-purple-600', badgeClass: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100', emoji: '🎁' },
  bag: { color: '#d946ef', gradient: 'from-fuchsia-400 to-purple-600', badgeClass: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100', emoji: '🛍️' },
  stationery: { color: '#0284c7', gradient: 'from-sky-400 to-blue-600', badgeClass: 'bg-sky-50 text-sky-700 border-sky-100', emoji: '📝' },
  craft: { color: '#0284c7', gradient: 'from-sky-400 to-blue-600', badgeClass: 'bg-sky-50 text-sky-700 border-sky-100', emoji: '🎨' },
  bath: { color: '#14b8a6', gradient: 'from-teal-400 to-emerald-600', badgeClass: 'bg-teal-50 text-teal-700 border-teal-100', emoji: '🧼' },
  beauty: { color: '#14b8a6', gradient: 'from-teal-400 to-emerald-600', badgeClass: 'bg-teal-50 text-teal-700 border-teal-100', emoji: '🧴' },
  apparel: { color: '#8b5cf6', gradient: 'from-purple-400 to-violet-600', badgeClass: 'bg-purple-50 text-purple-700 border-purple-100', emoji: '🧣' },
  accessor: { color: '#8b5cf6', gradient: 'from-purple-400 to-violet-600', badgeClass: 'bg-purple-50 text-purple-700 border-purple-100', emoji: '🧤' },
  snack: { color: '#eab308', gradient: 'from-yellow-400 to-amber-600', badgeClass: 'bg-amber-50 text-amber-700 border-amber-100', emoji: '🍪' },
  food: { color: '#eab308', gradient: 'from-yellow-400 to-amber-600', badgeClass: 'bg-amber-50 text-amber-700 border-amber-100', emoji: '🍫' },
  beverage: { color: '#3b82f6', gradient: 'from-blue-500 to-indigo-600', badgeClass: 'bg-blue-50 text-blue-700 border-blue-100', emoji: '🥤' },
};

function getCategoryMeta(category: unknown) {
  const c = String(category ?? '').toLowerCase();
  const match = Object.keys(CATEGORY_META).find((k) => c.includes(k));
  return match
    ? CATEGORY_META[match]
    : { color: '#64748b', gradient: 'from-slate-400 to-slate-600', badgeClass: 'bg-slate-50 text-slate-700 border-slate-100', emoji: '📦' };
}

const getCategoryColor = (cat: string) => getCategoryMeta(cat).color;
const getCategoryBadgeClass = (cat: string) => getCategoryMeta(cat).badgeClass;
const getCategoryEmoji = (cat: string) => getCategoryMeta(cat).emoji;

export default function DecisionResult() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isLoaded } = useUser();
  
  // BI decision and metrics states
  const [isLoading, setIsLoading] = useState(true);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<MarketMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [, setDataSourceName] = useState<string | null>(null);
  const [dataSourceDetails, setDataSourceDetails] = useState<DataSourceSummary | null>(null);

  // AI analytics states
  const [aiAnalytics, setAiAnalytics] = useState<AiAnalytics | null>(null);
  const [aiAnalyticsLoading, setAiAnalyticsLoading] = useState(false);

  // Interactivity states
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [productSearch, setProductSearch] = useState('');

  // Auto-analyze dialog states
  const [dataSources, setDataSources] = useState<DataSourceSummary[]>([]);
  const [showAnalyzeDialog, setShowAnalyzeDialog] = useState(false);
  const [selectedDataSourceId, setSelectedDataSourceId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (!id) {
      navigate('/dashboard');
      return;
    }
    loadDecision();
  }, [id]);

  // Load metrics once decision is available
  useEffect(() => {
    let isMounted = true;

    async function loadMetrics(dataSourceId: string) {
      try {
        setMetricsLoading(true);
        const data = await getMarketMetricsForSource(dataSourceId);
        if (isMounted) {
          setMetrics(data);
        }
      } catch (err) {
        console.error('Error loading market metrics:', err);
      } finally {
        if (isMounted) {
          setMetricsLoading(false);
        }
      }
    }

    if (decision?.data_source_id) {
      loadMetrics(decision.data_source_id);
    }

    return () => {
      isMounted = false;
    };
  }, [decision?.data_source_id]);

  // Load AI analytics once metrics are available (uses multi-provider AI or deterministic domain intelligence)
  useEffect(() => {
    if (!metrics || !decision?.data_source_id) return;

    let isMounted = true;

    async function loadAiAnalytics() {
      try {
        setAiAnalyticsLoading(true);
        const result = await getAiAnalytics(decision!.data_source_id!, metrics!);
        if (isMounted) setAiAnalytics(result);
      } catch (err) {
        console.error('AI analytics failed:', err);
      } finally {
        if (isMounted) setAiAnalyticsLoading(false);
      }
    }

    loadAiAnalytics();
    return () => { isMounted = false; };
  }, [metrics, decision?.data_source_id]);

  // Fetch data sources for the top auto-analyze dialog
  useEffect(() => {
    if (isLoaded && user?.id) {
      const cachedSources = getCachedDataSources();
      if (cachedSources) {
        setDataSources(cachedSources);
      }
      void loadSources(Boolean(cachedSources));
    }
  }, [isLoaded, user?.id]);

  async function loadSources(hasCache = false) {
    if (!user?.id) return;
    try {
      const sources = await getDataSources(user.id);
      setDataSources(sources);
    } catch (err) {
      console.error('Failed to load data sources:', err);
    }
  }

  useEffect(() => {
    const cached = getCachedDataSources();
    if (decision?.data_source_id) {
      const match = cached?.find((source) => source.id === decision.data_source_id);
      if (match) {
        setDataSourceName(match.name);
        setDataSourceDetails(match);
      }
    } else {
      setDataSourceName(null);
      setDataSourceDetails(null);
    }
  }, [decision?.data_source_id]);

  async function loadDecision() {
    try {
      setIsLoading(true);
      setError(null);
      const decisionData = await getDecision(id!);
      setDecision(decisionData);
    } catch (err) {
      console.error('Error loading decision:', err);
      setError(err instanceof Error ? err.message : 'Failed to load decision');
      toast({
        title: 'Error',
        description: 'Failed to load decision. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  const confirmAnalyze = async () => {
    if (!selectedDataSourceId || !user?.id) {
      toast({ title: 'Please select a data source' });
      return;
    }

    try {
      setIsAnalyzing(true);
      toast({
        title: 'Running AI Multi-Criteria Analysis...',
        description: 'Processing operational metrics and strategic models.',
      });

      const { decisionId } = await autoAnalyze(user.id, selectedDataSourceId);
      setShowAnalyzeDialog(false);
      navigate(`/decisions/${decisionId}/result`);
      window.location.reload();
    } catch (err) {
      console.error('Auto-analyze error:', err);
      toast({
        title: 'Analysis failed',
        description: err instanceof Error ? err.message : 'Failed to run analysis',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const selectedCategoryMetrics = useMemo(() => {
    if (!metrics) return null;
    if (selectedCategory === 'All') {
      const totalAmount = metrics.kpis.totalRevenue;
      const totalCost = metrics.kpis.totalCost;
      const grossMargin = totalAmount > 0 ? ((totalAmount - totalCost) / totalAmount) * 100 : 0;
      return {
        category: 'All Categories',
        amount: totalAmount,
        growth: Math.round(totalAmount * 0.12),
        margin: grossMargin,
      };
    }
    const cat = metrics.revenueByCategory.find((c) => c.category === selectedCategory);
    if (!cat) return null;
    return {
      category: cat.category,
      amount: cat.revenue,
      growth: Math.round(cat.revenue * 0.14),
      margin: cat.marginPct ?? 35,
    };
  }, [metrics, selectedCategory]);

  const categories = useMemo(() => {
    if (!metrics) return [];
    return ['All', ...metrics.revenueByCategory.slice(0, 6).map((c) => c.category)];
  }, [metrics]);

  const filteredProducts = useMemo(() => {
    if (!metrics) return [];
    const searchLower = productSearch.toLowerCase().trim();
    return metrics.topProducts
      .filter((p) => {
        const pName = String(p.name ?? '');
        const pSku = String(p.sku ?? '');
        const matchesSearch = !searchLower || pName.toLowerCase().includes(searchLower) || pSku.toLowerCase().includes(searchLower);
        if (selectedCategory === 'All') return matchesSearch;
        return getProductCategory(pName, pSku) === selectedCategory && matchesSearch;
      });
  }, [metrics, selectedCategory, productSearch]);

  const productListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (productListRef.current) {
      productListRef.current.scrollTop = 0;
    }
  }, [metrics, selectedCategory, productSearch]);

  const detectedCurrency = metrics?.kpis?.currency || 'INR';
  const currencySymbol = metrics?.kpis?.currencySymbol || (detectedCurrency === 'GBP' ? '£' : detectedCurrency === 'USD' ? '$' : detectedCurrency === 'EUR' ? '€' : '₹');
  const currencyFormatter = useMemo(() => getCurrencyFormatter(detectedCurrency), [detectedCurrency]);

  const forecastChartData = useMemo(() => {
    if (!metrics) return [];
    const actuals = metrics.revenueByDate.map((d) => ({
      date: d.date,
      actualRevenue: d.revenue,
      projectedRevenue: undefined as number | undefined,
      isForecast: false,
    }));
    const forecasts = (aiAnalytics?.forecasts ?? []).map((f) => ({
      date: f.month,
      actualRevenue: undefined as number | undefined,
      projectedRevenue: f.forecastedRevenue,
      isForecast: true,
    }));
    return [...actuals, ...forecasts];
  }, [metrics, aiAnalytics]);

  const typeLabel = (() => {
    if (dataSourceDetails?.isSynthetic) return 'Prototype Store';
    switch (dataSourceDetails?.type) {
      case 'csv':
        return 'CSV Dataset';
      case 'google_sheets':
        return 'Google Sheets';
      case 'supermarket_products':
        return 'Supermarket Ingest';
      default:
        return dataSourceDetails?.type ? dataSourceDetails.type.replace(/_/g, ' ') : 'Live Stream';
    }
  })();

  const syncedLabel = (() => {
    if (!dataSourceDetails?.lastSyncedAt) return null;
    const date = new Date(dataSourceDetails.lastSyncedAt);
    if (Number.isNaN(date.getTime())) return null;
    return formatDistanceToNow(date, { addSuffix: true });
  })();

  if (isLoading || metricsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/50">
        <div className="text-center space-y-4">
          <div className="h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500 font-medium">Crunching transactions & rendering intelligence...</p>
        </div>
      </div>
    );
  }

  if (error || !decision || !metrics) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/50 px-6">
        <div className="max-w-md w-full text-center bg-white border border-slate-100 rounded-3xl p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Report Unreachable</h1>
          <p className="text-sm text-slate-500 mb-6">{error || 'This report metrics or source could not be parsed.'}</p>
          <Button onClick={() => navigate('/dashboard')} className="w-full rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-medium py-3">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      <DashboardSidebar />
      <div className="flex-1 overflow-y-auto">
        <main className="container py-8 space-y-6 pb-20">
          
          {/* ── Top Header Row ── */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                onClick={() => navigate('/dashboard')}
                variant="outline"
                className="rounded-2xl h-10 px-3.5 text-slate-600 border-slate-200 bg-white hover:bg-slate-50 shadow-sm transition-all"
              >
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Back
              </Button>
              <div className="flex flex-col">
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{decision.title}</h1>
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200/80 font-bold px-2.5 py-0.5 rounded-full text-[11px] uppercase tracking-wider">
                    {decision.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                  <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                    <Layers className="h-3.5 w-3.5 text-blue-500" />
                    {typeLabel}
                  </span>
                  {metrics.kpis.domain && (
                    <>
                      <span>•</span>
                      <Badge variant="outline" className="bg-blue-50/80 text-blue-700 border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                        {metrics.kpis.domain.replace(/_/g, ' ')}
                      </Badge>
                    </>
                  )}
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 font-medium text-slate-500">
                    <Calendar className="h-3.5 w-3.5" />
                    {syncedLabel || 'Synced recently'}
                  </span>
                </div>
              </div>
            </div>

            <Button
              onClick={() => setShowAnalyzeDialog(true)}
              className="rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 shadow-md shadow-blue-600/20 flex items-center gap-2 h-10 transition-all hover:scale-[1.02]"
            >
              <Sparkles className="h-4 w-4" />
              Re-Analyze Dataset
            </Button>
          </div>

          {/* ── KPI Cards Row (Vibrant, INR-formatted) ── */}
          <DecisionKpiCards
            kpis={metrics.kpis}
            currencyFormatter={currencyFormatter}
            numberFormatter={numberFormatter}
          />

          {/* ── Main Analytics Section: Category Breakdown (2/3) + Top Products (1/3) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            
            {/* Left Block: Report Analytics (2/3 Column) */}
            <Card className="lg:col-span-2 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col justify-between gap-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-2xl bg-blue-50 border border-blue-100/60 flex items-center justify-center text-blue-600 shadow-sm">
                    <Activity className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base font-bold text-slate-900 tracking-tight">
                        {metrics.kpis.domain === 'market_securities' ? 'Asset & Security Allocation'
                          : metrics.kpis.domain === 'financial_ledger' ? 'Account & Expense Heads'
                          : metrics.kpis.domain === 'inventory_stock' ? 'Warehouse & Storage Distribution'
                          : metrics.kpis.domain === 'subscription_saas' ? 'Subscription Tier Distribution'
                          : metrics.kpis.domain === 'generic_tabular' ? 'Segment & Category Distribution'
                          : 'Category Sales & Revenue'}
                      </CardTitle>
                      {metrics.kpis.isCategoryInferred && (
                        <Badge variant="outline" className="text-[10px] font-semibold bg-amber-50 text-amber-700 border-amber-200/80 px-2 py-0.5 rounded-full">
                          Inferred Categories
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {metrics.kpis.domain === 'market_securities' ? 'Trading volume and value distribution across assets'
                        : metrics.kpis.domain === 'financial_ledger' ? 'Recorded flows across general ledger account heads'
                        : metrics.kpis.domain === 'inventory_stock' ? 'Holding valuation and on-hand distribution by location'
                        : metrics.kpis.domain === 'subscription_saas' ? 'Recurring revenue distribution by subscription plan'
                        : metrics.kpis.domain === 'generic_tabular' ? 'Statistical distribution across primary categorical segments'
                        : metrics.kpis.isCategoryInferred
                        ? 'Department distribution categorized from product titles'
                        : 'Distribution across supermarket departments'}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="rounded-xl bg-slate-50 text-slate-600 font-semibold px-3 py-1 text-xs border-slate-200">
                  Monthly Run-rate
                </Badge>
              </div>

              {/* Category selector pills */}
              <div className="flex flex-wrap gap-2 pt-1">
                {categories.map((cat) => {
                  const isSelected = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20 scale-[1.02]'
                          : 'bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>

              {/* Bar Chart with Smooth Rounded Top & Custom Category Gradients */}
              <div className="h-64 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.revenueByCategory.slice(0, 6)} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      {metrics.revenueByCategory.slice(0, 6).map((entry, index) => (
                        <linearGradient key={`barGrad-${index}`} id={`barGrad-${index}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={getCategoryColor(entry.category)} stopOpacity={1}/>
                          <stop offset="100%" stopColor={getCategoryColor(entry.category)} stopOpacity={0.4}/>
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis
                      dataKey="category"
                      padding={{ left: 20, right: 20 }}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      tickFormatter={(v) => v >= 1000 ? `${currencySymbol}${(v / 1000).toFixed(0)}k` : `${currencySymbol}${v}`}
                    />
                    <Tooltip
                      cursor={{ fill: '#F8FAFC', radius: 8 }}
                      formatter={(v: number) => [currencyFormatter.format(v), 'Revenue']}
                      contentStyle={{
                        borderRadius: '16px',
                        border: '1px solid #E2E8F0',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.06)',
                        padding: '10px 14px',
                        fontSize: '12px',
                        fontWeight: '600',
                      }}
                    />
                    <Bar dataKey="revenue" radius={[8, 8, 0, 0]} barSize={34}>
                      {metrics.revenueByCategory.slice(0, 6).map((entry, index) => {
                        const isSelected = selectedCategory === 'All' || entry.category === selectedCategory;
                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={`url(#barGrad-${index})`}
                            fillOpacity={isSelected ? 1 : 0.25}
                            stroke={isSelected ? getCategoryColor(entry.category) : 'none'}
                            strokeWidth={isSelected ? 1.5 : 0}
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Bottom Stat Strip (Currency, Growth, Margin) */}
              <div className="grid grid-cols-3 bg-slate-50/80 border border-slate-200/60 rounded-2xl p-4 gap-4 divide-x divide-slate-200">
                <div className="text-left pl-2">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Revenue Contribution</p>
                  <p className="text-lg font-bold text-slate-900 mt-0.5">
                    {selectedCategoryMetrics ? currencyFormatter.format(selectedCategoryMetrics.amount) : `${currencySymbol}0`}
                  </p>
                </div>
                <div className="text-left pl-4">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Projected Growth</p>
                  <p className="text-lg font-bold text-emerald-600 mt-0.5">
                    +{selectedCategoryMetrics ? currencyFormatter.format(selectedCategoryMetrics.growth) : `${currencySymbol}0`}
                  </p>
                </div>
                <div className="text-left pl-4">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Profit Margin</p>
                  <p className="text-lg font-bold text-slate-900 mt-0.5">
                    {selectedCategoryMetrics ? `${selectedCategoryMetrics.margin.toFixed(1)}%` : '0%'}
                  </p>
                </div>
              </div>
            </Card>

            {/* Right Block: Top Products (1/3 Column) */}
            <Card className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-2xl bg-amber-50 border border-amber-100/60 flex items-center justify-center text-amber-600 shadow-sm">
                    <Package className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900 tracking-tight">
                      {metrics.kpis.domain === 'market_securities' ? 'Top Traded Assets'
                        : metrics.kpis.domain === 'financial_ledger' ? 'Top Expense Heads'
                        : metrics.kpis.domain === 'inventory_stock' ? 'Highest Valuation SKUs'
                        : metrics.kpis.domain === 'subscription_saas' ? 'Top Subscriptions by MRR'
                        : metrics.kpis.domain === 'generic_tabular' ? 'Leading Entities / Items'
                        : 'Top Products'}
                    </CardTitle>
                    <p className="text-xs text-slate-400">
                      {metrics.kpis.domain === 'market_securities' ? 'By trading turnover'
                        : metrics.kpis.domain === 'financial_ledger' ? 'By debit expenditure'
                        : metrics.kpis.domain === 'inventory_stock' ? 'By asset valuation'
                        : metrics.kpis.domain === 'subscription_saas' ? 'By monthly revenue'
                        : metrics.kpis.domain === 'generic_tabular' ? 'By primary metric'
                        : 'By sales volume'}
                    </p>
                  </div>
                </div>
                <div className="relative w-36 sm:w-40">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="Filter SKU..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="rounded-full pl-8 h-8 text-xs bg-slate-50 border-slate-200 focus:bg-white"
                  />
                </div>
              </div>

              <ScrollArea className="h-[340px] pr-2" viewportRef={productListRef}>
                <div className="space-y-2.5">
                  {filteredProducts.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-16">No products found in this category.</p>
                  ) : (
                    filteredProducts.map((p, idx) => {
                      const category = getProductCategory(p.name, p.sku);
                      const emoji = getCategoryEmoji(category);
                      const badgeClass = getCategoryBadgeClass(category);
                      return (
                        <div
                          key={p.sku}
                          className="flex items-center justify-between p-2.5 hover:bg-slate-50/80 rounded-2xl transition-all border border-slate-100/50 hover:border-slate-200/80"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-2xl bg-slate-50 flex items-center justify-center text-lg shadow-sm border border-slate-200/60 shrink-0">
                              {emoji}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[120px] sm:max-w-[140px]">{p.name}</p>
                              <span className={`inline-block text-[9px] font-bold px-2 py-0.5 mt-1 border rounded-md uppercase tracking-wider ${badgeClass}`}>
                                {category}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-slate-900">
                              {currencyFormatter.format(p.revenue)}
                            </p>
                            <p className="text-[10px] font-medium text-slate-400">
                              #{p.rank ?? (idx + 1)} SKU
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </Card>
          </div>

          {/* ── Predictive Modeling & AI Executive Brief (2 Columns) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            
            {/* Left: AI Revenue Forecast Line/Area Chart */}
            <Card className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-2xl bg-purple-50 border border-purple-100/60 flex items-center justify-center text-purple-600 shadow-sm">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900 tracking-tight">AI 3-Month Revenue Forecast</CardTitle>
                      <p className="text-xs text-slate-400">Historical trend extrapolation with confidence projection</p>
                    </div>
                  </div>
                  <Badge className="bg-purple-50 text-purple-700 border-purple-200/80 font-bold text-[10px] uppercase tracking-wider">
                    Predictive Extrapolation
                  </Badge>
                </div>
              </div>

              {aiAnalyticsLoading && !aiAnalytics ? (
                <div className="w-full h-[280px] flex items-center justify-center bg-slate-50/50 rounded-2xl animate-pulse">
                  <p className="text-xs text-slate-400 font-medium">Computing temporal trends & forecasting revenue...</p>
                </div>
              ) : (
                <div className="w-full h-[280px]">
                  {aiAnalytics?.forecasts && aiAnalytics.forecasts.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={forecastChartData} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="areaActualGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="areaForecastGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis 
                          dataKey="date" 
                          padding={{ left: 20, right: 20 }} 
                          tickLine={false} 
                          axisLine={false} 
                          tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }} 
                          minTickGap={25}
                          tickFormatter={formatDateTick}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: '#94a3b8', fontSize: 10 }}
                          tickFormatter={(v) => v >= 1000 ? `${currencySymbol}${(v / 1000).toFixed(0)}k` : `${currencySymbol}${v}`}
                        />
                        <Tooltip
                          formatter={(value: number, name: string) =>
                            name === 'actualRevenue'
                              ? [currencyFormatter.format(value), 'Historical Actual']
                              : [currencyFormatter.format(value), 'AI Projected Forecast']
                          }
                          contentStyle={{
                            borderRadius: '16px',
                            border: '1px solid #E2E8F0',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.06)',
                            fontSize: '12px',
                            fontWeight: '600',
                          }}
                        />
                        <ReferenceLine
                          x={aiAnalytics.forecasts[0]?.month}
                          stroke="#94a3b8"
                          strokeDasharray="4 4"
                          label={{ value: 'Forecast Horizon', position: 'insideTopLeft', fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="actualRevenue"
                          stroke="#3b82f6"
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#areaActualGrad)"
                          connectNulls
                        />
                        <Area
                          type="monotone"
                          dataKey="projectedRevenue"
                          stroke="#f59e0b"
                          strokeWidth={2.5}
                          strokeDasharray="5 5"
                          fillOpacity={1}
                          fill="url(#areaForecastGrad)"
                          connectNulls
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center bg-slate-50/50 rounded-2xl border border-slate-100">
                      <p className="text-xs text-slate-400 text-center px-4">Forecast model requires at least 30 transaction days to project.</p>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Right: AI Executive Synthesis Brief */}
            <Card className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-2xl bg-indigo-50 border border-indigo-100/60 flex items-center justify-center text-indigo-600 shadow-sm">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900 tracking-tight">Executive Intelligence Brief</CardTitle>
                      <p className="text-xs text-slate-400">Automated multi-criteria business synthesis</p>
                    </div>
                  </div>
                  <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200/80 font-bold text-[10px] uppercase tracking-wider">
                    AI Synthesized
                  </Badge>
                </div>

                {aiAnalyticsLoading && !aiAnalytics ? (
                  <div className="space-y-3 py-4">
                    <div className="h-4 bg-slate-100 rounded animate-pulse w-full" />
                    <div className="h-4 bg-slate-100 rounded animate-pulse w-5/6" />
                    <div className="h-4 bg-slate-100 rounded animate-pulse w-4/6" />
                  </div>
                ) : (
                  <div className="space-y-4 pt-1">
                    <p className="text-sm text-slate-650 leading-relaxed font-normal">
                      {aiAnalytics?.narrative || aiAnalytics?.executiveSummary || 'Executive overview generated from recent transactions.'}
                    </p>

                    {/* Data Quality / Cost Estimation Disclosure Alert */}
                    {(aiAnalytics?.dataQualityNote || metrics.kpis.isCostEstimated) && (
                      <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200/60 text-amber-900 text-xs flex items-start gap-2.5">
                        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">
                          {aiAnalytics?.dataQualityNote ||
                            'Cost & Margin Note: Unit cost data was not provided in the source file. Profit and margin figures reflect an industry benchmark estimate (65% COGS / 35% margin) rather than measured supplier costs.'}
                        </span>
                      </div>
                    )}

                    {/* Quick KPI pills */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200">
                        <Activity className="h-3.5 w-3.5 text-blue-500" />
                        <span>Revenue: <strong>{currencyFormatter.format(metrics.kpis.totalRevenue)}</strong></span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200">
                        <Package className="h-3.5 w-3.5 text-emerald-500" />
                        <span>{numberFormatter.format(metrics.kpis.totalUnits)} units</span>
                      </span>
                      <span
                        className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200"
                        title={metrics.kpis.isCostEstimated ? 'Estimated margin based on 65% retail COGS benchmark' : 'Measured margin from supplier costs'}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-purple-500" />
                        <span>{metrics.kpis.profitMarginPct.toFixed(1)}% margin {metrics.kpis.isCostEstimated ? '(est.)' : ''}</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Actionable Opportunities List */}
              {aiAnalytics?.opportunities && aiAnalytics.opportunities.length > 0 && (
                <div className="mt-5 pt-4 border-t border-slate-100 space-y-2">
                  <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">Prioritized Actions</p>
                  <div className="space-y-2">
                    {aiAnalytics.opportunities.slice(0, 2).map((opp, idx) => (
                      <div key={idx} className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/60 flex items-center justify-between">
                        <div className="min-w-0 pr-3">
                          <p className="text-xs font-bold text-slate-800 truncate">{opp.title}</p>
                          <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{opp.detail}</p>
                        </div>
                        <Badge className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                          opp.impact === 'high' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {opp.impact} Impact
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* ── Operational Risk Alerts & Anomalies (if present) ── */}
          {(aiAnalytics?.riskAlerts?.length || aiAnalytics?.anomalies?.length) ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Risks Card */}
              {aiAnalytics?.riskAlerts?.length ? (
                <Card className="rounded-3xl border border-rose-100 bg-rose-50/30 p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldAlert className="h-5 w-5 text-rose-500" />
                    <CardTitle className="text-base font-bold text-rose-950">Operational Risk Alerts</CardTitle>
                  </div>
                  <div className="space-y-2.5">
                    {aiAnalytics.riskAlerts.map((risk, idx) => (
                      <div key={idx} className="p-3 rounded-2xl border border-rose-200/60 bg-white/90 text-slate-700 flex gap-2.5">
                        <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-rose-950">{risk.title}</p>
                          <p className="text-[11px] text-rose-800 leading-normal mt-0.5">{risk.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ) : null}

              {/* Anomalies Card */}
              {aiAnalytics?.anomalies?.length ? (
                <Card className="rounded-3xl border border-violet-100 bg-violet-50/30 p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-5 w-5 text-violet-600" />
                    <CardTitle className="text-base font-bold text-violet-950">Detected Outliers & Anomalies</CardTitle>
                  </div>
                  <div className="space-y-2.5">
                    {aiAnalytics.anomalies.map((anom, idx) => (
                      <div key={idx} className="p-3 rounded-2xl border border-violet-200/60 bg-white/90 text-slate-700 flex gap-2.5">
                        <Zap className="h-4 w-4 text-violet-500 shrink-0 mt-0.5 animate-pulse" />
                        <div>
                          <p className="text-xs font-bold text-violet-950 uppercase tracking-wider">{anom.metric}</p>
                          <p className="text-[11px] text-violet-800 leading-normal mt-0.5">{anom.finding}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ) : null}
            </div>
          ) : null}
        </main>

        {/* ── Auto-Analyze Dataset Selection Dialog ── */}
        <Dialog open={showAnalyzeDialog} onOpenChange={setShowAnalyzeDialog}>
          <DialogContent className="max-w-md w-full rounded-3xl p-6 bg-white shadow-xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900">Select Dataset for Re-Analysis</DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-1">
                Choose which connected dataset should be used for the analysis run.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2.5 mt-4">
              {dataSources.map((source) => (
                <button
                  key={source.id}
                  type="button"
                  onClick={() => setSelectedDataSourceId(source.id)}
                  className={`w-full rounded-2xl border text-left px-4 py-3.5 transition-all ${
                    selectedDataSourceId === source.id
                      ? 'border-blue-500 bg-blue-50/60 text-blue-900 shadow-sm shadow-blue-500/10'
                      : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/20 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold">{source.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Type: {source.type}</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                      {source.status}
                    </span>
                  </div>
                </button>
              ))}
              {dataSources.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">No data sources connected yet.</p>
              )}
            </div>
            <DialogFooter className="mt-6 flex gap-2">
              <Button variant="outline" onClick={() => setShowAnalyzeDialog(false)} className="rounded-xl flex-1 border-slate-200 hover:bg-slate-50">
                Cancel
              </Button>
              <Button onClick={confirmAnalyze} disabled={isAnalyzing || !selectedDataSourceId} className="rounded-xl flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold">
                {isAnalyzing ? 'Analyzing...' : 'Run Analysis'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Floating AI Chat Companion ── */}
        <DecisionChatWidget metrics={metrics} />
      </div>
    </div>
  );
}
