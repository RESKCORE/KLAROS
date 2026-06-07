import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { DecisionStatus, Decision } from "@/features/decisions/types/decision";

interface FilterSidebarProps {
  statusFilters: DecisionStatus[];
  onStatusChange: (statuses: DecisionStatus[]) => void;
  decisions: Decision[];
}

const statusOptions: { value: DecisionStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "analyzing", label: "Analyzing" },
  { value: "done", label: "Complete" },
  { value: "archived", label: "Archived" },
];

export function FilterSidebar({ statusFilters, onStatusChange, decisions }: FilterSidebarProps) {
  const toggleStatus = (status: DecisionStatus) => {
    if (statusFilters.includes(status)) {
      onStatusChange(statusFilters.filter((s) => s !== status));
    } else {
      onStatusChange([...statusFilters, status]);
    }
  };

  // Calculate dynamic counts
  const statusCounts = {
    draft: decisions.filter(d => d.status === "draft").length,
    analyzing: decisions.filter(d => d.status === "analyzing").length,
    done: decisions.filter(d => d.status === "done").length,
    archived: decisions.filter(d => d.status === "archived").length,
  };

  const totalDecisions = decisions.length;
  
  // Calculate this month's decisions
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthDecisions = decisions.filter(d => 
    new Date(d.created_at) >= thisMonthStart
  ).length;

  const analyzedDecisions = decisions.filter(d => d.status === "done").length;

  // Calculate activity for the last 7 days
  const activityData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    date.setHours(0, 0, 0, 0);
    
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    
    return decisions.filter(d => {
      const decisionDate = new Date(d.created_at);
      return decisionDate >= date && decisionDate < nextDate;
    }).length;
  });

  const maxActivity = Math.max(...activityData, 1);

  return (
    <div className="space-y-6">
      {/* Status filter */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="font-semibold mb-4">Status</h3>
        <div className="space-y-3">
          {statusOptions.map((option) => (
            <div key={option.value} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Checkbox
                  id={`status-${option.value}`}
                  checked={statusFilters.includes(option.value)}
                  onCheckedChange={() => toggleStatus(option.value)}
                />
                <Label
                  htmlFor={`status-${option.value}`}
                  className="text-sm cursor-pointer"
                >
                  {option.label}
                </Label>
              </div>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {statusCounts[option.value]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick stats */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="font-semibold mb-4">Quick Stats</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Decisions</span>
            <span className="font-medium">{totalDecisions}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">This Month</span>
            <span className="font-medium">{thisMonthDecisions}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Analyzed</span>
            <span className="font-medium">{analyzedDecisions}</span>
          </div>
        </div>
      </div>

      {/* Activity graph */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="font-semibold mb-4">Activity</h3>
        <div className="h-20 flex items-end gap-1">
          {activityData.map((count, i) => (
            <div
              key={i}
              className="flex-1 bg-primary/20 rounded-t transition-all hover:bg-primary/40 relative group"
              style={{ height: count > 0 ? `${(count / maxActivity) * 100}%` : '4px' }}
              title={`${count} decision${count !== 1 ? 's' : ''}`}
            >
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity bg-popover text-popover-foreground px-2 py-1 rounded shadow-md whitespace-nowrap">
                {count}
              </span>
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>Mon</span>
          <span>Sun</span>
        </div>
      </div>
    </div>
  );
}
