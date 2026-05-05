import { prisma } from "./db";

type ClerkUserPayload = {
  clerkUserId: string;
  email?: string | null;
  fullName?: string | null;
};

export async function getOrCreateUser(payload: ClerkUserPayload) {
  const existing = await prisma.user.findUnique({
    where: { clerkUserId: payload.clerkUserId },
  });

  if (existing) {
    return existing;
  }

  return prisma.user.create({
    data: {
      clerkUserId: payload.clerkUserId,
      email: payload.email ?? undefined,
      fullName: payload.fullName ?? undefined,
    },
  });
}
