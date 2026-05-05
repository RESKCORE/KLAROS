import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/react';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
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
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { deleteDecision, getCachedUserDecisions, getUserDecisions } from '@/lib/decision-store';
import { autoAnalyze, getCachedDataSources, getDataSources } from '@/lib/bi-api';
import type { DataSourceSummary } from '@/lib/bi-api';
import type { Decision } from '@/types/decision';
import {
  ArrowRight,
  BarChart3,
  Clock3,
  Database,
  Search,
  Sparkles,
  Target,
  Activity,
  Trash2,
} from 'lucide-react';

function statusTone(status: Decision['status']): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'done') return 'default';
  if (status === 'analyzing') return 'secondary';
  if (status === 'archived') return 'outline';
  return 'outline';
}

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function Dashboard() {
  const { toast } = useToast();
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const navigate = useNavigate();

  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dataSources, setDataSources] = useState<DataSourceSummary[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoadingSources, setIsLoadingSources] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [showAnalyzeDialog, setShowAnalyzeDialog] = useState(false);
  const [selectedDataSourceId, setSelectedDataSourceId] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded) {
      const cached = user?.id ? getCachedUserDecisions(user.id) : null;
      if (cached) {
        setDecisions(cached);
        setIsLoading(false);
      }

      const cachedSources = getCachedDataSources();
      if (cachedSources) {
        setDataSources(cachedSources);
        setIsLoadingSources(false);
      }

      void loadDecisions(Boolean(cached));
      void loadSources(Boolean(cachedSources));
    }
  }, [isLoaded, user?.id]);

  async function loadDecisions(hasCache = false) {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    if (!hasCache) {
      const cached = getCachedUserDecisions(user.id);
      if (cached) {
        setDecisions(cached);
        setIsLoading(false);
        hasCache = true;
      }
    }

    if (!hasCache && decisions.length === 0) {
      setIsLoading(true);
    }
    try {
      const data = await getUserDecisions(user.id, undefined, getToken);
      setDecisions(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load BI analyses.';
      toast({
        title: 'Unable to load dashboard',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function loadSources(hasCache = false) {
    if (!user?.id) {
      setDataSources([]);
      return;
    }

    if (!hasCache) {
      const cached = getCachedDataSources();
      if (cached) {
        setDataSources(cached);
        setIsLoadingSources(false);
        hasCache = true;
      }
    }

    if (!hasCache && dataSources.length === 0) {
      setIsLoadingSources(true);
    }
    try {
      const sources = await getDataSources();
      setDataSources(sources);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load data sources.';
      toast({
        title: 'Unable to load data sources',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoadingSources(false);
    }
  }

  const handleAutoAnalyze = async () => {
    if (!user?.id) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to run auto-analysis.',
        variant: 'destructive',
      });
      return;
    }

    if (dataSources.length === 0) {
      toast({
        title: 'No datasets connected',
        description: 'Connect or upload a dataset first.',
        variant: 'destructive',
      });
      return;
    }

    setSelectedDataSourceId(dataSources[0]?.id ?? null);
    setShowAnalyzeDialog(true);
  };

  const confirmAnalyze = async () => {
    if (!selectedDataSourceId) {
      toast({
        title: 'Select a dataset',
        description: 'Choose a dataset to analyze.',
        variant: 'destructive',
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await autoAnalyze(selectedDataSourceId);
      toast({
        title: 'Analysis complete',
        description: 'Synthetic dataset analyzed successfully.',
      });
      await loadDecisions();
      navigate(`/decisions/${result.decisionId}/result`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Auto-analysis failed.';
      toast({
        title: 'Auto-analysis failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
      setShowAnalyzeDialog(false);
    }
  };

  const handleDelete = async (decisionId: string) => {
    if (!user?.id) {
      return;
    }

    setIsDeleting(decisionId);
    try {
      await deleteDecision(decisionId, getToken);
      setDecisions((prev) => prev.filter((item) => item.id !== decisionId));
      toast({
        title: 'Analysis removed',
        description: 'The analysis has been deleted.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove analysis.';
      toast({
        title: 'Unable to remove analysis',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const dataSourceNameById = useMemo(
    () => new Map(dataSources.map((source) => [source.id, source.name])),
    [dataSources]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return decisions;
    return decisions.filter((item) => {
      const datasetName = item.data_source_id ? dataSourceNameById.get(item.data_source_id) : null;
      const title = datasetName || item.title;
      return title.toLowerCase().includes(q) || item.title.toLowerCase().includes(q);
    });
  }, [decisions, search, dataSourceNameById]);

  const getDecisionLabel = (decision: Decision) => {
    if (!decision.data_source_id) return decision.title;
    return dataSourceNameById.get(decision.data_source_id) || decision.title;
  };

  const stats = useMemo(() => {
    const total = decisions.length;
    const completed = decisions.filter((d) => d.status === 'done').length;
    const running = decisions.filter((d) => d.status === 'analyzing').length;
    const biLinked = decisions.filter((d) => d.data_source_id).length;
    return { total, completed, running, biLinked };
  }, [decisions]);

  return (
    <div className="min-h-screen flex bg-background">
      <DashboardSidebar />

      <div className="flex-1">
        <main className="container py-8 space-y-6">
          <section className="rounded-2xl border bg-card p-6 card-elevated bg-gradient-hero">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">BI Decision Intelligence</h1>
                <p className="text-muted-foreground mt-2 max-w-2xl">
                  Prototype analysis powered by the synthetic supermarket dataset. Run auto-analysis to generate options, criteria, and scores.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button variant="outline" asChild>
                  <Link to="/connect-data">
                    <Database className="h-4 w-4 mr-2" />
                    Connect Data
                  </Link>
                </Button>
                <Button onClick={handleAutoAnalyze} disabled={isAnalyzing}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {isAnalyzing ? 'Analyzing...' : 'Auto-Analyze Now'}
                </Button>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[2fr,1fr]">
            <Card className="p-5 card-elevated">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Connected Data Sources</h2>
                <Button variant="ghost" size="sm" onClick={() => void loadSources()} disabled={isLoadingSources}>
                  Refresh
                </Button>
              </div>
              {isLoadingSources ? (
                <div className="text-sm text-muted-foreground">Loading sources...</div>
              ) : dataSources.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No connected sources yet. Start by connecting the synthetic dataset.
                </div>
              ) : (
                <div className="space-y-3">
                  {dataSources.map((source) => (
                    <div key={source.id} className="flex items-center justify-between rounded-xl border p-3">
                      <div>
                        <p className="font-medium">{source.name}</p>
                        <p className="text-xs text-muted-foreground">Type: {source.type}</p>
                      </div>
                      <Badge variant="secondary">{source.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5 card-elevated">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold">Insights Snapshot</h3>
                  <p className="text-xs text-muted-foreground">Prototype visualization placeholder</p>
                </div>
              </div>
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Radar chart and key insight callouts will appear here after auto-analysis.
              </div>
            </Card>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={Target} label="Total Analyses" value={stats.total} />
            <MetricCard icon={BarChart3} label="Completed" value={stats.completed} />
            <MetricCard icon={Clock3} label="Running" value={stats.running} />
            <MetricCard icon={Database} label="Dataset Linked" value={stats.biLinked} />
          </section>

          <section className="rounded-2xl border bg-card p-4 sm:p-5 card-elevated">
            <div className="relative max-w-lg">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search BI analyses by title"
                className="pl-10"
              />
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-5 card-elevated">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Recent BI Analyses</h2>
              <Button variant="ghost" size="sm" onClick={() => void loadDecisions()}>
                Refresh
              </Button>
            </div>

            {isLoading ? (
              <div className="py-16 text-center text-muted-foreground">Loading analyses...</div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-lg font-medium mb-2">No BI analyses found</p>
                <p className="text-muted-foreground mb-6">Run auto-analysis to generate your first synthetic BI decision.</p>
                <div className="flex flex-wrap justify-center gap-3">
                  <Button asChild>
                    <Link to="/connect-data">
                      <Database className="h-4 w-4 mr-2" />
                      Connect Data
                    </Link>
                  </Button>
                  <Button variant="outline" onClick={handleAutoAnalyze} disabled={isAnalyzing}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    {isAnalyzing ? 'Analyzing...' : 'Auto-Analyze'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((decision) => (
                  <div key={decision.id} className="rounded-xl border p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{getDecisionLabel(decision)}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>Updated {formatWhen(decision.updated_at)}</span>
                        <span>•</span>
                        <span>{decision.options.length} options</span>
                        <span>•</span>
                        <span>{decision.criteria.length} criteria</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant={statusTone(decision.status)}>{decision.status}</Badge>
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
                              {isDeleting === decision.id ? 'Removing...' : 'Remove'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <Button size="sm" asChild>
                        <Link to={`/decisions/${decision.id}/result`}>
                          Open Results
                          <ArrowRight className="h-4 w-4 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>

      <Dialog open={showAnalyzeDialog} onOpenChange={setShowAnalyzeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select dataset to analyze</DialogTitle>
            <DialogDescription>
              Choose which connected dataset should be used for the analysis run.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {dataSources.map((source) => (
              <button
                key={source.id}
                type="button"
                onClick={() => setSelectedDataSourceId(source.id)}
                className={
                  selectedDataSourceId === source.id
                    ? "w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left"
                    : "w-full rounded-xl border border-border/60 bg-white px-4 py-3 text-left hover:border-emerald-200"
                }
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{source.name}</p>
                    <p className="text-xs text-slate-500">Type: {source.type}</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                    {source.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAnalyzeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmAnalyze} disabled={isAnalyzing || !selectedDataSourceId}>
              {isAnalyzing ? 'Analyzing...' : 'Run analysis'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <Card className="p-4 card-elevated card-hover">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </div>
    </Card>
  );
}
