import { Router, type Request, type Response } from "express";
import { db, subscriptionsTable, usersTable } from "@workspace/db";
import { and, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { writeAuditLog } from "../../middleware/audit";
import { rootLogger } from "../../middleware/logger";
import { invalidatePlanCache } from "../../middleware/check-feature";
import { getRequestBody } from "../../lib/request-context";
import { asPlainRecord, isOneOf } from "../../lib/type-guards";

const router = Router();

const SUBSCRIPTION_PLANS = ["free", "pro", "team"] as const;
type AdminSubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];
type AdminSubscriptionStatus = "free" | "active" | "expired" | "cancelled";

type AdminSubscriptionRow = {
  user_id: number;
  name: string;
  email: string;
  role: string;
  created_at: Date;
  user_stripe_subscription_id: string | null;
  subscription_id: number | null;
  plan: AdminSubscriptionPlan | null;
  valid_until: Date | null;
  cancelled_at: Date | null;
  subscription_created_at: Date | null;
  subscription_updated_at: Date | null;
  stripe_subscription_id: string | null;
  last_subscription_id: number | null;
  last_cancelled_at: Date | null;
  total_count: string | number;
};

function getLimit(req: Request, fallback = 100, max = 200) {
  return Math.max(1, Math.min(Number(req.query.limit) || fallback, max));
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function isSubscriptionPlan(value: unknown): value is AdminSubscriptionPlan {
  return isOneOf(value, SUBSCRIPTION_PLANS);
}

function parseAdminValidUntil(value: unknown): Date | null | undefined {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function maskStripeId(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.length <= 8 ? value : `...${value.slice(-8)}`;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function subscriptionStatus(
  row: {
    id?: number | null;
    validUntil?: Date | null;
    cancelledAt?: Date | null;
  } | null,
): AdminSubscriptionStatus {
  if (!row?.id) return row?.cancelledAt ? "cancelled" : "free";
  if (row.cancelledAt) return "cancelled";
  if (row.validUntil && row.validUntil < new Date()) return "expired";
  return "active";
}

function effectivePlan(
  row: {
    plan?: string | null;
    id?: number | null;
    validUntil?: Date | null;
    cancelledAt?: Date | null;
  } | null,
): AdminSubscriptionPlan {
  return subscriptionStatus(row) === "active" && isSubscriptionPlan(row?.plan)
    ? row.plan
    : "free";
}

function adminSubscriptionItem(row: AdminSubscriptionRow) {
  const current = {
    id: row.subscription_id,
    plan: effectivePlan({
      id: row.subscription_id,
      plan: row.plan,
      validUntil: row.valid_until,
      cancelledAt: row.cancelled_at,
    }),
    rawPlan: row.plan,
    status: subscriptionStatus({
      id: row.subscription_id,
      validUntil: row.valid_until,
      cancelledAt: row.cancelled_at ?? row.last_cancelled_at,
    }),
    source: row.subscription_id
      ? row.stripe_subscription_id
        ? "stripe"
        : "internal"
      : "free",
    validUntil: toIso(row.valid_until),
    cancelledAt: toIso(row.cancelled_at) ?? toIso(row.last_cancelled_at),
    createdAt: toIso(row.subscription_created_at),
    updatedAt: toIso(row.subscription_updated_at),
    hasStripeSubscription: Boolean(
      row.stripe_subscription_id || row.user_stripe_subscription_id,
    ),
    stripeSubscriptionId: maskStripeId(
      row.stripe_subscription_id ?? row.user_stripe_subscription_id,
    ),
  };

  return {
    user: {
      id: row.user_id,
      name: row.name,
      email: row.email,
      role: row.role,
      createdAt: toIso(row.created_at),
    },
    current,
  };
}

async function getAdminSubscriptionDetail(userId: number) {
  const [user] = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      createdAt: usersTable.createdAt,
      stripeSubscriptionId: usersTable.stripeSubscriptionId,
      isPremium: usersTable.isPremium,
    })
    .from(usersTable)
    .where(and(eq(usersTable.id, userId), isNull(usersTable.deletedAt)))
    .limit(1);

  if (!user) return null;

  const history = await db
    .select({
      id: subscriptionsTable.id,
      plan: subscriptionsTable.plan,
      validUntil: subscriptionsTable.validUntil,
      cancelledAt: subscriptionsTable.cancelledAt,
      stripeSubscriptionId: subscriptionsTable.stripeSubscriptionId,
      createdAt: subscriptionsTable.createdAt,
      updatedAt: subscriptionsTable.updatedAt,
    })
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId))
    .orderBy(desc(subscriptionsTable.createdAt))
    .limit(20);

  const current = history.find((row) => !row.cancelledAt) ?? null;
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: toIso(user.createdAt),
    },
    current: {
      id: current?.id ?? null,
      plan: effectivePlan(current),
      rawPlan: current?.plan ?? null,
      status: current
        ? subscriptionStatus(current)
        : history[0]?.cancelledAt
          ? "cancelled"
          : "free",
      source: current
        ? current.stripeSubscriptionId
          ? "stripe"
          : "internal"
        : "free",
      validUntil: toIso(current?.validUntil),
      cancelledAt:
        toIso(current?.cancelledAt) ?? toIso(history[0]?.cancelledAt),
      createdAt: toIso(current?.createdAt),
      updatedAt: toIso(current?.updatedAt),
      hasStripeSubscription: Boolean(
        current?.stripeSubscriptionId || user.stripeSubscriptionId,
      ),
      stripeSubscriptionId: maskStripeId(
        current?.stripeSubscriptionId ?? user.stripeSubscriptionId,
      ),
    },
    history: history.map((row) => ({
      id: row.id,
      plan: row.plan,
      effectivePlan: effectivePlan(row),
      status: subscriptionStatus(row),
      source: row.stripeSubscriptionId ? "stripe" : "internal",
      validUntil: toIso(row.validUntil),
      cancelledAt: toIso(row.cancelledAt),
      createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
      updatedAt:
        toIso(row.updatedAt) ??
        toIso(row.createdAt) ??
        new Date().toISOString(),
      hasStripeSubscription: Boolean(row.stripeSubscriptionId),
      stripeSubscriptionId: maskStripeId(row.stripeSubscriptionId),
    })),
  };
}

