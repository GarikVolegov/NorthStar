import { rootLogger } from "../middleware/logger";

export type SecurityEventType =
  | "cors_blocked"
  | "auth_failed"
  | "auth_success"
  | "admin_access"
  | "rate_limit_hit"
  | "invalid_webhook_signature"
  | "password_changed"
  | "account_deleted";

export interface SecurityEventContext {
  userId?: string | number | undefined;
  ip?: string | undefined;
  origin?: string | undefined;
  detail?: string | undefined;
}

const suspiciousEvents = new Set<SecurityEventType>([
  "cors_blocked",
  "auth_failed",
  "rate_limit_hit",
  "invalid_webhook_signature",
]);

export function logSecurityEvent(
  type: SecurityEventType,
  context: SecurityEventContext = {},
): void {
  const payload = {
    timestamp: new Date().toISOString(),
    type,
    userId: context.userId,
    ip: context.ip,
    origin: context.origin,
    detail: context.detail,
  };

  if (suspiciousEvents.has(type)) {
    rootLogger.warn(payload, "[security] event");
    return;
  }

  rootLogger.info(payload, "[security] event");
}
