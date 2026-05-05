import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth, useUser } from "@clerk/react";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar, Archive, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { deleteDecision, getUserDecisions } from "@/lib/decision-store";
import { getCachedDataSources, getDataSources, getMarketMetricsForSource } from "@/lib/bi-api";
import { getCachedMarketHistory, loadMarketHistory } from "@/lib/market-metrics";
import type { Decision } from "@/types/decision";
import type { MarketHistory } from "@/lib/market-metrics";
import type { MarketMetrics } from "@/lib/market-metrics";
import type { DataSourceSummary } from "@/lib/bi-api";

export default function History() {
  const { toast } = useToast();
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [dataSources, setDataSources] = useState<DataSourceSummary[]>([]);
  const [isLoadingSources, setIsLoadingSources] = useState(true);
  const [metricsBySource, setMetricsBySource] = useState<Record<string, MarketMetrics>>({});
  const [metricsLoadingBySource, setMetricsLoadingBySource] = useState<Record<string, boolean>>({});
  const [metricsErrorBySource, setMetricsErrorBySource] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [datasetFilter, setDatasetFilter] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"timeline" | "feed" | "metrics">("timeline");
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const cachedHistory = getCachedMarketHistory("dataset1", 3);
  const [historyMetrics, setHistoryMetrics] = useState<MarketHistory | null>(cachedHistory);
  const [historyLoading, setHistoryLoading] = useState(!cachedHistory);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const currencyFormatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });

  useEffect(() => {
    if (isLoaded && user) {
      loadDecisions();
      void loadSources();
    }
  }, [isLoaded, user]);

  async function loadSources() {
    if (!user?.id) {
      setDataSources([]);
      return;
    }

    const cachedSources = getCachedDataSources();
    if (cachedSources) {
      setDataSources(cachedSources);
      setIsLoadingSources(false);
    }

    try {
      const sources = await getDataSources();
      setDataSources(sources);
    } catch (error) {
      console.error("Error loading data sources:", error);
    } finally {
      setIsLoadingSources(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadHistoryMetrics() {
      try {
        if (!cachedHistory) {
          setHistoryLoading(true);
        }
        setHistoryError(null);
        const data = await loadMarketHistory("dataset1", 3);
        if (isMounted) {
          setHistoryMetrics(data);
        }
      } catch (error) {
        console.error("Error loading history metrics:", error);
        if (isMounted) {
          setHistoryError("Unable to load synthetic history metrics.");
        }
      } finally {
        if (isMounted) {
          setHistoryLoading(false);
        }
      }
    }

    loadHistoryMetrics();

    return () => {
      isMounted = false;
    };
  }, []);

  async function loadDecisions() {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const data = await getUserDecisions(user.id, {}, getToken);
      // Sort by date, newest first
      const sorted = data.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setDecisions(sorted);
    } catch (error) {
      console.error("Error loading decisions:", error);
      toast({
        title: "Error",
        description: "Failed to load decision history. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const sourceIds = Array.from(
      new Set(decisions.map((decision) => decision.data_source_id).filter(Boolean) as string[])
    );
    if (sourceIds.length === 0) return;

    const missing = sourceIds.filter(
      (id) => !metricsBySource[id] && !metricsLoadingBySource[id]
    );
    if (missing.length === 0) return;

    missing.forEach((id) => {
      setMetricsLoadingBySource((prev) => ({ ...prev, [id]: true }));
    });

    void Promise.all(
      missing.map(async (id) => {
        try {
          const metrics = await getMarketMetricsForSource(id);
          setMetricsBySource((prev) => ({ ...prev, [id]: metrics }));
        } catch (error) {
          console.error("Error loading dataset metrics:", error);
          setMetricsErrorBySource((prev) => ({
            ...prev,
            [id]: "Unable to load metrics",
          }));
        } finally {
          setMetricsLoadingBySource((prev) => ({ ...prev, [id]: false }));
        }
      })
    );
  }, [decisions, metricsBySource, metricsLoadingBySource]);

  async function handleDelete(decisionId: string) {
    if (!user?.id) {
      return;
    }

    setIsDeleting(decisionId);
    try {
      await deleteDecision(decisionId, getToken);
      setDecisions((prev) => prev.filter((item) => item.id !== decisionId));
      toast({
        title: "Analysis removed",
        description: "The analysis has been deleted.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to remove analysis.";
      toast({
        title: "Unable to remove analysis",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(null);
    }
  }

  const dataSourceNameById = useMemo(
    () => new Map(dataSources.map((source) => [source.id, source.name])),
    [dataSources]
  );

  const getDecisionLabel = (decision: Decision) => {
    if (!decision.data_source_id) return decision.title;
    return dataSourceNameById.get(decision.data_source_id) || decision.title;
  };

  const filteredDecisions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const now = Date.now();
    const cutoffMap: Record<string, number> = {
      "7d": now - 7 * 24 * 60 * 60 * 1000,
      "30d": now - 30 * 24 * 60 * 60 * 1000,
      "90d": now - 90 * 24 * 60 * 60 * 1000,
    };
    const cutoff = cutoffMap[timeFilter];

    return decisions.filter((decision) => {
      if (statusFilter !== "all" && decision.status !== statusFilter) {
        return false;
      }
      if (datasetFilter !== "all" && decision.data_source_id !== datasetFilter) {
        return false;
      }
      if (cutoff) {
        const updated = new Date(decision.updated_at).getTime();
        if (Number.isNaN(updated) || updated < cutoff) {
          return false;
        }
      }
      if (!query) return true;
      const label = getDecisionLabel(decision).toLowerCase();
      return label.includes(query) || decision.title.toLowerCase().includes(query);
    });
  }, [decisions, searchQuery, statusFilter, datasetFilter, timeFilter, dataSourceNameById]);

  const groupedDecisions = useMemo(() => {
    const groups = new Map<string, Decision[]>();
    filteredDecisions.forEach((decision) => {
      const key = decision.data_source_id || "unlinked";
      const bucket = groups.get(key) ?? [];
      bucket.push(decision);
      groups.set(key, bucket);
    });
    groups.forEach((items) =>
      items.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    );
    return Array.from(groups.entries()).sort(([a], [b]) => {
      const nameA = a === "unlinked" ? "Unlinked" : dataSourceNameById.get(a) || a;
      const nameB = b === "unlinked" ? "Unlinked" : dataSourceNameById.get(b) || b;
      return nameA.localeCompare(nameB);
    });
  }, [filteredDecisions, dataSourceNameById]);

  const orderedDecisions = useMemo(
    () => [...filteredDecisions].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [filteredDecisions]
  );

  const compareDecisions = useMemo(
    () => compareIds.map((id) => decisions.find((decision) => decision.id === id)).filter(Boolean) as Decision[],
    [compareIds, decisions]
  );

  const getDecisionMetrics = (decision: Decision) => {
    if (!decision.data_source_id) return null;
    return metricsBySource[decision.data_source_id] ?? null;
  };

  const getKpiSummary = (decision: Decision) => {
    const metrics = getDecisionMetrics(decision);
    if (!metrics) return null;
    const topCategory = metrics.revenueByCategory?.[0]?.category || "-";
    const topProduct = metrics.topProducts?.[0]?.name || "-";
    return {
      marginPct: metrics.kpis.profitMarginPct,
      lowStock: metrics.kpis.lowStockCount,
      topCategory,
      topProduct,
    };
  };

  const toggleCompare = (decisionId: string) => {
    setCompareIds((prev) => {
      if (prev.includes(decisionId)) {
        return prev.filter((id) => id !== decisionId);
      }
      if (prev.length >= 2) {
        return [prev[1], decisionId];
      }
      return [...prev, decisionId];
    });
  };

  useEffect(() => {
    if (!compareEnabled && compareIds.length > 0) {
      setCompareIds([]);
    }
  }, [compareEnabled, compareIds.length]);

  return (
    <div className="min-h-screen flex bg-background">
      <DashboardSidebar />

      <div className="flex-1 flex flex-col">
        <div className="relative border-b bg-gradient-to-b from-muted/30 to-background">
          <div className="absolute inset-0 bg-mesh opacity-20" />
          <div className="container relative py-10">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
                  <Archive className="h-8 w-8 text-primary" />
                  Decision History
                </h1>
                <p className="text-muted-foreground max-w-lg">
                  View past BI analyses with quick status and access to results.
                </p>
              </div>
            </div>
          </div>
        </div>

        <main className="flex-1 container py-10">
          <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
            <aside className="space-y-6">
              <section className="rounded-2xl border bg-card p-5 card-elevated">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">History controls</h2>
                    <p className="text-xs text-muted-foreground">Search, filter, and pivot views.</p>
                  </div>
                  <Badge variant="outline">Live</Badge>
                </div>
                <div className="mt-4 space-y-3">
                  <Input
                    placeholder="Search decisions..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="pl-4 h-11 bg-background/50 border-border/60 focus:bg-background transition-colors"
                  />
                  <select
                    className="h-11 rounded-md border border-border/60 bg-background px-3 text-sm"
                    value={datasetFilter}
                    onChange={(event) => setDatasetFilter(event.target.value)}
                    disabled={isLoadingSources}
                  >
                    <option value="all">All datasets</option>
                    {dataSources.map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-11 rounded-md border border-border/60 bg-background px-3 text-sm"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="all">All statuses</option>
                    <option value="done">Done</option>
                    <option value="analyzing">Analyzing</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                  </select>
                  <select
                    className="h-11 rounded-md border border-border/60 bg-background px-3 text-sm"
                    value={timeFilter}
                    onChange={(event) => setTimeFilter(event.target.value)}
                  >
                    <option value="all">Any time</option>
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                  </select>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant={viewMode === "timeline" ? "default" : "outline"}
                    onClick={() => setViewMode("timeline")}
                  >
                    Timeline
                  </Button>
                  <Button
                    size="sm"
                    variant={viewMode === "feed" ? "default" : "outline"}
                    onClick={() => setViewMode("feed")}
                  >
                    Feed
                  </Button>
                  <Button
                    size="sm"
                    variant={viewMode === "metrics" ? "default" : "outline"}
                    onClick={() => setViewMode("metrics")}
                  >
                    Metrics
                  </Button>
                  <Button
                    size="sm"
                    variant={compareEnabled ? "default" : "outline"}
                    onClick={() => setCompareEnabled((prev) => !prev)}
                  >
                    {compareEnabled ? "Compare on" : "Compare"}
                  </Button>
                </div>
                {!isLoading && filteredDecisions.length > 0 && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Showing {filteredDecisions.length} of {decisions.length} decisions
                  </p>
                )}
              </section>

              <section className="rounded-2xl border bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-800 p-5 text-white card-elevated">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-100/80">Market pulse</h3>
                <p className="mt-2 text-sm text-emerald-100/80">
                  Last 3 months of synthetic KPIs for fast context.
                </p>
                {historyError ? (
                  <p className="mt-3 text-xs text-rose-200">{historyError}</p>
                ) : null}
                {historyLoading ? (
                  <p className="mt-3 text-xs text-emerald-100/70">Loading metrics...</p>
                ) : null}
                {historyMetrics && !historyLoading ? (
                  <div className="mt-4 space-y-3">
                    {historyMetrics.months.map((month) => {
                      const label = new Date(`${month.month}-01`).toLocaleString("en-IN", {
                        month: "short",
                        year: "numeric",
                      });
                      return (
                        <div key={month.month} className="rounded-xl border border-white/10 bg-white/5 p-3">
                          <div className="flex items-center justify-between text-xs text-emerald-100/80">
                            <span>{label}</span>
                            <span>{month.marginPct}% margin</span>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-sm">
                            <span>Revenue</span>
                            <span className="font-semibold">{currencyFormatter.format(month.revenue)}</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-xs text-emerald-100/80">
                            <span>Low stock</span>
                            <span>{month.lowStockCount} SKUs</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            </aside>

            <section className="space-y-6">
              <div className="rounded-3xl border bg-card/80 p-6 card-elevated">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold">Decision Atlas</h2>
                    <p className="text-sm text-muted-foreground">
                      A high-signal archive of BI analyses, grouped by dataset.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">Default: Timeline</Badge>
                    <Badge variant="secondary">KPIs: Margin, Low stock, Top category, Top product</Badge>
                  </div>
                </div>
              </div>

              {!isLoaded || isLoading ? (
                <div className="text-center py-20">
                  <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 mb-4">
                    <div className="h-8 w-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
                  </div>
                  <p className="text-muted-foreground font-medium">Loading history...</p>
                </div>
              ) : filteredDecisions.length === 0 ? (
                <div className="text-center py-20 bg-muted/20 rounded-2xl border border-dashed border-border/60 card-elevated">
                  <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-muted mb-4">
                    <Archive className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">
                    {searchQuery ? "No matching decisions" : "No decision history"}
                  </h3>
                  <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                    {searchQuery
                      ? "Try adjusting your search."
                      : "Your decision history will appear here once you run auto-analysis."}
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {compareEnabled && compareIds.length > 0 ? (
                    <section className="rounded-2xl border bg-card p-5 card-elevated">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold">Compare analyses</h3>
                          <p className="text-xs text-muted-foreground">Select up to two analyses to compare.</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setCompareIds([])}>
                          Clear
                        </Button>
                      </div>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        {compareDecisions.map((decision) => {
                          const metrics = getKpiSummary(decision);
                          return (
                            <div key={decision.id} className="rounded-xl border bg-muted/20 p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-semibold">{getDecisionLabel(decision)}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Updated {formatDistanceToNow(new Date(decision.updated_at), { addSuffix: true })}
                                  </p>
                                </div>
                                <Badge variant="secondary">{decision.status}</Badge>
                              </div>
                              <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                                <div>Margin: {metrics ? `${metrics.marginPct}%` : "-"}</div>
                                <div>Low stock: {metrics ? metrics.lowStock : "-"}</div>
                                <div>Top category: {metrics?.topCategory ?? "-"}</div>
                                <div>Top product: {metrics?.topProduct ?? "-"}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ) : null}

                  {viewMode === "timeline" ? (
                    <section className="space-y-4">
                      {groupedDecisions.map(([datasetId, items]) => {
                        const datasetName = datasetId === "unlinked"
                          ? "Unlinked"
                          : dataSourceNameById.get(datasetId) || datasetId;
                        return (
                          <div key={datasetId} className="rounded-2xl border bg-card p-5 card-elevated">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="text-base font-semibold">{datasetName}</h3>
                                <p className="text-xs text-muted-foreground">{items.length} analyses</p>
                              </div>
                              <Badge variant="outline">Dataset</Badge>
                            </div>
                            <div className="mt-4 space-y-3">
                              {items.map((decision) => {
                                const metrics = getKpiSummary(decision);
                                return (
                                  <div key={decision.id} className="rounded-xl border bg-muted/20 p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-4">
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          {compareEnabled ? (
                                            <input
                                              type="checkbox"
                                              checked={compareIds.includes(decision.id)}
                                              onChange={() => toggleCompare(decision.id)}
                                              className="h-4 w-4 rounded border-border/60"
                                            />
                                          ) : null}
                                          <p className="font-semibold truncate">{getDecisionLabel(decision)}</p>
                                          <Badge variant="secondary" className="capitalize">
                                            {decision.status}
                                          </Badge>
                                        </div>
                                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                          <Calendar className="h-3.5 w-3.5" />
                                          <span>Updated {new Date(decision.updated_at).toLocaleDateString()}</span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                            <Button size="sm" variant="outline">
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent>
                                            <AlertDialogHeader>
                                              <AlertDialogTitle>Remove analysis?</AlertDialogTitle>
                                              <AlertDialogDescription>
                                                This will permanently delete this analysis and its results.
                                              </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                                              <AlertDialogAction
                                                onClick={() => handleDelete(decision.id)}
                                                disabled={isDeleting === decision.id}
                                              >
                                                {isDeleting === decision.id ? "Removing..." : "Remove"}
                                              </AlertDialogAction>
                                            </AlertDialogFooter>
                                          </AlertDialogContent>
                                        </AlertDialog>
                                        <Button size="sm" asChild>
                                          <Link to={`/decisions/${decision.id}/result`}>View Results</Link>
                                        </Button>
                                      </div>
                                    </div>
                                    <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                                      <div>Margin: {metrics ? `${metrics.marginPct}%` : "-"}</div>
                                      <div>Low stock: {metrics ? metrics.lowStock : "-"}</div>
                                      <div>Top category: {metrics?.topCategory ?? "-"}</div>
                                      <div>Top product: {metrics?.topProduct ?? "-"}</div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </section>
                  ) : null}

                  {viewMode === "feed" ? (
                    <section className="space-y-3">
                      {orderedDecisions.map((decision) => {
                        const metrics = getKpiSummary(decision);
                        return (
                          <div key={decision.id} className="rounded-xl border bg-card/70 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                {compareEnabled ? (
                                  <input
                                    type="checkbox"
                                    checked={compareIds.includes(decision.id)}
                                    onChange={() => toggleCompare(decision.id)}
                                    className="h-4 w-4 rounded border-border/60"
                                  />
                                ) : null}
                                <p className="font-semibold">{getDecisionLabel(decision)}</p>
                                <Badge variant="secondary" className="capitalize">
                                  {decision.status}
                                </Badge>
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                Updated {formatDistanceToNow(new Date(decision.updated_at), { addSuffix: true })}
                              </div>
                              <div className="mt-2 text-xs text-muted-foreground">
                                Margin {metrics ? `${metrics.marginPct}%` : "-"} · Low stock {metrics ? metrics.lowStock : "-"} ·
                                Top category {metrics?.topCategory ?? "-"} · Top product {metrics?.topProduct ?? "-"}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button size="sm" asChild>
                                <Link to={`/decisions/${decision.id}/result`}>View Results</Link>
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </section>
                  ) : null}

                  {viewMode === "metrics" ? (
                    <section className="rounded-2xl border bg-card p-5 card-elevated">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Analysis</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Margin</TableHead>
                            <TableHead>Low stock</TableHead>
                            <TableHead>Top category</TableHead>
                            <TableHead>Top product</TableHead>
                            <TableHead>Updated</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {orderedDecisions.map((decision) => {
                            const metrics = getKpiSummary(decision);
                            return (
                              <TableRow key={decision.id}>
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    {compareEnabled ? (
                                      <input
                                        type="checkbox"
                                        checked={compareIds.includes(decision.id)}
                                        onChange={() => toggleCompare(decision.id)}
                                        className="h-4 w-4 rounded border-border/60"
                                      />
                                    ) : null}
                                    <Link to={`/decisions/${decision.id}/result`} className="hover:text-primary">
                                      {getDecisionLabel(decision)}
                                    </Link>
                                  </div>
                                </TableCell>
                                <TableCell className="capitalize">{decision.status}</TableCell>
                                <TableCell>{metrics ? `${metrics.marginPct}%` : "-"}</TableCell>
                                <TableCell>{metrics ? metrics.lowStock : "-"}</TableCell>
                                <TableCell>{metrics?.topCategory ?? "-"}</TableCell>
                                <TableCell>{metrics?.topProduct ?? "-"}</TableCell>
                                <TableCell>{new Date(decision.updated_at).toLocaleDateString()}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </section>
                  ) : null}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
