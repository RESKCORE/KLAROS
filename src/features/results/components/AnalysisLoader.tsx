import { useState, useEffect } from "react";
import { Brain, Loader2 } from "lucide-react";

const loadingMessages = [
  "Analyzing your options...",
  "Evaluating criteria weights...",
  "Calculating scores...",
  "Identifying trade-offs...",
  "Assessing risks...",
  "Generating recommendation...",
];

export function AnalysisLoader() {
  const [messageIndex, setMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 2000);

    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.min(prev + 1, 95));
    }, 50);

    return () => {
      clearInterval(messageInterval);
      clearInterval(progressInterval);
    };
  }, []);

  return (
    <div className="text-center max-w-md mx-auto px-4">
      {/* Animated icon */}
      <div className="relative mb-8">
        <div className="h-24 w-24 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center pulse-glow">
          <Brain className="h-12 w-12 text-primary" />
        </div>
        <div className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full bg-primary flex items-center justify-center">
          <Loader2 className="h-5 w-5 text-primary-foreground animate-spin" />
        </div>
      </div>

      {/* Message */}
      <h2 className="text-2xl font-bold mb-2">Analyzing Your Decision</h2>
      <p className="text-muted-foreground mb-8 h-6 transition-all duration-300">
        {loadingMessages[messageIndex]}
      </p>

      {/* Progress bar */}
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300 rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-sm text-muted-foreground mt-2">{progress}% complete</p>
    </div>
  );
}
