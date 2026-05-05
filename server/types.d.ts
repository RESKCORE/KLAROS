import "express";

declare module "express-serve-static-core" {
  interface Request {
    auth?: {
      clerkUserId: string;
      userId: string;
      email?: string;
      fullName?: string;
    };
  }
}
