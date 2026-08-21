import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
}

export function Logo({ className, size = "md", showText = false }: LogoProps) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
    xl: "h-16 w-16",
  };

  const textClasses = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
    xl: "text-3xl",
  };

  return (
    <div className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <img
        src="/logo.png"
        alt="KLAROS Logo"
        className={cn(sizeClasses[size], "object-contain shrink-0 transition-transform duration-300 group-hover:scale-105")}
      />
      {showText && (
        <span className={cn("font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-transparent", textClasses[size])}>
          KLAROS
        </span>
      )}
    </div>
  );
}
