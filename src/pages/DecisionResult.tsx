import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useUser, UserButton, useAuth } from '@clerk/react';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Sparkles, TrendingUp, TrendingDown, ShieldAlert, AlertTriangle, Info, Zap, Bot, Send, IndianRupee, Package, Tag, Activity, Bell, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { getDecision } from '@/features/decisions/store/decision-store';
import { getCachedDataSources, getMarketMetricsForSource, getDataSources, autoAnalyze } from '@/features/market/api/bi-api';
import { getAiAnalytics, hasAiApiKey, type AiAnalytics } from '@/features/market/api/ai-analytics';
import { DecisionKpiCards } from '@/features/decisions/components/DecisionKpiCards';
import { DecisionChatWidget } from '@/features/decisions/components/DecisionChatWidget';
import type { Decision } from '@/features/decisions/types/decision';
import type { MarketMetrics } from '@/features/market/utils/market-metrics';
import type { DataSourceSummary } from '@/features/market/api/bi-api';

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

// Category mappings for visual styling
function getProductCategory(name: string, sku: string): string {
  const n = name.toLowerCase();
  const s = sku.toLowerCase();
  if (s.startsWith('bv') || n.includes('nescafe') || n.includes('juice') || n.includes('tea') || n.includes('coffee') || n.includes('pepsi') || n.includes('cola') || n.includes('water') || n.includes('drink')) {
    return 'Beverages';
  }
  if (s.startsWith('gr') || n.includes('oats') || n.includes('oil') || n.includes('rice') || n.includes('flour') || n.includes('salt') || n.includes('sugar') || n.includes('groceries')) {
    return 'Groceries';
  }
  if (s.startsWith('bk') || n.includes('cake') || n.includes('bread') || n.includes('bun') || n.includes('bakery') || n.includes('cookie') || n.includes('biscuit')) {
    return 'Bakery';
  }
  if (s.startsWith('da') || n.includes('cheese') || n.includes('yogurt') || n.includes('milk') || n.includes('butter') || n.includes('paneer') || n.includes('dairy')) {
    return 'Dairy';
  }
  if (s.startsWith('pr') || n.includes('apple') || n.includes('banana') || n.includes('orange') || n.includes('potato') || n.includes('tomato') || n.includes('onion') || n.includes('produce') || n.includes('fruit') || n.includes('vegetable')) {
    return 'Produce';
  }
  if (s.startsWith('sn') || n.includes('chocolate') || n.includes('chips') || n.includes('snacks') || n.includes('kurkure') || n.includes('lays')) {
    return 'Snacks';
  }
  return 'General';
}

