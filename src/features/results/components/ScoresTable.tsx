import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Crown, TrendingUp, BarChart3 } from "lucide-react";
import type { AnalysisResult } from "@/features/decisions/types/decision";

interface ScoresTableProps {
  scores: AnalysisResult["scores"];
}

export function ScoresTable({ scores }: ScoresTableProps) {
  const criteria = scores[0]?.criteriaScores.map((cs) => cs.criterionName) || [];
  const maxTotal = Math.max(...scores.map((s) => s.totalScore));
  const sortedScores = [...scores].sort((a, b) => b.totalScore - a.totalScore);

  return (
    <div className="rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-border/60 bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Weighted Scores Breakdown</h3>
            <p className="text-sm text-muted-foreground">Detailed scoring across all criteria</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/20 hover:bg-muted/20">
              <TableHead className="w-40 font-semibold">Option</TableHead>
              {criteria.map((criterion) => (
                <TableHead key={criterion} className="text-center font-semibold min-w-[100px]">
                  {criterion}
                </TableHead>
              ))}
              <TableHead className="text-center font-bold min-w-[100px]">Total Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedScores.map((option, index) => {
              const isWinner = option.totalScore === maxTotal;
              const scorePercentage = (option.totalScore / maxTotal) * 100;
              return (
                <TableRow
                  key={option.optionId}
                  className={cn(
                    "transition-colors",
                    isWinner && "bg-primary/5 hover:bg-primary/10"
                  )}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {isWinner && (
                        <Crown className="h-4 w-4 text-amber-500" />
                      )}
                      <span className={cn(isWinner && "text-primary font-semibold")}>
                        {option.optionLabel}
                      </span>
                      {isWinner && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-gradient-to-r from-amber-400 to-amber-600 text-white border-0">
                          BEST
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  {option.criteriaScores.map((cs) => (
                    <TableCell key={cs.criterionId} className="text-center">
                      <span
                        className={cn(
                          "inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold transition-all",
                          cs.score >= 8
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : cs.score >= 6
                            ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                            : cs.score >= 4
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {cs.score}
                      </span>
                    </TableCell>
                  ))}
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span
                        className={cn(
                          "inline-flex h-10 min-w-[60px] items-center justify-center rounded-xl px-3 text-sm font-bold transition-all",
                          isWinner
                            ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25"
                            : "bg-muted text-foreground"
                        )}
                      >
                        {option.totalScore}
                      </span>
                      {/* Score bar visualization */}
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            isWinner ? "bg-primary" : "bg-muted-foreground/30"
                          )}
                          style={{ width: `${scorePercentage}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Legend */}
      <div className="p-4 border-t border-border/60 bg-muted/20">
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-emerald-500/15" />
            Excellent (8-10)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-blue-500/15" />
            Good (6-7)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-amber-500/15" />
            Fair (4-5)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-muted" />
            Needs Improvement (1-3)
          </span>
        </div>
      </div>
    </div>
  );
}
