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
import type { MarketMetrics } from "@/lib/market-metrics";
import { AlertTriangle } from "lucide-react";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

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

export function MarketResults({ metrics }: { metrics: MarketMetrics }) {
  return (
    <div className="space-y-8">
      <Card className="card-elevated">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">Performance summary</CardTitle>
            <p className="text-sm text-slate-600">View your key performance metrics</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-lg border border-border/60 bg-white px-2.5 py-1 text-xs text-slate-500">
              30d
            </button>
            <button className="rounded-lg border border-border/60 bg-white px-2.5 py-1 text-xs text-slate-500">
              90d
            </button>
            <button className="rounded-lg border border-border/60 bg-white px-2.5 py-1 text-xs text-slate-500">
              YTD
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4">
              <p className="text-xs text-emerald-700">Total Revenue</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 num-display">
                 {currencyFormatter.format(metrics.kpis.totalRevenue)}
              </p>
              <p className="text-xs text-emerald-700">+{metrics.kpis.profitMarginPct}% margin</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Total Profit</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 num-display">
                 {currencyFormatter.format(metrics.kpis.totalProfit)}
              </p>
              <p className="text-xs text-slate-500">After cost of goods</p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4">
              <p className="text-xs text-amber-700">Units Sold</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 num-display">
                 {numberFormatter.format(metrics.kpis.totalUnits)}
              </p>
              <p className="text-xs text-amber-700">Across active SKUs</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Low Stock SKUs</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 num-display">
                 {metrics.kpis.lowStockCount}
              </p>
              <p className="text-xs text-slate-500">At or below reorder point</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {metrics.kpis.lowStockCount > 0 ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Low stock alert</AlertTitle>
          <AlertDescription>
            {metrics.kpis.lowStockCount} SKUs are at or below the reorder point. Review the inventory watchlist
            and place replenishment orders.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="card-elevated">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">Total balance</CardTitle>
            <p className="text-sm text-slate-600">Revenue vs units volume</p>
          </div>
          <div className="rounded-full border border-border/60 bg-white px-3 py-1 text-xs text-slate-500">
            Jan 2025 - Mar 2025
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div className="text-3xl font-semibold text-slate-900 num-display">
              {currencyFormatter.format(metrics.kpis.totalRevenue)}
            </div>
            <div className="text-sm text-emerald-700">+{metrics.kpis.profitMarginPct}%</div>
          </div>
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.revenueByDate} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
        </CardContent>
      </Card>

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
              <LineChart data={metrics.investmentRoi} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => `${value}%`} />
                <Legend />
                <Line type="monotone" dataKey="expected" stroke={COLORS[3]} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="actual" stroke={COLORS[4]} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Inventory Health" description="Average discount and active coverage">
          <div className="grid gap-4">
            <div className="rounded-xl border border-border/60 bg-white p-4">
              <p className="text-xs text-slate-500">Avg Discount</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 num-display">{metrics.kpis.avgDiscount}%</p>
              <p className="text-xs text-slate-500">Average per transaction</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-white p-4">
              <p className="text-xs text-slate-500">Active SKUs</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 num-display">{metrics.kpis.skuCount}</p>
              <p className="text-xs text-slate-500">Products with sales</p>
            </div>
          </div>
        </ChartCard>
      </div>

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
                {metrics.topProducts.map((product) => (
                  <TableRow key={product.sku}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-right num-display">{currencyFormatter.format(product.revenue)}</TableCell>
                    <TableCell className="text-right num-display">{numberFormatter.format(product.units)}</TableCell>
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
                {metrics.inventory.map((item) => (
                  <TableRow key={item.sku}>
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
    </div>
  );
}
