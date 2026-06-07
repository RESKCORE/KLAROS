import type { ReactNode } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import type { MarketMetrics } from "@/features/market/utils/market-metrics";
import type { AiAnalytics } from "@/features/market/api/ai-analytics";
import {
  AlertTriangle,
  Sparkles,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Info,
  Zap,
  BarChart2,
} from "lucide-react";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const FORECAST_COLOR = "hsl(var(--chart-4))";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card className="h-full card-elevated">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-slate-900">{title}</CardTitle>
        {description ? <p className="text-sm text-slate-600">{description}</p> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// ─── AI Narrative Banner ──────────────────────────────────────────────────────

function AiNarrativeBanner({
  narrative,
  loading,
}: {
  narrative?: string;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card className="card-elevated border-primary/20 bg-primary/5">
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0 animate-pulse" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  if (!narrative) return null;
  return (
    <Card className="card-elevated border-primary/20 bg-primary/5">
      <CardContent className="pt-5">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-slate-700 leading-relaxed">{narrative}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── AI Opportunities Panel ───────────────────────────────────────────────────

function impactVariant(impact: string) {
  if (impact === "high") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (impact === "medium") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function ImpactIcon({ impact }: { impact: string }) {
  if (impact === "high") return <TrendingUp className="h-4 w-4 text-emerald-600" />;
  if (impact === "medium") return <Zap className="h-4 w-4 text-amber-600" />;
  return <BarChart2 className="h-4 w-4 text-slate-500" />;
}

function AiOpportunitiesPanel({
  opportunities,
  loading,
}: {
  opportunities?: AiAnalytics["opportunities"];
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            AI Opportunities
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }
  if (!opportunities?.length) return null;
  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-600" />
          AI-Identified Opportunities
        </CardTitle>
        <p className="text-sm text-slate-500">Actionable growth levers from your data</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {opportunities.map((opp, i) => (
          <div key={i} className={`rounded-xl border p-4 ${impactVariant(opp.impact)}`}>
            <div className="flex items-center gap-2 mb-1">
              <ImpactIcon impact={opp.impact} />
              <span className="font-semibold text-sm">{opp.title}</span>
              <span className="ml-auto text-xs uppercase font-bold tracking-wide opacity-70">
                {opp.impact} impact
              </span>
            </div>
            <p className="text-xs leading-relaxed opacity-90">{opp.detail}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── AI Risk Alerts Panel ─────────────────────────────────────────────────────

function severityIcon(severity: string) {
  if (severity === "critical") return <ShieldAlert className="h-4 w-4 text-red-600" />;
  if (severity === "warning") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <Info className="h-4 w-4 text-blue-500" />;
}

function severityClass(severity: string) {
  if (severity === "critical")
    return "border-red-200 bg-red-50/80 text-red-800";
  if (severity === "warning")
    return "border-amber-200 bg-amber-50/80 text-amber-800";
  return "border-blue-200 bg-blue-50/80 text-blue-800";
}

function AiRiskAlertsPanel({
  riskAlerts,
  loading,
}: {
  riskAlerts?: AiAnalytics["riskAlerts"];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    );
  }
  if (!riskAlerts?.length) return null;
  return (
    <div className="space-y-3">
      {riskAlerts.map((alert, i) => (
        <div key={i} className={`rounded-xl border p-4 flex items-start gap-3 ${severityClass(alert.severity)}`}>
          <div className="shrink-0 mt-0.5">{severityIcon(alert.severity)}</div>
          <div>
            <p className="font-semibold text-sm">{alert.title}</p>
            <p className="text-xs mt-0.5 opacity-90 leading-relaxed">{alert.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── AI Anomalies Panel ───────────────────────────────────────────────────────

function AiAnomaliesPanel({
  anomalies,
}: {
  anomalies?: AiAnalytics["anomalies"];
}) {
  if (!anomalies?.length) return null;
  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <Zap className="h-4 w-4 text-violet-600" />
          AI-Detected Anomalies
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {anomalies.map((a, i) => (
            <div key={i} className="rounded-lg border border-violet-100 bg-violet-50/70 px-4 py-3 flex items-start gap-3">
              <span className="text-xs font-semibold text-violet-700 mt-0.5 shrink-0 uppercase tracking-wide">
                {a.metric}
              </span>
              <span className="text-xs text-violet-800 leading-relaxed">{a.finding}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── AI Forecast Chart ────────────────────────────────────────────────────────

function AiForecastChart({
  actuals,
  forecasts,
  loading,
}: {
  actuals: MarketMetrics["revenueByDate"];
  forecasts?: AiAnalytics["forecasts"];
  loading: boolean;
}) {
  // Combine actuals + forecasts for a unified chart
  const combinedData = [
    ...actuals.map((d) => ({
      date: d.date,
      revenue: d.revenue,
      forecastedRevenue: undefined as number | undefined,
      confidence: undefined as number | undefined,
      isForecast: false,
    })),
    ...(forecasts ?? []).map((f) => ({
      date: f.month,
      revenue: undefined as number | undefined,
      forecastedRevenue: f.forecastedRevenue,
      confidence: f.confidence,
      isForecast: true,
    })),
  ];

  if (loading) {
    return (
      <div className="h-72 flex items-center justify-center">
        <div className="text-center space-y-2">
          <Sparkles className="h-6 w-6 text-primary mx-auto animate-pulse" />
          <p className="text-xs text-muted-foreground">Generating AI revenue forecast…</p>
        </div>
      </div>
    );
  }

  if (!forecasts?.length) return null;

  // Separator between actuals and forecasts
  const splitDate = forecasts[0]?.month;

  return (
    <div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={combinedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value: number, name: string) =>
                name === "revenue"
                  ? [currencyFormatter.format(value), "Actual Revenue"]
                  : [currencyFormatter.format(value), "AI Forecast"]
              }
            />
            <Legend />
            {splitDate && (
              <ReferenceLine
                x={splitDate}
                stroke="#94a3b8"
                strokeDasharray="6 3"
                label={{ value: "Forecast →", position: "insideTopRight", fontSize: 10, fill: "#94a3b8" }}
              />
            )}
            <Line
              type="monotone"
              dataKey="revenue"
              stroke={COLORS[0]}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="forecastedRevenue"
              stroke={FORECAST_COLOR}
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={{ r: 4, fill: FORECAST_COLOR }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] text-slate-400 mt-2 text-right">
        ✦ AI forecast — trend-inferred estimate, not a statistical model.
        {forecasts[0]?.confidence ? ` Confidence: ${forecasts[0].confidence}%` : ""}
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MarketResults({
  metrics,
  aiAnalytics,
  aiAnalyticsLoading = false,
}: {
  metrics: MarketMetrics;
  aiAnalytics?: AiAnalytics | null;
  aiAnalyticsLoading?: boolean;
}) {
  const isInventoryOnly = metrics.kpis.dataType === "inventory_only";

  const dateRangeLabel = (() => {
    const dates = metrics.revenueByDate;
    if (!dates || dates.length === 0) return null;
    const first = dates[0].date;
    const last = dates[dates.length - 1].date;
    if (first === last) return formatDateLabel(first);
    return `${formatDateLabel(first)} - ${formatDateLabel(last)}`;
  })();

  return (
    <div className="space-y-8">
      {/* Inventory-only warning */}
      {isInventoryOnly && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Inventory / Product Data Only</AlertTitle>
          <AlertDescription>
            This dataset contains product and pricing information but no sales transactions. Revenue,
            units sold, and profit figures shown below are <strong>estimated</strong> from product
            prices and typical volume assumptions. For accurate transactional metrics, upload a
            dataset with sales records including revenue, quantity, and date fields.
          </AlertDescription>
        </Alert>
      )}

      {/* ── AI Narrative Banner ── */}
      <AiNarrativeBanner
        narrative={aiAnalytics?.narrative}
        loading={aiAnalyticsLoading && !aiAnalytics?.narrative}
      />

      {/* ── Performance KPIs ── */}
      <Card className="card-elevated">
        <CardHeader>
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">Performance summary</CardTitle>
            <p className="text-sm text-slate-600">View your key performance metrics</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4">
              <p className="text-xs text-emerald-700">Total Revenue {isInventoryOnly ? "(est.)" : ""}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 num-display">
                {currencyFormatter.format(metrics.kpis.totalRevenue)}
              </p>
              <p className="text-xs text-emerald-700">+{metrics.kpis.profitMarginPct}% margin</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Total Profit {isInventoryOnly ? "(est.)" : ""}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 num-display">
                {currencyFormatter.format(metrics.kpis.totalProfit)}
              </p>
              <p className="text-xs text-slate-500">After cost of goods</p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4">
              <p className="text-xs text-amber-700">Units Sold {isInventoryOnly ? "(est.)" : ""}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 num-display">
                {numberFormatter.format(metrics.kpis.totalUnits)}
              </p>
              <p className="text-xs text-amber-700">Across active SKUs</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">
                {isInventoryOnly ? "Inventory Value" : "Low Stock SKUs"}
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 num-display">
                {isInventoryOnly
                  ? currencyFormatter.format(metrics.kpis.inventoryValue)
                  : metrics.kpis.lowStockCount}
              </p>
              <p className="text-xs text-slate-500">
                {isInventoryOnly ? "Total cost value" : "At or below reorder point"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── AI Risk Alerts ── */}
      <AiRiskAlertsPanel
        riskAlerts={aiAnalytics?.riskAlerts}
        loading={aiAnalyticsLoading && !aiAnalytics?.riskAlerts}
      />

      {/* Low-stock system alert */}
      {metrics.kpis.lowStockCount > 0 ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Low stock alert</AlertTitle>
          <AlertDescription>
            {metrics.kpis.lowStockCount} SKUs are at or below the reorder point. Review the
            inventory watchlist and place replenishment orders.
          </AlertDescription>
        </Alert>
      ) : null}

      {/* ── Revenue Trend + AI Forecast ── */}
      <Card className="card-elevated">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">Total balance</CardTitle>
            <p className="text-sm text-slate-600">Revenue vs units volume</p>
          </div>
          {dateRangeLabel ? (
            <div className="rounded-full border border-border/60 bg-white px-3 py-1 text-xs text-slate-500">
              {dateRangeLabel}
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div className="text-3xl font-semibold text-slate-900 num-display">
              {currencyFormatter.format(metrics.kpis.totalRevenue)}
            </div>
            <div className="text-sm text-emerald-700">+{metrics.kpis.profitMarginPct}%</div>
          </div>
          {/* Actuals + AI Forecast combined */}
          {aiAnalytics?.forecasts?.length ? (
            <div className="mt-6">
              <AiForecastChart
                actuals={metrics.revenueByDate}
                forecasts={aiAnalytics.forecasts}
                loading={false}
              />
            </div>
          ) : aiAnalyticsLoading ? (
            <div className="mt-6">
              <AiForecastChart
                actuals={metrics.revenueByDate}
                forecasts={undefined}
                loading={true}
              />
            </div>
          ) : (
            <div className="mt-6 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={metrics.revenueByDate}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number, name: string) =>
                      name === "revenue"
                        ? [currencyFormatter.format(value), "Revenue"]
                        : [numberFormatter.format(value), "Units"]
                    }
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="revenue"
                    stroke={COLORS[0]}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="units"
                    stroke={COLORS[2]}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── AI Opportunities & Anomalies ── */}
      <div className="grid gap-6 xl:grid-cols-2">
        <AiOpportunitiesPanel
          opportunities={aiAnalytics?.opportunities}
          loading={aiAnalyticsLoading && !aiAnalytics?.opportunities}
        />
        <AiAnomaliesPanel anomalies={aiAnalytics?.anomalies} />
      </div>

      {/* ── Category + Payment charts ── */}
      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Revenue by Category" description="Top category contribution">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.revenueByCategory.slice(0, 6)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => currencyFormatter.format(value)} />
                <Bar dataKey="revenue" fill={COLORS[1]} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title={metrics.paymentLabel || "Payment Method Mix"}
          description={metrics.paymentLabel ? "Revenue share by location" : "Revenue share by payment type"}
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={metrics.paymentMethodShare}
                  dataKey="revenue"
                  nameKey="method"
                  innerRadius={55}
                  outerRadius={100}
                  paddingAngle={4}
                >
                  {metrics.paymentMethodShare.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => currencyFormatter.format(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* ── Radar + ROI + Inventory health ── */}
      <div className="grid gap-6 xl:grid-cols-3">
        <ChartCard title="Category Performance Radar" description="Normalized comparison of top categories">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={metrics.categoryRadar}>
                <PolarGrid />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                {metrics.categoryNames.map((category, index) => (
                  <Radar
                    key={category}
                    name={category}
                    dataKey={category}
                    stroke={COLORS[index % COLORS.length]}
                    fill={COLORS[index % COLORS.length]}
                    fillOpacity={0.2}
                  />
                ))}
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Investment ROI" description="Expected vs actual returns">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={metrics.investmentRoi}
                margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => `${value}%`} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="expected"
                  stroke={COLORS[3]}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke={COLORS[4]}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Inventory Health" description="Average discount and active coverage">
          <div className="grid gap-4">
            <div className="rounded-xl border border-border/60 bg-white p-4">
              <p className="text-xs text-slate-500">Avg Discount</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 num-display">
                {metrics.kpis.avgDiscount}%
              </p>
              <p className="text-xs text-slate-500">Average per transaction</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-white p-4">
              <p className="text-xs text-slate-500">Active SKUs</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 num-display">
                {metrics.kpis.skuCount}
              </p>
              <p className="text-xs text-slate-500">Products with sales</p>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* ── Top Products + Inventory Watchlist ── */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Top Products</CardTitle>
            <p className="text-sm text-muted-foreground">Highest revenue contributors</p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.topProducts.map((product, index) => (
                  <TableRow key={`prod-${index}-${product.sku}`}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-right num-display">
                      {currencyFormatter.format(product.revenue)}
                    </TableCell>
                    <TableCell className="text-right num-display">
                      {numberFormatter.format(product.units)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={product.marginPct >= 25 ? "default" : "secondary"}>
                        {product.marginPct}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Inventory Watchlist</CardTitle>
            <p className="text-sm text-muted-foreground">Lowest stock-to-reorder ratios</p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Reorder</TableHead>
                  <TableHead className="text-right">Ratio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.inventory.map((item, index) => (
                  <TableRow key={`inv-${index}-${item.sku}`}>
                    <TableCell className="font-medium">{item.sku}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className="text-right num-display">{item.beginningStock}</TableCell>
                    <TableCell className="text-right num-display">{item.reorderPoint}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={item.stockRatio <= 1 ? "destructive" : "outline"}>
                        {item.stockRatio}x
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Data quality note */}
      {aiAnalytics?.dataQualityNote && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 flex items-start gap-2">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{aiAnalytics.dataQualityNote}</span>
        </div>
      )}
    </div>
  );
}
