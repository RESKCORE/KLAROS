import { Link, useNavigate } from "react-router-dom";
import { Archive, Calendar, ChevronRight, Edit2, Sparkles, MoreHorizontal, Trash2, Copy, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { Decision } from "@/features/decisions/types/decision";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { deleteDecision, archiveDecision, duplicateDecision } from "@/features/decisions/store/decision-store";
import { isV2Decision } from "@/features/decisions/core/decision-workflow";

interface DecisionCardProps {
  decision: Decision;
  viewMode?: "grid" | "list";
  className?: string;
  style?: React.CSSProperties;
  onDelete?: () => void;
  onUpdate?: () => void;
}

const statusConfig = {
  draft: {
    label: "Draft",
    color: "bg-slate-500/10 text-slate-500 border-slate-500/20",
    dotColor: "bg-slate-500",
  },
  analyzing: {
    label: "Analyzing",
    color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    dotColor: "bg-blue-500 animate-pulse",
  },
  done: {
    label: "Complete",
    color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    dotColor: "bg-emerald-500",
  },
  archived: {
    label: "Archived",
    color: "bg-gray-500/10 text-gray-400 border-gray-500/20",
    dotColor: "bg-gray-400",
  },
};

export function DecisionCard({ decision, viewMode = "grid", className, style, onDelete, onUpdate }: DecisionCardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const formattedDate = new Date(decision.updated_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const status = statusConfig[decision.status] || statusConfig.draft;
  const confidence = decision.result_json?.recommendation?.confidence;
  const isBusinessIntelligence = isV2Decision(decision);
  const editPath = `/decisions/${decision.id}/result`;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteDecision(decision.id);
      
      toast({
        title: "Decision deleted",
        description: "The decision has been permanently deleted.",
      });
      
      if (onDelete) {
        onDelete();
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        title: "Error",
        description: "Failed to delete decision. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleDuplicate = async () => {
    try {
      toast({
        title: "Duplicating decision",
        description: "Creating a copy of this decision...",
      });
      await duplicateDecision(decision.id);
      toast({
        title: "Decision duplicated",
        description: `Created copy of "${decision.title}".`,
      });
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error("Duplicate error:", error);
      toast({
        title: "Error",
        description: "Failed to duplicate decision. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleArchive = async () => {
    try {
      await archiveDecision(decision.id);
      
      toast({
        title: decision.status === "archived" ? "Decision unarchived" : "Decision archived",
        description: decision.status === "archived" 
          ? "The decision has been restored." 
          : "The decision has been moved to archives.",
      });
      
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error("Archive error:", error);
      toast({
        title: "Error",
        description: "Failed to archive decision. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (viewMode === "list") {
    return (
      <div
        className={cn(
          "group flex items-center gap-4 rounded-xl border border-border/60 bg-card/50 p-4 transition-all duration-200 hover:border-primary/30 hover:bg-card hover:shadow-lg hover:shadow-primary/5 animate-fade-in backdrop-blur-sm",
          className
        )}
        style={style}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1.5">
            <h3 className="font-semibold truncate group-hover:text-primary transition-colors">{decision.title}</h3>
            {isBusinessIntelligence && (
              <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                BI
              </Badge>
            )}
            <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border", status.color)}>
              <span className={cn("h-1.5 w-1.5 rounded-full", status.dotColor)} />
              {status.label}
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {formattedDate}
            </span>
            <span className="text-border">•</span>
            <span>{decision.options.length} options</span>
            <span className="text-border">•</span>
            <span>{decision.criteria.length} criteria</span>
            {confidence && confidence > 0.8 && (
              <>
                <span className="text-border">•</span>
                <span className="text-emerald-500 flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5" />
                  {Math.round(confidence * 100)}%
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {decision.status === "done" && (
            <Link to={`/decisions/${decision.id}/result`}>
              <Button size="sm" className="gap-1.5 shadow-lg shadow-primary/20">
                Results
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem 
                className="gap-2"
                onClick={() => navigate(editPath)}
              >
                <Edit2 className="h-4 w-4" />
                View Analysis
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onClick={handleDuplicate}>
                <Copy className="h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onClick={handleArchive}>
                <Archive className="h-4 w-4" />
                {decision.status === "archived" ? "Unarchive" : "Archive"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="gap-2 text-destructive focus:text-destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Delete confirmation dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Decision?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{decision.title}"? This action cannot be undone and will permanently remove all associated data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative rounded-2xl border border-border/60 bg-card/50 p-6 transition-all duration-300 hover:border-primary/40 hover:bg-card hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 animate-fade-in backdrop-blur-sm",
        decision.status === "archived" && "opacity-60 hover:opacity-100",
        className
      )}
      style={style}
    >
      {/* Gradient accent on hover */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      {/* Dropdown menu - Always visible */}
      <div className="absolute top-4 right-4 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg hover:bg-muted"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem 
              className="gap-2"
              onClick={() => navigate(editPath)}
            >
              <Edit2 className="h-4 w-4" />
              View Analysis
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2" onClick={handleDuplicate}>
              <Copy className="h-4 w-4" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2" onClick={handleArchive}>
              <Archive className="h-4 w-4" />
              {decision.status === "archived" ? "Unarchive" : "Archive"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="gap-2 text-destructive focus:text-destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Decision?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{decision.title}"? This action cannot be undone and will permanently remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Status badge */}
      <div className="relative mb-4 flex items-center gap-2">
        <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", status.color)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", status.dotColor)} />
          {status.label}
        </div>
        {confidence && confidence > 0.8 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-medium">
            <Sparkles className="h-3 w-3" />
            High Confidence
          </div>
        )}
      </div>

      {/* Title */}
      <h3 className="relative font-semibold text-lg mb-2 line-clamp-2 group-hover:text-primary transition-colors">
        {decision.title}
      </h3>
      {isBusinessIntelligence && (
        <Badge variant="secondary" className="relative mb-3 text-[10px] uppercase tracking-wide">
          BI
        </Badge>
      )}

      {/* Context preview */}
      {decision.context && (
        <p className="relative text-sm text-muted-foreground mb-4 line-clamp-2 leading-relaxed">
          {decision.context}
        </p>
      )}

      {/* Stats */}
      <div className="relative flex items-center gap-3 text-sm text-muted-foreground mb-4">
        <span className="px-2 py-0.5 rounded-md bg-muted/50">{decision.options.length} options</span>
        <span className="px-2 py-0.5 rounded-md bg-muted/50">{decision.criteria.length} criteria</span>
      </div>

      {/* Date */}
      <div className="relative flex items-center gap-1.5 text-xs text-muted-foreground mb-5">
        <Calendar className="h-3.5 w-3.5" />
        Updated {formattedDate}
      </div>

      {/* Actions */}
      <div className="relative flex items-center gap-2 pt-4 border-t border-border/60">
        <Link to={`/decisions/${decision.id}/result`} className="flex-1">
          <Button variant="outline" size="sm" className="w-full gap-1.5 bg-background/50 hover:bg-background">
            <Edit2 className="h-4 w-4" />
            View
          </Button>
        </Link>
        {decision.status === "done" ? (
          <Link to={`/decisions/${decision.id}/result`} className="flex-1">
            <Button size="sm" className="w-full gap-1.5 shadow-lg shadow-primary/20">
              View Results
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </Link>
        ) : decision.status === "draft" ? (
          <Link to={`/decisions/${decision.id}/result`} className="flex-1">
            <Button size="sm" className="w-full gap-1.5 shadow-lg shadow-primary/20">
              <Sparkles className="h-4 w-4" />
              Open
            </Button>
          </Link>
        ) : decision.status === "analyzing" ? (
          <Button size="sm" className="flex-1 gap-1.5" disabled>
            <div className="h-3.5 w-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            Processing...
          </Button>
        ) : null}
      </div>
    </div>
  );
}
