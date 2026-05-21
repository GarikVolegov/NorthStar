import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { and, eq, isNull, sql } from "drizzle-orm";
import { affiliateAccountsTable, affiliateReferralsTable, db, usersTable } from "@workspace/db";
import { JWT_SECRET } from "../lib/jwt-secret";

const { sign } = jwt;

export const DEV_MODE = process.env.NODE_ENV !== "production";

export interface JwtPayload {
  userId: number;
  name: string;
  email: string;
  role: "user" | "admin";
  onboardingCompleted: boolean;
  journeyType: string | null;
  stripeSubscriptionId: string | null;
  testSessionId: number | null;
}

export function generateToken(user: JwtPayload): string {
  return sign(user, JWT_SECRET, { expiresIn: "7d" });
}

export function generateVerificationCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export function buildJwtPayload(user: {
  id: number;
  name: string;
  email: string;
  role: string | null;
  onboardingCompleted: boolean | null;
  journeyType: string | null;
  stripeSubscriptionId: string | null;
  testSessionId: number | null;
}): JwtPayload {
  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role === "admin" ? "admin" : "user",
    onboardingCompleted: user.onboardingCompleted ?? false,
    journeyType: user.journeyType,
    stripeSubscriptionId: user.stripeSubscriptionId,
    testSessionId: user.testSessionId,
  };
}

type ReferralAccount = typeof affiliateAccountsTable.$inferSelect;

export function readReferralCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const code = input.trim();
  return code.length > 0 ? code : null;
}

export function readStringField(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === "string" ? value : "";
}

export async function findReferralAccount(referralCode: string | null): Promise<ReferralAccount | null> {
  if (!referralCode) return null;
  const [account] = await db
    .select()
    .from(affiliateAccountsTable)
    .where(and(eq(affiliateAccountsTable.referralCode, referralCode), isNull(affiliateAccountsTable.deletedAt)))
    .limit(1);
  if (!account || account.status === "suspended") return null;
  return account;
}

export async function recordReferral(account: ReferralAccount | null, referredUserId: number): Promise<void> {
  if (!account || account.userId === referredUserId) return;
  const inserted = await db
    .insert(affiliateReferralsTable)
    .values({ affiliateId: account.id, referrerUserId: account.userId, referredUserId, status: "active", activatedAt: new Date() })
    .onConflictDoNothing()
    .returning({ id: affiliateReferralsTable.id });
  if (inserted.length === 0) return;
  await db
    .update(affiliateAccountsTable)
    .set({ totalReferrals: sql`${affiliateAccountsTable.totalReferrals} + 1`, updatedAt: new Date() })
    .where(eq(affiliateAccountsTable.id, account.id));
}

export async function findUserByEmail(email: string): Promise<Array<{ id: number }>> {
  return await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email)).limit(1);
}
