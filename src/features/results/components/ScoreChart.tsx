import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { AnalysisResult } from "@/features/decisions/types/decision";

interface ScoreChartProps {
  scores: AnalysisResult["scores"];
}

export function ScoreChart({ scores }: ScoreChartProps) {
  const data = scores.map((s) => ({
    name: s.optionLabel,
    score: s.totalScore,
  }));

  const maxScore = Math.max(...data.map((d) => d.score));

  return (
    <div className="rounded-2xl border bg-card p-6">
      <h3 className="font-semibold mb-4">Score Comparison</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
            <XAxis type="number" domain={[0, 100]} />
            <YAxis type="category" dataKey="name" width={80} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.5rem",
              }}
              formatter={(value: number) => [`${value} points`, "Score"]}
            />
            <Bar dataKey="score" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.score === maxScore ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.3)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
