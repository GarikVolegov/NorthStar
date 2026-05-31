import { beforeEach, describe, expect, it, vi } from "vitest";

const dbHarness = vi.hoisted(() => {
  const state = {
    selectRows: [] as unknown[],
    updateRows: [] as unknown[],
    selectWhere: [] as unknown[],
    updateWhere: [] as unknown[],
    setPatch: undefined as unknown,
  };

  return {
    state,
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn((condition: unknown) => {
            state.selectWhere.push(condition);
            return {
              limit: vi.fn(() => Promise.resolve(state.selectRows)),
            };
          }),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((patch: unknown) => {
          state.setPatch = patch;
          return {
            where: vi.fn((condition: unknown) => {
              state.updateWhere.push(condition);
              return {
                returning: vi.fn(() => Promise.resolve(state.updateRows)),
              };
            }),
          };
        }),
      })),
    },
  };
});

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...conditions: unknown[]) => ({ op: "and", conditions })),
  desc: vi.fn((column: unknown) => ({ op: "desc", column })),
  eq: vi.fn((left: unknown, right: unknown) => ({ op: "eq", left, right })),
  ilike: vi.fn((left: unknown, right: unknown) => ({ op: "ilike", left, right })),
  inArray: vi.fn((left: unknown, right: unknown) => ({ op: "inArray", left, right })),
  isNull: vi.fn((left: unknown) => ({ op: "isNull", left })),
  or: vi.fn((...conditions: unknown[]) => ({ op: "or", conditions })),
  sql: vi.fn(() => ({ op: "sql" })),
}));

vi.mock("@workspace/db", () => ({
  db: dbHarness.db,
  discoveryItemsTable: {},
  educationPathsTable: {},
  growthArticlesTable: {},
  newsArticlesTable: {},
  professionEducationPathsTable: {},
  professionsTable: {},
  sectorsTable: {},
  userObjectivesTable: {
    id: "user_objectives.id",
    userId: "user_objectives.user_id",
    progress: "user_objectives.progress",
    completed: "user_objectives.completed",
    updatedAt: "user_objectives.updated_at",
    deletedAt: "user_objectives.deleted_at",
  },
}));

vi.mock("./tool-handlers", () => ({
  checkWriteRateLimit: vi.fn(() => true),
  err: (code: string, message: string) => ({ ok: false, code, message }),
  queryEmbedding: vi.fn(),
}));

vi.mock("../logger", () => ({
  logger: { warn: vi.fn() },
}));

import { handleUpdateObjectiveProgress } from "./tool-handlers-data";

function andConditions(value: unknown): unknown[] {
  return value && typeof value === "object" && "conditions" in value
    ? (value as { conditions: unknown[] }).conditions
    : [];
}

describe("handleUpdateObjectiveProgress", () => {
  beforeEach(() => {
    dbHarness.state.selectRows = [];
    dbHarness.state.updateRows = [];
    dbHarness.state.selectWhere = [];
    dbHarness.state.updateWhere = [];
    dbHarness.state.setPatch = undefined;
    dbHarness.db.select.mockClear();
    dbHarness.db.update.mockClear();
  });

  it("rejects NaN objective ids before querying", async () => {
    const result = await handleUpdateObjectiveProgress({ objectiveId: Number.NaN, progress: 55 }, 7);

    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message: expect.stringContaining("ID obiettivo"),
    });
    expect(dbHarness.db.select).not.toHaveBeenCalled();
  });

  it("rejects NaN progress before querying", async () => {
    const result = await handleUpdateObjectiveProgress({ objectiveId: 42, progress: Number.NaN }, 7);

    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message: expect.stringContaining("progresso"),
    });
    expect(dbHarness.db.select).not.toHaveBeenCalled();
  });

  it("returns a clear not-found error for non-owned or deleted objectives", async () => {
    dbHarness.state.selectRows = [];

    const result = await handleUpdateObjectiveProgress({ objectiveId: 42, progress: 55 }, 7);

    expect(result).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
      message: expect.stringContaining("non appartiene"),
    });
  });

  it("filters active owned objectives on both select and update", async () => {
    dbHarness.state.selectRows = [{ id: 42 }];
    dbHarness.state.updateRows = [{ id: 42 }];

    const result = await handleUpdateObjectiveProgress({ objectiveId: 42, progress: 100 }, 7);

    expect(result).toEqual({ ok: true, data: { ok: true } });
    expect(andConditions(dbHarness.state.selectWhere[0])).toEqual(expect.arrayContaining([
      { op: "eq", left: "user_objectives.id", right: 42 },
      { op: "eq", left: "user_objectives.user_id", right: 7 },
      { op: "isNull", left: "user_objectives.deleted_at" },
    ]));
    expect(andConditions(dbHarness.state.updateWhere[0])).toEqual(expect.arrayContaining([
      { op: "eq", left: "user_objectives.id", right: 42 },
      { op: "eq", left: "user_objectives.user_id", right: 7 },
      { op: "isNull", left: "user_objectives.deleted_at" },
    ]));
    expect(dbHarness.state.setPatch).toMatchObject({ progress: 100, completed: true });
  });

  it("returns a clear not-found error when the objective disappears before update", async () => {
    dbHarness.state.selectRows = [{ id: 42 }];
    dbHarness.state.updateRows = [];

    const result = await handleUpdateObjectiveProgress({ objectiveId: 42, progress: 55 }, 7);

    expect(result).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
      message: expect.stringContaining("non appartiene"),
    });
  });
});
