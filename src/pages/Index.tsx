import { LandingHeader } from "@/components/layout/LandingHeader";
import { Hero } from "@/features/landing/components/Hero";
import { HowItWorks } from "@/features/landing/components/HowItWorks";
import { CTA } from "@/features/landing/components/CTA";
import { Footer } from "@/components/layout/Footer";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <LandingHeader />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <section id="details" className="py-16 md:py-24 bg-slate-50">
          <div className="container px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold mb-4 md:mb-6 text-slate-900">
                Why teams choose Klaros
              </h2>
              <p className="text-base sm:text-lg text-slate-600 mb-8 md:mb-12 px-4 sm:px-0">
                Ship faster decisions with a single source of truth for options, scoring, and risk.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 text-left">
                <div className="p-4 sm:p-6 rounded-2xl bg-white/80 border border-border/60 shadow-sm">
                  <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3 text-slate-900">Decision brief in minutes</h3>
                  <p className="text-sm sm:text-base text-slate-600">
                    Capture context, constraints, and what success looks like in one place.
                  </p>
                </div>
                <div className="p-4 sm:p-6 rounded-2xl bg-white/80 border border-border/60 shadow-sm">
                  <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3 text-slate-900">Transparent scoring</h3>
                  <p className="text-sm sm:text-base text-slate-600">
                    See the weights, assumptions, and ranking logic behind each outcome.
                  </p>
                </div>
                <div className="p-4 sm:p-6 rounded-2xl bg-white/80 border border-border/60 shadow-sm">
                  <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3 text-slate-900">Ops-ready outputs</h3>
                  <p className="text-sm sm:text-base text-slate-600">
                    Share dashboards and recommendations your team can act on immediately.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section id="contact" className="py-16 md:py-24">
          <div className="container px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold mb-4 md:mb-6 text-slate-900">
                Talk with the team
              </h2>
              <p className="text-base sm:text-lg text-slate-600 mb-6 md:mb-8 px-4 sm:px-0">
                Need a tailored demo or want to connect a new dataset? We can help.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4 sm:px-0">
                <a
                  href="mailto:contact@klaros.app"
                  className="px-6 py-3 rounded-full bg-slate-900 text-white font-medium hover:bg-slate-800 transition-colors text-center"
                >
                  Email Us
                </a>
                <a
                  href="#"
                  className="px-6 py-3 rounded-full border border-border font-medium hover:bg-slate-100 transition-colors text-center"
                >
                  Request a demo
                </a>
              </div>
            </div>
          </div>
        </section>
        <CTA />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
