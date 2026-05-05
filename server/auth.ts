import "./env";
import type { Request, Response, NextFunction } from "express";
import { createClerkClient, verifyToken } from "@clerk/backend";
import { getOrCreateUser } from "./user-repo";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) {
    res.status(500).json({ error: "CLERK_SECRET_KEY not configured" });
    return;
  }

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    res.status(401).json({ error: "unauthorized", message: "Missing auth token" });
    return;
  }

  try {
    const payload = await verifyToken(token, { secretKey: clerkSecretKey });
    const clerkUserId = payload.sub;

    if (!clerkUserId) {
      res.status(401).json({ error: "unauthorized", message: "Unauthorized" });
      return;
    }

    let email: string | undefined;
    let fullName: string | undefined;

    try {
      const clerkClient = createClerkClient({ secretKey: clerkSecretKey });
      const user = await clerkClient.users.getUser(clerkUserId);
      email = user.primaryEmailAddress?.emailAddress ?? undefined;
      fullName = user.fullName ?? undefined;
    } catch (userError) {
      console.warn("Clerk user fetch failed, continuing with token payload only.", userError);
    }

    const dbUser = await getOrCreateUser({
      clerkUserId,
      email,
      fullName,
    });

    req.auth = {
      clerkUserId,
      userId: dbUser.id,
      email,
      fullName,
    };

    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    const lowered = message.toLowerCase();
    console.error("Auth error:", error);
    if (lowered.includes("expired")) {
      res.status(401).json({ error: "token_expired", message: "Your session has expired. Please log out and log in again." });
      return;
    }
    res.status(401).json({ error: "unauthorized", message: "Unauthorized" });
  }
}
