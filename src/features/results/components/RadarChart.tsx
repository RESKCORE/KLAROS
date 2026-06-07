import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import type { AnalysisResult } from "@/features/decisions/types/decision";

interface RadarChartProps {
  scores: AnalysisResult["scores"];
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function RadarChart({ scores }: RadarChartProps) {
  // Transform data for radar chart
  const criteria = scores[0]?.criteriaScores.map((cs) => cs.criterionName) || [];
  
  const data = criteria.map((criterion, criterionIndex) => {
    const point: Record<string, string | number> = { criterion };
    scores.forEach((option) => {
      point[option.optionLabel] = option.criteriaScores[criterionIndex]?.score || 0;
    });
    return point;
  });

  return (
    <div className="rounded-2xl border bg-card p-6">
      <h3 className="font-semibold mb-4">Criteria Analysis</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsRadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis
              dataKey="criterion"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 10]}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.5rem",
              }}
            />
            {scores.map((option, index) => (
              <Radar
                key={option.optionId}
                name={option.optionLabel}
                dataKey={option.optionLabel}
                stroke={COLORS[index % COLORS.length]}
                fill={COLORS[index % COLORS.length]}
                fillOpacity={0.2}
                strokeWidth={2}
              />
            ))}
            <Legend
              wrapperStyle={{ fontSize: 12 }}
            />
          </RechartsRadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
