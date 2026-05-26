import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import type { AdminWendyRisk } from "./admin-wendy-schemas";

export interface AdminWendyTokenAction {
  actionId: string;
  toolName: string;
  risk: AdminWendyRisk;
  section: string;
  adminUserId: number;
  payload: Record<string, unknown>;
  requestId: string;
}

export interface AdminWendyTokenPayload extends AdminWendyTokenAction {
  payloadHash: string;
  expiresAt: number;
}

export interface CreateAdminWendyActionTokenInput {
  secret: string;
  now: number;
  ttlMs: number;
  action: AdminWendyTokenAction;
}

export interface VerifyAdminWendyActionTokenInput {
  token: string;
  secret: string;
  now: number;
  adminUserId: number;
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(",")}}`;
}

function hashPayload(payload: Record<string, unknown>): string {
  return createHash("sha256").update(stableJson(payload)).digest("hex");
}

function sign(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function signaturesMatch(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function isRisk(value: unknown): value is AdminWendyRisk {
  return value === "low" || value === "medium" || value === "high";
}

function isPayload(value: unknown): value is AdminWendyTokenPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.actionId === "string" &&
    typeof record.toolName === "string" &&
    isRisk(record.risk) &&
    typeof record.section === "string" &&
    typeof record.adminUserId === "number" &&
    Number.isInteger(record.adminUserId) &&
    Boolean(record.payload) &&
    typeof record.payload === "object" &&
    !Array.isArray(record.payload) &&
    typeof record.payloadHash === "string" &&
    typeof record.expiresAt === "number" &&
    typeof record.requestId === "string"
  );
}

export function createAdminWendyActionToken(input: CreateAdminWendyActionTokenInput): string {
  const payload: AdminWendyTokenPayload = {
    ...input.action,
    payloadHash: hashPayload(input.action.payload),
    expiresAt: input.now + input.ttlMs,
  };
  const encodedPayload = encodeBase64Url(stableJson(payload));
  return `${encodedPayload}.${sign(encodedPayload, input.secret)}`;
}

export function verifyAdminWendyActionToken(
  input: VerifyAdminWendyActionTokenInput,
): AdminWendyTokenPayload {
  const [encodedPayload, signature, extra] = input.token.split(".");
  if (!encodedPayload || !signature || extra !== undefined) {
    throw new Error("Invalid admin action token");
  }

  const expectedSignature = sign(encodedPayload, input.secret);
  if (!signaturesMatch(signature, expectedSignature)) {
    throw new Error("Invalid admin action token");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeBase64Url(encodedPayload)) as unknown;
  } catch {
    throw new Error("Invalid admin action token");
  }

  if (!isPayload(parsed)) {
    throw new Error("Invalid admin action token");
  }

  if (hashPayload(parsed.payload) !== parsed.payloadHash) {
    throw new Error("Invalid admin action token");
  }
  if (parsed.expiresAt < input.now) {
    throw new Error("Admin action token expired");
  }
  if (parsed.adminUserId !== input.adminUserId) {
    throw new Error("Admin action token user mismatch");
  }

  return parsed;
}

export function getAdminWendyActionSecret(): string {
  return process.env.WENDY_ADMIN_ACTION_SECRET ?? process.env.JWT_SECRET ?? "dev-wendy-admin-action-secret";
}
