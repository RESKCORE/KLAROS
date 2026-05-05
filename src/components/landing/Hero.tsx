import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, Target, BarChart3, Shield, Zap, TrendingUp, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Bold gradient background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-slate-50 to-amber-50" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.14),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(251,191,36,0.12),transparent_45%),radial-gradient(circle_at_70%_80%,rgba(14,116,144,0.12),transparent_45%)]" />
        <div className="absolute top-10 left-10 h-56 w-56 rounded-full bg-emerald-300/25 blur-[90px]" />
        <div className="absolute bottom-10 right-16 h-64 w-64 rounded-full bg-amber-300/25 blur-[110px]" />
      </div>

      <div className="container relative pt-20 pb-16 md:pt-32 md:pb-24 lg:pt-40 lg:pb-36 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          {/* Badge with shine effect */}
          <div className="mb-6 md:mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-white/70 px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm font-medium text-emerald-700 animate-fade-in backdrop-blur-sm shadow-sm">
            <Sparkles className="h-3 w-3 md:h-4 md:w-4 animate-bounce-subtle" />
            <span className="hidden sm:inline">Operational BI for fast decisions</span>
            <span className="sm:hidden">Operational BI</span>
            <span className="ml-1 rounded-full bg-emerald-100 px-1.5 py-0.5 md:px-2 text-xs">New</span>
          </div>

          {/* Headline with animated gradient */}
          <h1 className="mb-6 md:mb-8 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl animate-fade-in leading-tight">
            Turn messy data into
            <span className="block text-slate-900">decisive moves.</span>
          </h1>

          {/* Subheadline */}
          <p className="mb-8 md:mb-10 text-base sm:text-lg md:text-xl lg:text-2xl text-slate-600 max-w-3xl mx-auto animate-fade-in leading-relaxed px-4 sm:px-0">
            Klaros unifies sales, stock, and investment signals into a single decision canvas.
            <span className="hidden sm:inline"> Score options, surface tradeoffs, and share a clear recommendation in minutes.</span>
            <span className="sm:hidden"> Score options and ship faster decisions.</span>
          </p>

          {/* Trust indicators */}
          <div className="flex items-center justify-center gap-3 sm:gap-6 mb-8 md:mb-10 text-xs sm:text-sm text-slate-500 animate-fade-in flex-wrap">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-600 flex-shrink-0" />
              <span>Secure by design</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5">
              <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-600 flex-shrink-0" />
              <span className="hidden sm:inline">Scenario-aware analysis</span>
              <span className="sm:hidden">Scenario-aware</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5">
              <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-600 flex-shrink-0" />
              <span className="hidden sm:inline">Built for operations teams</span>
              <span className="sm:hidden">Ops-ready</span>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-16 md:mb-20 animate-fade-in px-4 sm:px-0">
            <Link to="/connect-data" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto gap-2 bg-slate-900 text-white hover:bg-slate-800 shadow-2xl shadow-slate-900/25 transition-all hover:scale-[1.02] group text-sm md:text-base px-6 md:px-8 py-3 md:py-4">
                <Zap className="h-4 w-4 md:h-5 md:w-5 group-hover:animate-bounce-subtle" />
                <span className="hidden sm:inline">Start with a dataset</span>
                <span className="sm:hidden">Start now</span>
                <ArrowRight className="h-4 w-4 md:h-5 md:w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link to="/dashboard" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2 bg-white/70 backdrop-blur-sm hover:bg-white transition-all text-sm md:text-base px-6 md:px-8 py-3 md:py-4">
                <TrendingUp className="h-4 w-4 md:h-5 md:w-5" />
                View live dashboard
              </Button>
            </Link>
          </div>

          {/* Features grid with glass cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto animate-fade-in px-4 sm:px-0">
            <FeatureCard
              icon={Target}
              title="Signal clarity"
              description="Unify KPIs, context, and constraints into a single decision brief."
              gradient="from-emerald-500 to-teal-500"
            />
            <FeatureCard
              icon={BarChart3}
              title="Scenario scoring"
              description="Rank options by revenue impact, cost, and execution risk."
              gradient="from-cyan-500 to-sky-500"
            />
            <FeatureCard
              icon={Shield}
              title="Risk guardrails"
              description="Surface tradeoffs early and document the reasoning trail."
              gradient="from-amber-500 to-orange-500"
            />
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  gradient,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  gradient: string;
}) {
  return (
    <div className="group relative rounded-xl sm:rounded-2xl border border-border/50 bg-white/70 p-4 sm:p-6 text-left transition-all duration-300 hover:border-emerald-400/40 hover:shadow-xl hover:shadow-emerald-500/10 backdrop-blur-sm hover:-translate-y-1">
      {/* Gradient overlay on hover */}
      <div className={`absolute inset-0 rounded-xl sm:rounded-2xl bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />

      <div className="relative">
        <div className={`mb-3 sm:mb-4 inline-flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg sm:rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg shadow-primary/10 transition-transform group-hover:scale-110`}>
          <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <h3 className="mb-2 font-semibold text-base sm:text-lg text-slate-900">{title}</h3>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
