import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import type { Decision } from '@/features/decisions/types/decision';

interface KpiSummary {
  marginPct: number;
  lowStock: number;
  topCategory: string;
  topProduct: string;
}

interface HistoryDecisionCardProps {
  decision: Decision;
  title: string;
  metrics: KpiSummary | null;
  compareEnabled: boolean;
  isCompared: boolean;
  onToggleCompare: (id: string) => void;
  onDelete?: (id: string) => void;
  isDeleting?: boolean;
  compact?: boolean;
}

export const HistoryDecisionCard: React.FC<HistoryDecisionCardProps> = ({
  decision,
  title,
  metrics,
  compareEnabled,
  isCompared,
  onToggleCompare,
  onDelete,
  isDeleting,
  compact = false,
}) => {
  if (compact) {
    return (
      <div className="rounded-xl border bg-card/70 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            {compareEnabled && (
              <input
                type="checkbox"
                checked={isCompared}
                onChange={() => onToggleCompare(decision.id)}
                className="h-4 w-4 rounded border-border/60"
              />
            )}
            <p className="font-semibold">{title}</p>
            <Badge variant="secondary" className="capitalize">
              {decision.status}
            </Badge>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Updated {new Date(decision.updated_at).toLocaleDateString()}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Margin {metrics ? `${metrics.marginPct}%` : '-'} · Low stock {metrics ? metrics.lowStock : '-'} · Top category{' '}
            {metrics?.topCategory ?? '-'} · Top product {metrics?.topProduct ?? '-'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" asChild>
            <Link to={`/decisions/${decision.id}/result`}>View Results</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {compareEnabled && (
              <input
                type="checkbox"
                checked={isCompared}
                onChange={() => onToggleCompare(decision.id)}
                className="h-4 w-4 rounded border-border/60"
              />
            )}
            <p className="font-semibold truncate">{title}</p>
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
          {onDelete && (
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
                    onClick={() => onDelete(decision.id)}
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Removing...' : 'Remove'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button size="sm" asChild>
            <Link to={`/decisions/${decision.id}/result`}>View Results</Link>
          </Button>
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
        <div>Margin: {metrics ? `${metrics.marginPct}%` : '-'}</div>
        <div>Low stock: {metrics ? metrics.lowStock : '-'}</div>
        <div>Top category: {metrics?.topCategory ?? '-'}</div>
        <div>Top product: {metrics?.topProduct ?? '-'}</div>
      </div>
    </div>
  );
};
