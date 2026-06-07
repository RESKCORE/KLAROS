import { FileText, ListChecks, Cpu, CheckCircle2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  {
    icon: FileText,
    step: "01",
    title: "Connect your data",
    description: "Bring in sales, stock, and investment signals from your datasets.",
    gradient: "from-emerald-500 to-teal-500",
    shadowColor: "shadow-emerald-500/25",
  },
  {
    icon: ListChecks,
    step: "02",
    title: "Frame the decision",
    description: "Capture options, constraints, and what success looks like.",
    gradient: "from-cyan-500 to-sky-500",
    shadowColor: "shadow-cyan-500/25",
  },
  {
    icon: Cpu,
    step: "03",
    title: "Score scenarios",
    description: "See weighted rankings and the drivers behind each outcome.",
    gradient: "from-amber-500 to-orange-500",
    shadowColor: "shadow-amber-500/25",
  },
  {
    icon: CheckCircle2,
    step: "04",
    title: "Act with confidence",
    description: "Share a recommendation backed by data and documented tradeoffs.",
    gradient: "from-slate-500 to-slate-700",
    shadowColor: "shadow-slate-500/25",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-emerald-50/40 to-slate-50" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(16,185,129,0.12),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(14,116,144,0.1),transparent_45%)]" />

      <div className="container relative">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-white/70 px-4 py-1.5 text-sm font-medium text-emerald-700 mb-6">
            From data to decisions
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold mb-4">How Klaros delivers clarity</h2>
          <p className="text-slate-600 max-w-2xl mx-auto text-lg">
            A fast, repeatable workflow that turns signals into action
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {steps.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="relative group"
              >
                {/* Connector line - desktop */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:flex absolute top-14 left-[55%] w-full items-center">
                    <div className="flex-1 h-0.5 bg-gradient-to-r from-border via-primary/30 to-border" />
                    <ArrowRight className="h-4 w-4 text-primary/50 -ml-2" />
                  </div>
                )}

                <div className="relative bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-border/60 transition-all duration-300 hover:border-emerald-400/40 hover:shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-1 h-full">
                  {/* Step number badge */}
                  <div className={cn(
                    "absolute -top-3 -right-3 flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white shadow-lg bg-gradient-to-br",
                    item.gradient,
                    item.shadowColor
                  )}>
                    {item.step}
                  </div>

                  {/* Icon */}
                  <div className={cn(
                    "mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl text-white bg-gradient-to-br shadow-lg transition-transform group-hover:scale-110",
                    item.gradient,
                    item.shadowColor
                  )}>
                    <Icon className="h-7 w-7" />
                  </div>

                  <h3 className="font-semibold text-lg mb-2 text-slate-900">{item.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
