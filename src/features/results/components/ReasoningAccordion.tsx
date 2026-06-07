import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Brain, Lightbulb, Scale, AlertTriangle, Activity } from "lucide-react";
import type { AnalysisResult } from "@/features/decisions/types/decision";

interface ReasoningAccordionProps {
  reasoning: AnalysisResult["reasoning"];
}

export function ReasoningAccordion({ reasoning }: ReasoningAccordionProps) {
  const sections = [
    {
      id: "decomposition",
      title: "Analysis Breakdown",
      icon: Brain,
      content: reasoning.decomposition,
    },
    {
      id: "assumptions",
      title: "Key Assumptions",
      icon: Lightbulb,
      content: reasoning.assumptions,
    },
    {
      id: "tradeoffs",
      title: "Trade-offs",
      icon: Scale,
      content: reasoning.tradeoffs,
    },
    {
      id: "risks",
      title: "Potential Risks",
      icon: AlertTriangle,
      content: reasoning.risks,
    },
    {
      id: "sensitivity",
      title: "Sensitivity Analysis",
      icon: Activity,
      content: reasoning.sensitivity,
    },
  ];

  return (
    <div className="rounded-2xl border bg-card p-6">
      <h3 className="font-semibold mb-4">Reasoning & Analysis</h3>
      
      <Accordion type="multiple" defaultValue={["decomposition"]} className="space-y-2">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <AccordionItem
              key={section.id}
              value={section.id}
              className="border rounded-xl px-4 data-[state=open]:bg-muted/30"
            >
              <AccordionTrigger className="hover:no-underline gap-3 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-medium text-sm">{section.title}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-1 pl-11 pr-2">
                {Array.isArray(section.content) ? (
                  <ul className="space-y-2">
                    {section.content.map((item, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {section.content}
                  </p>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
