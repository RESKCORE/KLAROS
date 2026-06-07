import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface FeedbackButtonProps {
  decisionId: string;
}

export function FeedbackButton({ decisionId }: FeedbackButtonProps) {
  const { toast } = useToast();
  const [feedback, setFeedback] = useState<'helpful' | 'not-helpful' | null>(null);

  const handleFeedback = async (type: 'helpful' | 'not-helpful') => {
    setFeedback(type);
    
    // TODO: Save feedback to database
    // await saveFeedback(decisionId, type);
    
    toast({
      title: type === 'helpful' ? "Thanks for your feedback!" : "We'll work on improving",
      description: type === 'helpful' 
        ? "Glad we could help with your decision." 
        : "Your feedback helps us make better recommendations.",
    });
  };

  if (feedback) {
    return (
      <div className="flex items-center justify-center gap-3 p-6 rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm">
        <div className="text-center">
          <p className="text-sm font-medium text-muted-foreground">
            {feedback === 'helpful' ? '✓ Thanks for your feedback!' : '✓ Feedback received'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 p-6 rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm">
      <p className="text-sm font-medium text-center">Was this analysis helpful?</p>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "gap-2 transition-all hover:scale-105",
            "hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-300"
          )}
          onClick={() => handleFeedback('helpful')}
        >
          <ThumbsUp className="h-4 w-4" />
          Yes, helpful
        </Button>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "gap-2 transition-all hover:scale-105",
            "hover:bg-red-50 hover:text-red-600 hover:border-red-300"
          )}
          onClick={() => handleFeedback('not-helpful')}
        >
          <ThumbsDown className="h-4 w-4" />
          Not helpful
        </Button>
      </div>
    </div>
  );
}
