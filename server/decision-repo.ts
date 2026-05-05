import { prisma } from "./db";

type DecisionStatus = "draft" | "analyzing" | "done" | "archived";

type CreateDecisionInput = {
  userId: string;
  title: string;
  context?: string | null;
  status?: DecisionStatus;
};

export async function createDecision(input: CreateDecisionInput) {
  return prisma.decision.create({
    data: {
      userId: input.userId,
      title: input.title,
      context: input.context ?? undefined,
      status: input.status ?? "draft",
    },
    include: {
      options: true,
      criteria: true,
      constraints: true,
    },
  });
}

export async function getDecisionWithDetails(decisionId: string) {
  return prisma.decision.findUnique({
    where: { id: decisionId },
    include: {
      options: true,
      criteria: true,
      constraints: true,
    },
  });
}

export async function listUserDecisions(userId: string, statuses: DecisionStatus[] = []) {
  return prisma.decision.findMany({
    where: {
      userId,
      ...(statuses.length > 0 ? { status: { in: statuses } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      options: true,
      criteria: true,
    },
  });
}

export async function addDecisionOption(decisionId: string, label: string) {
  return prisma.option.create({
    data: {
      decisionId,
      label,
    },
  });
}

export async function addDecisionCriterion(decisionId: string, name: string, weight: number) {
  return prisma.criterion.create({
    data: {
      decisionId,
      name,
      weight,
    },
  });
}
