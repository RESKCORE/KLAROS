import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Brain, 
  Grid3x3, 
  Shield, 
  Lightbulb,
  CheckCircle2,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { AnalysisResult } from "@/features/decisions/types/decision";

interface PipelineStagesProps {
  result: AnalysisResult;
}

const stages = [
  {
    id: 1,
    name: "Contextual Analysis",
    icon: Brain,
    color: "from-blue-500 to-cyan-500",
    description: "Analyzed background and constraints to identify hidden risks and opportunities"
  },
  {
    id: 2,
    name: "Attribute Matrix",
    icon: Grid3x3,
    color: "from-purple-500 to-pink-500",
    description: "Mapped each option against criteria to create normalized scoring model"
  },
  {
    id: 3,
    name: "Constraint Validation",
    icon: Shield,
    color: "from-amber-500 to-orange-500",
    description: "Checked options against hard constraints to identify deal-breakers"
  },
  {
    id: 4,
    name: "Synthesis",
    icon: Lightbulb,
    color: "from-emerald-500 to-green-500",
    description: "Generated recommendation with transparent reasoning"
  },
];

export function PipelineStages({ result }: PipelineStagesProps) {
  const [expandedStage, setExpandedStage] = useState<number | null>(null);

  const toggleStage = (stageId: number) => {
    setExpandedStage(expandedStage === stageId ? null : stageId);
  };

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          AI Reasoning Pipeline
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          4-stage analysis process for comprehensive decision-making
        </p>
      </div>

      <div className="space-y-4">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          const isExpanded = expandedStage === stage.id;
          const isLast = index === stages.length - 1;

          return (
            <div key={stage.id}>
              <div
                className={cn(
                  "relative rounded-xl border transition-all cursor-pointer",
                  isExpanded
                    ? "border-primary/50 bg-primary/5"
                    : "border-border/60 hover:border-primary/30 hover:bg-accent/50"
                )}
                onClick={() => toggleStage(stage.id)}
              >
                {/* Stage Header */}
                <div className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg flex-shrink-0",
                      stage.color
                    )}>
                      <Icon className="h-6 w-6" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          Stage {stage.id}
                        </Badge>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      </div>
                      <h4 className="font-semibold">{stage.name}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {stage.description}
                      </p>
                    </div>

                    {/* Expand Icon */}
                    <div className="flex-shrink-0">
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-border/60">
                      {stage.id === 1 && (
                        <div className="space-y-3">
                          <h5 className="text-sm font-semibold">Key Insights:</h5>
                          <ul className="space-y-2 text-sm text-muted-foreground">
                            {result.reasoning.assumptions.slice(0, 3).map((assumption, i) => (
                              <li key={i} className="flex gap-2">
                                <span className="text-primary">•</span>
                                <span>{assumption}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {stage.id === 2 && (
                        <div className="space-y-3">
                          <h5 className="text-sm font-semibold">Scoring Matrix:</h5>
                          <div className="grid grid-cols-2 gap-2">
                            {result.scores.slice(0, 4).map((score) => (
                              <div
                                key={score.optionId}
                                className="p-2 rounded-lg bg-muted/50 text-sm"
                              >
                                <div className="font-medium">{score.optionLabel}</div>
                                <div className="text-xs text-muted-foreground">
                                  Score: {score.totalScore.toFixed(2)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {stage.id === 3 && (
                        <div className="space-y-3">
                          <h5 className="text-sm font-semibold">Identified Risks:</h5>
                          <ul className="space-y-2 text-sm text-muted-foreground">
                            {result.reasoning.risks.length > 0 ? (
                              result.reasoning.risks.slice(0, 3).map((risk, i) => (
                                <li key={i} className="flex gap-2">
                                  <span className="text-amber-500">⚠</span>
                                  <span>{risk}</span>
                                </li>
                              ))
                            ) : (
                              <li className="text-emerald-500">✓ No critical risks identified</li>
                            )}
                          </ul>
                        </div>
                      )}

                      {stage.id === 4 && (
                        <div className="space-y-3">
                          <h5 className="text-sm font-semibold">Final Recommendation:</h5>
                          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                            <div className="font-semibold text-primary mb-1">
                              {result.recommendation.optionLabel}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {result.recommendation.summary}
                            </div>
                            <div className="mt-2 text-xs text-emerald-600 font-medium">
                              Confidence: {Math.round(result.recommendation.confidence * 100)}%
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Connection Line */}
                {!isLast && (
                  <div className="absolute left-10 -bottom-4 w-0.5 h-4 bg-gradient-to-b from-border to-transparent" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
