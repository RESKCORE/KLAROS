import { Trophy, TrendingUp, Sparkles, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AnalysisResult } from "@/features/decisions/types/decision";

interface RecommendationCardProps {
  recommendation: AnalysisResult["recommendation"];
}

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const confidencePercent = Math.round(recommendation.confidence * 100);
  
  const getConfidenceConfig = (percent: number) => {
    if (percent >= 80) return { label: "High", color: "text-emerald-500", bg: "bg-emerald-500", gradient: "from-emerald-500 to-green-500" };
    if (percent >= 60) return { label: "Moderate", color: "text-amber-500", bg: "bg-amber-500", gradient: "from-amber-500 to-orange-500" };
    return { label: "Low", color: "text-rose-500", bg: "bg-rose-500", gradient: "from-rose-500 to-red-500" };
  };

  const confidenceConfig = getConfidenceConfig(confidencePercent);
  
  return (
    <div className="relative rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card overflow-hidden">
      {/* Animated background decorations */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[100px] animate-pulse-slow" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-violet-500/10 rounded-full blur-[80px] animate-pulse-slow [animation-delay:1s]" />
      
      {/* Winner badge corner */}
      <div className="absolute top-0 right-0">
        <div className="bg-gradient-to-br from-amber-400 to-amber-600 text-white px-4 py-1.5 text-xs font-bold shadow-lg transform rotate-0 rounded-bl-lg flex items-center gap-1.5">
          <Award className="h-3.5 w-3.5" />
          WINNER
        </div>
      </div>
      
      <div className="relative p-8">
        <div className="flex flex-col sm:flex-row items-start gap-6 mb-6">
          {/* Trophy icon */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-400/30 to-amber-600/30 rounded-2xl blur-xl" />
            <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-2xl shadow-amber-500/30">
              <Trophy className="h-10 w-10 text-white" />
            </div>
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-primary animate-bounce-subtle" />
              <p className="text-sm font-medium text-primary">AI Recommendation</p>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight gradient-text-animated mb-3">
              {recommendation.optionLabel}
            </h2>
            <Badge 
              className={cn(
                "gap-1.5 px-3 py-1 text-sm font-semibold border-0",
                `bg-gradient-to-r ${confidenceConfig.gradient} text-white shadow-lg`
              )}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              {confidencePercent}% Confidence
            </Badge>
          </div>
        </div>

        <p className="text-muted-foreground leading-relaxed text-lg">
          {recommendation.summary}
        </p>

        {/* Confidence meter */}
        <div className="mt-8 p-5 rounded-xl bg-background/50 backdrop-blur-sm border border-border/60">
          <div className="flex items-center justify-between text-sm mb-3">
            <span className="text-muted-foreground font-medium">Confidence Level</span>
            <div className="flex items-center gap-2">
              <span className={cn("font-bold text-lg", confidenceConfig.color)}>{confidencePercent}%</span>
              <span className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-full",
                `${confidenceConfig.bg}/10 ${confidenceConfig.color}`
              )}>
                {confidenceConfig.label}
              </span>
            </div>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r",
                confidenceConfig.gradient
              )}
              style={{ width: `${confidencePercent}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground/60">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
