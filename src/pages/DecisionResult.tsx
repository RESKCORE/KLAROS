import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { formatDistanceToNow } from "date-fns";
import { AnalysisLoader } from "@/components/results/AnalysisLoader";
import { MarketResults } from "@/components/results/MarketCharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import { getDecision } from "@/lib/decision-store";
import { getCachedDataSources, getDataSources, getMarketMetricsForSource } from "@/lib/bi-api";
import type { Decision } from "@/types/decision";
import type { MarketMetrics } from "@/lib/market-metrics";
import type { DataSourceSummary } from "@/lib/bi-api";

export default function DecisionResult() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getToken } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<MarketMetrics | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [dataSourceName, setDataSourceName] = useState<string | null>(null);
  const [dataSourceDetails, setDataSourceDetails] = useState<DataSourceSummary | null>(null);

  useEffect(() => {
    if (!id) {
      navigate("/dashboard");
      return;
    }

    loadDecision();
  }, [id]);

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
        console.error("Error loading market metrics:", err);
        if (isMounted) {
          setMetricsError("Unable to load market metrics.");
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

  useEffect(() => {
    let isMounted = true;

    async function loadDataSourceName(dataSourceId: string) {
      const cached = getCachedDataSources();
      const cachedMatch = cached?.find((source) => source.id === dataSourceId);
      if (cachedMatch?.name) {
        if (isMounted) {
          setDataSourceName(cachedMatch.name);
          setDataSourceDetails(cachedMatch);
        }
        return;
      }

      try {
        const sources = await getDataSources();
        const match = sources.find((source) => source.id === dataSourceId);
        if (isMounted) {
          setDataSourceName(match?.name ?? null);
          setDataSourceDetails(match ?? null);
        }
      } catch (err) {
        console.warn("Unable to resolve data source name", err);
        if (isMounted) {
          setDataSourceName(null);
          setDataSourceDetails(null);
        }
      }
    }

    if (decision?.data_source_id) {
      loadDataSourceName(decision.data_source_id);
    } else if (isMounted) {
      setDataSourceName(null);
      setDataSourceDetails(null);
    }

    return () => {
      isMounted = false;
    };
  }, [decision?.data_source_id]);

  const typeLabel = (() => {
    if (dataSourceDetails?.isSynthetic) return "Prototype";
    switch (dataSourceDetails?.type) {
      case "csv":
        return "CSV upload";
      case "google_sheets":
        return "Google Sheets";
      case "supermarket_products":
        return "Supermarket";
      default:
        return dataSourceDetails?.type ? dataSourceDetails.type.replace(/_/g, " ") : null;
    }
  })();

  const statusLabel = (() => {
    switch (dataSourceDetails?.status) {
      case "connected":
        return "Connected";
      case "syncing":
        return "Syncing";
      case "error":
        return "Issue";
      default:
        return dataSourceDetails?.status ?? null;
    }
  })();

  const syncedLabel = (() => {
    if (!dataSourceDetails?.lastSyncedAt) return null;
    const date = new Date(dataSourceDetails.lastSyncedAt);
    if (Number.isNaN(date.getTime())) return null;
    return formatDistanceToNow(date, { addSuffix: true });
  })();

  const countsLabel = (() => {
    const counts = dataSourceDetails?.counts;
    if (!counts) return null;
    return `P ${counts.products} • S ${counts.salesHistory} • St ${counts.stockMovements} • Inv ${counts.investments}`;
  })();

  async function loadDecision() {
    try {
      setIsLoading(true);
      setError(null);

      const decisionData = await getDecision(id!, getToken);
      setDecision(decisionData);

    } catch (err) {
      console.error("Error loading decision:", err);
      setError(err instanceof Error ? err.message : "Failed to load decision");
      toast({
        title: "Error",
        description: "Failed to load decision. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex bg-background">
        <DashboardSidebar />
        <div className="flex-1 flex items-center justify-center">
          <AnalysisLoader />
        </div>
      </div>
    );
  }

  if (error || !decision) {
    return (
      <div className="min-h-screen flex bg-background">
        <DashboardSidebar />
        <div className="flex-1 flex flex-col">
          <main className="flex-1 container py-8">
            <div className="max-w-2xl mx-auto text-center py-12">
              <h1 className="text-2xl font-bold mb-4">Analysis Not Available</h1>
              <p className="text-muted-foreground mb-6">
                {error || "This BI analysis is not available."}
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={() => navigate("/dashboard")} variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col">
        <main className="flex-1 container py-10">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border bg-card/80 p-6 card-elevated">
              <div>
                <div className="flex items-center gap-3">
                  <Button onClick={() => navigate("/dashboard")} variant="outline" size="sm">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <Badge variant={decision.status}>
                    {decision.status}
                  </Badge>
                </div>
                <h1 className="text-3xl font-semibold mt-4">{decision.title}</h1>
                {decision.context ? (
                  <p className="text-muted-foreground mt-2 max-w-2xl">{decision.context}</p>
                ) : null}
              </div>
              <div className="rounded-2xl border bg-primary/10 px-4 py-3 text-xs font-medium text-primary">
                <div className="text-sm font-semibold text-primary">
                  {dataSourceName || (decision.data_source_id ? `Dataset ${decision.data_source_id.slice(0, 6)}` : "Dataset")}
                </div>
                <div className="mt-1 text-[11px] text-primary/80">
                  {[typeLabel, statusLabel, syncedLabel].filter(Boolean).join(" • ") || "Dataset"}
                </div>
                {countsLabel ? (
                  <div className="mt-1 text-[11px] text-primary/70">
                    {countsLabel}
                  </div>
                ) : null}
              </div>
            </div>

            {metricsError ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
                {metricsError}
              </div>
            ) : null}

            {metricsLoading ? (
              <div className="rounded-2xl border bg-card p-6 card-elevated">
                <AnalysisLoader />
              </div>
            ) : null}

            {metrics && !metricsLoading ? <MarketResults metrics={metrics} /> : null}
          </div>
        </main>
      </div>
    </div>
  );
}