const CATEGORY_META: Record<string, { color: string; badgeClass: string; emoji: string }> = {
  beverage: { color: '#3b82f6', badgeClass: 'bg-blue-50 text-blue-700 border-blue-100', emoji: '🥤' },
  grocer: { color: '#10b981', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-100', emoji: '🛒' },
  bakery: { color: '#f59e0b', badgeClass: 'bg-amber-50 text-amber-700 border-amber-100', emoji: '🍞' },
  dairy: { color: '#ef4444', badgeClass: 'bg-rose-50 text-rose-700 border-rose-100', emoji: '🥛' },
  produce: { color: '#8b5cf6', badgeClass: 'bg-purple-50 text-purple-700 border-purple-100', emoji: '🍎' },
  snack: { color: '#06b6d4', badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-100', emoji: '🍿' },
};

function getCategoryMeta(category: string) {
  const c = category.toLowerCase();
  const match = Object.keys(CATEGORY_META).find((k) => c.includes(k));
  return match
    ? CATEGORY_META[match]
    : { color: '#64748b', badgeClass: 'bg-slate-50 text-slate-700 border-slate-100', emoji: '📦' };
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
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [dataSourceName, setDataSourceName] = useState<string | null>(null);
  const [dataSourceDetails, setDataSourceDetails] = useState<DataSourceSummary | null>(null);

  // AI analytics states
  const [aiAnalytics, setAiAnalytics] = useState<AiAnalytics | null>(null);
  const [aiAnalyticsLoading, setAiAnalyticsLoading] = useState(false);
  const [aiAnalyticsError, setAiAnalyticsError] = useState<string | null>(null);

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
        setMetricsError(null);
        const data = await getMarketMetricsForSource(dataSourceId);
        if (isMounted) {
          setMetrics(data);
        }
      } catch (err) {
        console.error('Error loading market metrics:', err);
        if (isMounted) {
          setMetricsError('Unable to load market metrics.');
        }
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

  // Load AI analytics once metrics are available
  useEffect(() => {
    if (!metrics || !decision?.data_source_id) return;
    if (!hasAiApiKey()) return;

    let isMounted = true;

    async function loadAiAnalytics() {
      try {
        setAiAnalyticsLoading(true);
        setAiAnalyticsError(null);
        const result = await getAiAnalytics(decision!.data_source_id!, metrics!);
        if (isMounted) setAiAnalytics(result);
      } catch (err) {
        console.error('AI analytics failed:', err);
        if (isMounted) {
          setAiAnalyticsError(err instanceof Error ? err.message : 'AI analytics unavailable.');
        }
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

  // Auto-analyze confirm trigger
  const confirmAnalyze = async () => {
    if (!selectedDataSourceId || !user?.id) {
      toast({
        title: 'Select a dataset',
        description: 'Choose a dataset to analyze.',
        variant: 'destructive',
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await autoAnalyze(user.id, selectedDataSourceId);
      toast({
        title: 'Analysis complete',
        description: 'Dataset analyzed successfully.',
      });
      setShowAnalyzeDialog(false);
      navigate(`/decisions/${result.decisionId}/result`);
      window.location.reload(); // Refresh to reload new params/context
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Auto-analysis failed.';
      toast({
        title: 'Auto-analysis failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Dynamically compute filtered metrics based on selected pill
  const selectedCategoryMetrics = useMemo(() => {
    if (!metrics) return null;
    if (selectedCategory === 'All') {
      return {
        amount: metrics.kpis.totalRevenue,
        growth: metrics.kpis.totalProfit,
        margin: metrics.kpis.profitMarginPct,
      };
    }
    const match = metrics.revenueByCategory.find((c) => c.category === selectedCategory);
    if (match) {
      return {
        amount: match.revenue,
        growth: match.revenue * (match.marginPct / 100),
        margin: match.marginPct,
      };
    }
    return { amount: 0, growth: 0, margin: 0 };
  }, [metrics, selectedCategory]);

  const categories = useMemo(() => {
    if (!metrics) return [];
    return ['All', ...metrics.revenueByCategory.slice(0, 6).map((c) => c.category)];
  }, [metrics]);

  const filteredProducts = useMemo(() => {
    if (!metrics) return [];
    return metrics.topProducts
      .filter((p) => {
        const matchesSearch = p.name.toLowerCase().includes(productSearch.toLowerCase());
        if (selectedCategory === 'All') return matchesSearch;
        return getProductCategory(p.name, p.sku) === selectedCategory && matchesSearch;
      });
  }, [metrics, selectedCategory, productSearch]);

  const forecastChartData = useMemo(() => {
    if (!metrics) return [];
    const actuals = metrics.revenueByDate.map((d) => ({
      date: d.date,
      revenue: d.revenue,
      forecastedRevenue: undefined as number | undefined,
      isForecast: false,
    }));
    const forecasts = (aiAnalytics?.forecasts ?? []).map((f) => ({
      date: f.month,
      revenue: undefined as number | undefined,
      forecastedRevenue: f.forecastedRevenue,
      isForecast: true,
    }));
    return [...actuals, ...forecasts];
  }, [metrics, aiAnalytics]);

  const typeLabel = (() => {
    if (dataSourceDetails?.isSynthetic) return 'Prototype';
    switch (dataSourceDetails?.type) {
      case 'csv':
        return 'CSV upload';
      case 'google_sheets':
        return 'Google Sheets';
      case 'supermarket_products':
        return 'Supermarket';
      default:
        return dataSourceDetails?.type ? dataSourceDetails.type.replace(/_/g, ' ') : null;
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
          <p className="text-sm text-slate-500 font-medium">Crunching data & rendering insights...</p>
        </div>
      </div>
    );
  }

  if (error || !decision || !metrics) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/50 px-6">
        <div className="max-w-md w-full text-center bg-white border border-slate-100 rounded-3xl p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Analysis Unreachable</h1>
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
        <main className="container py-8 space-y-6 pb-16">
          
          {/* Back and Subheader Row */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button onClick={() => navigate('/dashboard')} variant="outline" className="rounded-xl h-9 px-3 text-slate-600 border-slate-200 bg-white hover:bg-slate-50 transition-colors">
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Back
              </Button>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold text-slate-900 tracking-tight">{decision.title}</h1>
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-50 font-semibold px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wide">
                    {decision.status}
                  </Badge>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {[typeLabel, syncedLabel].filter(Boolean).join(' • ') || 'Dataset'}
                </p>
              </div>
            </div>

            <Button onClick={() => setShowAnalyzeDialog(true)} className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 shadow-sm shadow-blue-600/15 flex items-center gap-1.5 h-9">
              <Sparkles className="h-3.5 w-3.5" />
              Auto-Analyze Now
            </Button>
          </div>

        {/* ── KPI Cards Row (Vibrant HSL, rupee-formatted) ── */}
        <DecisionKpiCards
          kpis={metrics.kpis}
          currencyFormatter={currencyFormatter}
          numberFormatter={numberFormatter}
        />

        {/* ── Main Charts Content (Report Analytics + Top Products) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          
          {/* Left Block: Report Analytics (2/3 Column) */}
          <Card className="lg:col-span-2 rounded-3xl border border-slate-100/60 bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col justify-between gap-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <Activity className="h-4 w-4" />
                </div>
                <CardTitle className="text-base font-semibold text-slate-850">Report Analytics</CardTitle>
              </div>
              <Badge variant="outline" className="rounded-lg bg-slate-50 text-slate-500 font-medium px-2 py-1 text-xs border-slate-200">
                Monthly ▾
              </Badge>
            </div>

            {/* Category pills */}
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/10'
                        : 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Bar chart with custom colored cells */}
            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.revenueByCategory.slice(0, 6)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    {metrics.revenueByCategory.slice(0, 6).map((entry, index) => (
                      <linearGradient key={`colorUv-${index}`} id={`colorUv-${index}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={getCategoryColor(entry.category)} stopOpacity={0.9}/>
                        <stop offset="95%" stopColor={getCategoryColor(entry.category)} stopOpacity={0.4}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="category" padding={{ left: 20, right: 20 }} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${v / 1000}k` : v} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} formatter={(v: number) => currencyFormatter.format(v)} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
                  <Bar dataKey="revenue" radius={[6, 6, 0, 0]} barSize={32}>
                    {metrics.revenueByCategory.slice(0, 6).map((entry, index) => {
                      const isSelected = selectedCategory === 'All' || entry.category === selectedCategory;
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={`url(#colorUv-${index})`}
                          fillOpacity={isSelected ? 1 : 0.3}
                          stroke={isSelected ? getCategoryColor(entry.category) : 'none'}
                          strokeWidth={isSelected ? 1 : 0}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Bottom row summary cards (interactive metrics) */}
            <div className="grid grid-cols-3 bg-[#F8FAFC] border border-slate-100/50 rounded-2xl p-4 gap-4 divide-x divide-slate-200/60">
              <div className="text-left pl-2">
                <p className="text-[10px] uppercase font-medium text-slate-400">Amount</p>
                <p className="text-base font-semibold text-slate-800 mt-1">
                  {selectedCategoryMetrics ? currencyFormatter.format(selectedCategoryMetrics.amount) : '₹0'}
                </p>
              </div>
              <div className="text-left pl-4">
                <p className="text-[10px] uppercase font-medium text-slate-400">Growth</p>
                <p className="text-base font-semibold text-slate-800 mt-1">
                  {selectedCategoryMetrics ? currencyFormatter.format(selectedCategoryMetrics.growth) : '₹0'}
                </p>
              </div>
              <div className="text-left pl-4">
                <p className="text-[10px] uppercase font-medium text-slate-400 font-medium">Margin %</p>
                <p className="text-base font-semibold text-slate-800 mt-1">
                  {selectedCategoryMetrics ? `${selectedCategoryMetrics.margin.toFixed(1)}%` : '0%'}
                </p>
              </div>
            </div>
          </Card>

          {/* Right Block: Top Products (1/3 Column) */}
          <Card className="rounded-3xl border border-slate-100/60 bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                  <Package className="h-4 w-4" />
                </div>
                <CardTitle className="text-base font-semibold text-slate-850">Top Products</CardTitle>
              </div>
              <div className="relative w-36 sm:w-44">
                <Search className="absolute left-2.5 top-1.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Search..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="rounded-full pl-8 h-7 text-xs bg-slate-50 border-slate-200 focus:bg-white"
                />
              </div>
            </div>

            <ScrollArea className="h-[340px] pr-2">
              <div className="space-y-3">
                {filteredProducts.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-12">No products found in this category.</p>
                ) : (
                  filteredProducts.map((p) => {
                    const category = getProductCategory(p.name, p.sku);
                    const emoji = getCategoryEmoji(category);
                    const badgeClass = getCategoryBadgeClass(category);
                    return (
                      <div key={p.sku} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-2xl transition-all border border-transparent hover:border-slate-100/30">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-lg shadow-sm border border-slate-100/20">
                            {emoji}
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-800 leading-tight">{p.name}</p>
                            <span className={`inline-block text-[9px] font-medium px-2 py-0.5 mt-1 border rounded-md ${badgeClass}`}>
                              {category}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs font-semibold text-slate-900">
                          {currencyFormatter.format(p.revenue)}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </Card>
        </div>

        {/* API Warning Badge (soft warning if AI key is missing) */}
        {!hasAiApiKey() && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs font-medium text-amber-800 flex items-center gap-3">
            <Sparkles className="h-4 w-4 shrink-0 text-amber-600 animate-pulse" />
            <span>Configure an AI API key in <code className="font-mono bg-amber-100 px-1.5 py-0.5 rounded text-[11px]">.env.local</code> to unlock rich narrative executive summaries, opportunities, and revenue forecasts.</span>
          </div>
        )}

        {/* ── Bottom Section: Forecasts, AI narrative, Opportunities ── */}
        {(aiAnalytics || aiAnalyticsLoading) && (
          <div className="space-y-6">
            
            {/* Top Revenue Forecast Block (Full Width) */}
            <Card className="rounded-3xl border border-slate-100/60 bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col gap-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-base font-semibold text-slate-850">AI Revenue Forecast</CardTitle>
                  </div>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Trend-based 3-month forward projection from historical transactions.
                </p>
              </div>

              {aiAnalyticsLoading && !aiAnalytics ? (
                <div className="w-full h-[350px] flex items-center justify-center bg-slate-50/50 rounded-2xl animate-pulse">
                  <p className="text-xs text-slate-400">AI projecting forecasts...</p>
                </div>
              ) : (
                <div className="w-full h-[350px]">
                  {aiAnalytics?.forecasts && aiAnalytics.forecasts.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={forecastChartData} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis 
                          dataKey="date" 
                          padding={{ left: 30, right: 30 }} 
                          tickLine={false} 
                          axisLine={false} 
                          tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }} 
                          minTickGap={30}
                        />
                        <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v) => v >= 1000 ? `${v / 1000}k` : v} />
                        <Tooltip
                          formatter={(value: number, name: string) =>
                            name === "revenue"
                              ? [currencyFormatter.format(value), "Actual Revenue"]
                              : [currencyFormatter.format(value), "AI Forecast"]
                          }
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                        />
                        <ReferenceLine
                          x={aiAnalytics.forecasts[0]?.month}
                          stroke="#94a3b8"
                          strokeDasharray="3 3"
                          label={{ value: 'Future Forecast', position: 'insideTopLeft', fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="revenue"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 6 }}
                          connectNulls
                        />
                        <Line
                          type="monotone"
                          dataKey="forecastedRevenue"
                          stroke="#f59e0b"
                          strokeWidth={3}
                          strokeDasharray="6 6"
                          dot={{ r: 4, fill: '#f59e0b', strokeWidth: 2, stroke: '#fff' }}
                          activeDot={{ r: 6 }}
                          connectNulls
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center bg-slate-50/50 rounded-2xl border border-slate-100">
                      <p className="text-xs text-slate-400 text-center px-4">Forecast model needs at least 3 months of history to extrapolate.</p>
                    </div>
                  )}
                </div>
              )}
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Executive Summary Narrative */}
              <Card className="rounded-3xl border border-slate-100/60 bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col justify-between h-full">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <CardTitle className="text-base font-semibold text-slate-850">AI Executive Summary</CardTitle>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-semibold uppercase tracking-wider bg-blue-50/50 text-blue-700 border-blue-100">
                      Automated Synthesis
                    </Badge>
                  </div>

                  {aiAnalyticsLoading && !aiAnalytics ? (
                    <div className="space-y-2.5">
                      <div className="h-4 bg-slate-100 rounded animate-pulse w-full" />
                      <div className="h-4 bg-slate-100 rounded animate-pulse w-5/6" />
                      <div className="h-4 bg-slate-100 rounded animate-pulse w-4/6" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-slate-650 leading-relaxed font-normal">
                        {aiAnalytics?.narrative || 'Executive overview generated from recent transactions.'}
                      </p>

                      {/* Structured Quick Facts Pill Badges */}
                      <div className="flex flex-wrap gap-2 pt-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200/60">
                          <Activity className="h-3.5 w-3.5 text-blue-500" />
                          <span>Revenue: <strong>{currencyFormatter.format(metrics.kpis.totalRevenue)}</strong></span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200/60">
                          <Package className="h-3.5 w-3.5 text-emerald-500" />
                          <span>{metrics.kpis.totalUnits.toLocaleString('en-IN')} units sold</span>
                        </span>
                        {metrics.kpis.lowStockCount > 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200/60">
                            <Tag className="h-3.5 w-3.5 text-rose-500" />
                            <span>{metrics.kpis.lowStockCount} low stock alerts</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            <Tag className="h-3.5 w-3.5 text-emerald-500" />
                            <span>Inventory stable</span>
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {aiAnalytics?.dataQualityNote && (
                  <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center gap-1.5">
                    <span className="font-medium text-slate-500">Data Note:</span>
                    <span>{aiAnalytics.dataQualityNote}</span>
                  </div>
                )}
              </Card>

              {/* AI opportunities panel */}
              <Card className="rounded-3xl border border-slate-100/60 bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] h-full">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                  <CardTitle className="text-base font-semibold text-slate-850">AI Actionable Opportunities</CardTitle>
                </div>
                {aiAnalyticsLoading && !aiAnalytics ? (
                  <div className="grid grid-cols-1 gap-4">
                    <div className="h-20 bg-slate-100 rounded-xl animate-pulse" />
                    <div className="h-20 bg-slate-100 rounded-xl animate-pulse" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {aiAnalytics?.opportunities && aiAnalytics.opportunities.length > 0 ? (
                      aiAnalytics.opportunities.map((opp, idx) => (
                        <div key={idx} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/40 hover:bg-slate-50 transition-colors flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-semibold text-slate-800">{opp.title}</span>
                              <Badge className={`text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                opp.impact === 'high' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-blue-50 text-blue-700 border-blue-100'
                              }`}>
                                {opp.impact}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-500 leading-normal">{opp.detail}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400">No actionable opportunities identified.</p>
                    )}
                  </div>
                )}
              </Card>
            </div>

            {/* Risk alerts & anomalies */}
            {(aiAnalytics?.riskAlerts?.length || aiAnalytics?.anomalies?.length) ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Risks Card */}
                {aiAnalytics?.riskAlerts?.length ? (
                  <Card className="rounded-3xl border border-slate-100/60 bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] h-full">
                    <div className="flex items-center gap-2 mb-4">
                      <ShieldAlert className="h-5 w-5 text-rose-500" />
                      <CardTitle className="text-base font-semibold text-slate-850">AI Risk Alerts</CardTitle>
                    </div>
                    <div className="space-y-3">
                      {aiAnalytics.riskAlerts.map((risk, idx) => (
                        <div key={idx} className="p-3 rounded-xl border border-rose-100 bg-rose-50/20 text-slate-700 flex gap-2">
                          <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-rose-950">{risk.title}</p>
                            <p className="text-[11px] text-rose-800 leading-normal mt-0.5">{risk.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                ) : <div />}

                {/* Anomalies Card */}
                {aiAnalytics?.anomalies?.length ? (
                  <Card className="rounded-3xl border border-slate-100/60 bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] h-full">
                    <div className="flex items-center gap-2 mb-4">
                      <Zap className="h-5 w-5 text-violet-600" />
                      <CardTitle className="text-base font-semibold text-slate-850">AI Anomalies</CardTitle>
                    </div>
                    <div className="space-y-3">
                      {aiAnalytics.anomalies.map((anom, idx) => (
                        <div key={idx} className="p-3 rounded-xl border border-violet-100 bg-violet-50/20 text-slate-700 flex gap-2">
                          <Zap className="h-4 w-4 text-violet-500 shrink-0 mt-0.5 animate-pulse" />
                          <div>
                            <p className="text-xs font-semibold text-violet-950 uppercase tracking-wide">{anom.metric}</p>
                            <p className="text-[11px] text-violet-800 leading-normal mt-0.5">{anom.finding}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                ) : <div />}
              </div>
            ) : null}
          </div>
        )}
      </main>

      {/* ── Auto-Analyze Dataset Selection Dialog ── */}
      <Dialog open={showAnalyzeDialog} onOpenChange={setShowAnalyzeDialog}>
        <DialogContent className="max-w-md w-full rounded-3xl p-6 bg-white shadow-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">Select Dataset for AI analysis</DialogTitle>
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
                    ? 'border-blue-500 bg-blue-50/50 text-blue-900 shadow-sm shadow-blue-500/5'
                    : 'border-slate-150 bg-white hover:border-blue-200 hover:bg-blue-50/20 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold">{source.name}</p>
                    <p className="text-[10px] text-slate-450 mt-0.5">Type: {source.type}</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                    {source.status}
                  </span>
                </div>
              </button>
            ))}
            {dataSources.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">No data sources connected yet. Go to Connect Data to upload files.</p>
            )}
          </div>
          <DialogFooter className="mt-6 flex gap-2">
            <Button variant="outline" onClick={() => setShowAnalyzeDialog(false)} className="rounded-xl flex-1 border-slate-200 hover:bg-slate-50">
              Cancel
            </Button>
            <Button onClick={confirmAnalyze} disabled={isAnalyzing || !selectedDataSourceId} className="rounded-xl flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium">
              {isAnalyzing ? 'Analyzing...' : 'Run analysis'}
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
