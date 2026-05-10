import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyToken } from "./auth-jwt";

export function getAuthenticatedUserId(req: {
  headers: { authorization?: string };
  session?: { userId?: unknown };
}): number | undefined {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    const result = verifyToken(token);
    if (result?.userId) return result.userId;
  }
  if (typeof req.session?.userId === "number") {
    return req.session.userId;
  }
  return undefined;
}

export async function getUserPlan(userId: number): Promise<"free" | "premium"> {
  try {
    const [user] = await db
      .select({ stripeSubscriptionId: usersTable.stripeSubscriptionId })
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    return user?.stripeSubscriptionId ? "premium" : "free";
  } catch {
    return "free";
  }
}
