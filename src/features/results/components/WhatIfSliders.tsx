import { useState, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RotateCcw, TrendingUp } from "lucide-react";
import type { Criterion, OptionScore } from "@/features/decisions/types/decision";

interface WhatIfSlidersProps {
  criteria: Criterion[];
  scores: OptionScore[];
  onWeightsChange: (newCriteria: Criterion[]) => void;
}

export function WhatIfSliders({ criteria, scores, onWeightsChange }: WhatIfSlidersProps) {
  const [adjustedCriteria, setAdjustedCriteria] = useState<Criterion[]>(criteria);
  const [recalculatedScores, setRecalculatedScores] = useState<OptionScore[]>(scores);

  // Recalculate scores when weights change
  useEffect(() => {
    const newScores = recalculateScores(scores, criteria, adjustedCriteria);
    setRecalculatedScores(newScores);
  }, [adjustedCriteria]);

  const handleWeightChange = (criterionId: string, newWeight: number) => {
    const updated = adjustedCriteria.map(c =>
      c.id === criterionId ? { ...c, weight: newWeight } : c
    );
    setAdjustedCriteria(updated);
    onWeightsChange(updated);
  };

  const handleReset = () => {
    setAdjustedCriteria(criteria);
    onWeightsChange(criteria);
  };

  const hasChanges = JSON.stringify(adjustedCriteria) !== JSON.stringify(criteria);

  // Get top option
  const topOption = [...recalculatedScores].sort((a, b) => b.totalScore - a.totalScore)[0];

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            What-If Analysis
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Adjust criteria weights to see how rankings change
          </p>
        </div>
        {hasChanges && (
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        )}
      </div>

      {/* Current Winner */}
      <div className="mb-6 p-4 rounded-lg bg-primary/5 border border-primary/20">
        <p className="text-sm text-muted-foreground mb-1">Current Top Choice:</p>
        <p className="text-lg font-semibold text-primary">{topOption.optionLabel}</p>
        <p className="text-sm text-muted-foreground">
          Score: {topOption.totalScore.toFixed(2)}
        </p>
      </div>

      {/* Sliders */}
      <div className="space-y-6">
        {adjustedCriteria.map((criterion) => {
          const original = criteria.find(c => c.id === criterion.id);
          const hasChanged = original && original.weight !== criterion.weight;

          return (
            <div key={criterion.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">
                    {criterion.name}
                  </label>
                  {hasChanged && (
                    <Badge variant="secondary" className="text-xs">
                      Modified
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {hasChanged && original && (
                    <span className="text-xs text-muted-foreground line-through">
                      {original.weight}
                    </span>
                  )}
                  <span className="text-sm font-semibold min-w-[2rem] text-right">
                    {criterion.weight}
                  </span>
                </div>
              </div>
              <Slider
                value={[criterion.weight]}
                onValueChange={([value]) => handleWeightChange(criterion.id, value)}
                min={1}
                max={10}
                step={1}
                className="w-full"
              />
              {criterion.description && (
                <p className="text-xs text-muted-foreground">
                  {criterion.description}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Updated Rankings */}
      <div className="mt-6 pt-6 border-t">
        <h4 className="text-sm font-semibold mb-3">Updated Rankings:</h4>
        <div className="space-y-2">
          {[...recalculatedScores]
            .sort((a, b) => b.totalScore - a.totalScore)
            .map((score, index) => {
              const originalRank = scores.find(s => s.optionId === score.optionId)?.rank || 0;
              const rankChange = originalRank - (index + 1);

              return (
                <div
                  key={score.optionId}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground">
                      #{index + 1}
                    </span>
                    <span className="font-medium">{score.optionLabel}</span>
                    {rankChange !== 0 && (
                      <Badge
                        variant={rankChange > 0 ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {rankChange > 0 ? `↑ ${rankChange}` : `↓ ${Math.abs(rankChange)}`}
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm font-semibold">
                    {score.totalScore.toFixed(2)}
                  </span>
                </div>
              );
            })}
        </div>
      </div>
    </Card>
  );
}

// Helper function to recalculate scores with new weights
function recalculateScores(
  originalScores: OptionScore[],
  originalCriteria: Criterion[],
  newCriteria: Criterion[]
): OptionScore[] {
  return originalScores.map(score => {
    // Recalculate total score based on new weights
    let newTotalScore = 0;
    
    score.criteriaScores.forEach(cs => {
      const originalCriterion = originalCriteria.find(c => c.name === cs.criterionName);
      const newCriterion = newCriteria.find(c => c.name === cs.criterionName);
      
      if (originalCriterion && newCriterion) {
        // Adjust the score proportionally to the weight change
        const weightRatio = newCriterion.weight / originalCriterion.weight;
        newTotalScore += cs.score * weightRatio;
      } else {
        newTotalScore += cs.score;
      }
    });

    return {
      ...score,
      totalScore: newTotalScore,
    };
  });
}