router.get("/subscriptions", async (req: Request, res: Response) => {
  try {
    const limit = getLimit(req, 50, 100);
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const query = stringValue(req.query.search);
    const plan = stringValue(req.query.plan, "all");
    const status = stringValue(req.query.status, "all");
    const whereParts = [sql`u.deleted_at IS NULL`];

    if (query) {
      const pattern = `%${query}%`;
      whereParts.push(
        sql`(u.name ILIKE ${pattern} OR u.email ILIKE ${pattern})`,
      );
    }
    if (isSubscriptionPlan(plan) && plan !== "free") {
      whereParts.push(
        sql`active_sub.id IS NOT NULL AND active_sub.plan = ${plan} AND (active_sub.valid_until IS NULL OR active_sub.valid_until >= now())`,
      );
    } else if (plan === "free") {
      whereParts.push(
        sql`(active_sub.id IS NULL OR active_sub.plan = 'free' OR active_sub.valid_until < now())`,
      );
    }
    if (status === "active") {
      whereParts.push(
        sql`active_sub.id IS NOT NULL AND (active_sub.valid_until IS NULL OR active_sub.valid_until >= now())`,
      );
    } else if (status === "expired") {
      whereParts.push(
        sql`active_sub.id IS NOT NULL AND active_sub.valid_until < now()`,
      );
    } else if (status === "cancelled") {
      whereParts.push(
        sql`active_sub.id IS NULL AND latest_sub.cancelled_at IS NOT NULL`,
      );
    } else if (status === "free") {
      whereParts.push(sql`active_sub.id IS NULL`);
    }

    const whereSql = sql.join(whereParts, sql` AND `);
    const rows = await db.execute<AdminSubscriptionRow>(sql`
      WITH active_sub AS (
        SELECT DISTINCT ON (user_id)
          id, user_id, plan, valid_until, cancelled_at, created_at, updated_at, stripe_subscription_id
        FROM subscriptions
        WHERE cancelled_at IS NULL
        ORDER BY user_id, created_at DESC
      ),
      latest_sub AS (
        SELECT DISTINCT ON (user_id)
          id, user_id, cancelled_at
        FROM subscriptions
        ORDER BY user_id, created_at DESC
      ),
      filtered AS (
        SELECT
          u.id AS user_id,
          u.name,
          u.email,
          u.role,
          u.created_at,
          u.stripe_subscription_id AS user_stripe_subscription_id,
          active_sub.id AS subscription_id,
          active_sub.plan,
          active_sub.valid_until,
          active_sub.cancelled_at,
          active_sub.created_at AS subscription_created_at,
          active_sub.updated_at AS subscription_updated_at,
          active_sub.stripe_subscription_id,
          latest_sub.id AS last_subscription_id,
          latest_sub.cancelled_at AS last_cancelled_at
        FROM users u
        LEFT JOIN active_sub ON active_sub.user_id = u.id
        LEFT JOIN latest_sub ON latest_sub.user_id = u.id
        WHERE ${whereSql}
      )
      SELECT *, count(*) OVER() AS total_count
      FROM filtered
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const items = rows.rows.map(adminSubscriptionItem);
    const firstRow = rows.rows[0];
    const total = firstRow ? Number(firstRow.total_count) || 0 : 0;
    const statsRows = await db.execute<{ plan: string; count: string }>(sql`
      WITH active_sub AS (
        SELECT DISTINCT ON (user_id) id, user_id, plan, valid_until, cancelled_at, created_at
        FROM subscriptions
        WHERE cancelled_at IS NULL
        ORDER BY user_id, created_at DESC
      )
      SELECT
        CASE
          WHEN active_sub.id IS NULL OR active_sub.valid_until < now() THEN 'free'
          ELSE active_sub.plan
        END AS plan,
        count(*)::text AS count
      FROM users u
      LEFT JOIN active_sub ON active_sub.user_id = u.id
      WHERE u.deleted_at IS NULL
      GROUP BY 1
    `);
    const stats = { total: 0, free: 0, pro: 0, team: 0 };
    for (const row of statsRows.rows) {
      if (row.plan === "free" || row.plan === "pro" || row.plan === "team") {
        stats[row.plan] = Number(row.count) || 0;
      }
    }
    stats.total = stats.free + stats.pro + stats.team;

    res.json({
      generatedAt: new Date().toISOString(),
      items,
      total,
      limit,
      offset,
      stats,
    });
  } catch (err) {
    rootLogger.error({ err }, "[admin/subscriptions] list error");
    res.status(500).json({ error: "Impossibile caricare gli abbonamenti" });
  }
});

router.get("/subscriptions/:userId", async (req: Request, res: Response) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    res.status(400).json({ error: "Utente non valido" });
    return;
  }

  try {
    const detail = await getAdminSubscriptionDetail(userId);
    if (!detail) {
      res.status(404).json({ error: "Utente non trovato" });
      return;
    }
    res.json(detail);
  } catch (err) {
    rootLogger.error({ err, userId }, "[admin/subscriptions] detail error");
    res
      .status(500)
      .json({ error: "Impossibile caricare il dettaglio abbonamento" });
  }
});

router.patch("/subscriptions/:userId", async (req: Request, res: Response) => {
  const userId = Number(req.params.userId);
  const body = asPlainRecord(getRequestBody(req));
  const plan = body.plan;
  const reason = stringValue(body.reason);
  const validUntil = parseAdminValidUntil(body.validUntil);

  if (!Number.isInteger(userId) || userId <= 0) {
    res.status(400).json({ error: "Utente non valido" });
    return;
  }
  if (!isSubscriptionPlan(plan)) {
    res
      .status(400)
      .json({
        error: "Piano non valido",
        fields: { plan: "Scegli Free, Pro o Team." },
      });
    return;
  }
  if (reason.length < 3) {
    res
      .status(400)
      .json({
        error: "Motivazione obbligatoria",
        fields: { reason: "Inserisci il motivo della modifica." },
      });
    return;
  }
  if (validUntil === undefined) {
    res
      .status(400)
      .json({
        error: "Scadenza non valida",
        fields: { validUntil: "Inserisci una data valida o lascia vuoto." },
      });
    return;
  }

  try {
    const before = await getAdminSubscriptionDetail(userId);
    if (!before) {
      res.status(404).json({ error: "Utente non trovato" });
      return;
    }

    await db.transaction(async (tx) => {
      const activeRows = await tx
        .select({ id: subscriptionsTable.id })
        .from(subscriptionsTable)
        .where(
          and(
            eq(subscriptionsTable.userId, userId),
            isNull(subscriptionsTable.cancelledAt),
          ),
        )
        .orderBy(desc(subscriptionsTable.createdAt));

      if (plan === "free") {
        await tx
          .update(subscriptionsTable)
          .set({ cancelledAt: new Date(), updatedAt: new Date() })
          .where(
            and(
              eq(subscriptionsTable.userId, userId),
              isNull(subscriptionsTable.cancelledAt),
            ),
          );
        await tx
          .update(usersTable)
          .set({ isPremium: false, updatedAt: new Date() })
          .where(eq(usersTable.id, userId));
        return;
      }

      const [latestActive] = activeRows;
      if (latestActive) {
        await tx
          .update(subscriptionsTable)
          .set({ plan, validUntil, updatedAt: new Date() })
          .where(eq(subscriptionsTable.id, latestActive.id));

        if (activeRows.length > 1) {
          await tx
            .update(subscriptionsTable)
            .set({ cancelledAt: new Date(), updatedAt: new Date() })
            .where(
              and(
                eq(subscriptionsTable.userId, userId),
                isNull(subscriptionsTable.cancelledAt),
                ne(subscriptionsTable.id, latestActive.id),
              ),
            );
        }
      } else {
        await tx.insert(subscriptionsTable).values({
          userId,
          plan,
          validUntil,
        });
      }

      await tx
        .update(usersTable)
        .set({ isPremium: true, updatedAt: new Date() })
        .where(eq(usersTable.id, userId));
    });

    invalidatePlanCache(userId);
    const after = await getAdminSubscriptionDetail(userId);
    void writeAuditLog(req, {
      action: "admin_subscription_updated",
      category: "admin_action",
      targetId: userId,
      metadata: {
        reason,
        before: before.current,
        after: after?.current ?? null,
        stripeUnchanged: true,
      },
    });

    res.json({ ok: true, detail: after });
  } catch (err) {
    rootLogger.error({ err, userId }, "[admin/subscriptions] update error");
    res.status(500).json({ error: "Modifica abbonamento non riuscita" });
  }
});

export default router;
