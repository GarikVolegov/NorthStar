import { describe, it, expect, vi } from "vitest";

// The module imports the DB pool and logger at top level; stub them so these
// pure-parser tests stay hermetic (no real DB — DB_RULES). The functions under
// test (event/metadata/price/subscription parsing) don't touch the DB. The
// commission logic (applyAffiliateCommissionForInvoice) is DB-bound and is
// covered by real-DB integration tests, not here.
vi.mock("@workspace/db", () => ({
  db: {},
  affiliateAccountsTable: {},
  affiliateCommissionsTable: {},
  affiliateReferralsTable: {},
  subscriptionsTable: {},
  usersTable: {},
}));
vi.mock("../middleware/logger", () => ({
  rootLogger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

import {
  readSubscriptionId,
  normalizeStripeEvent,
  readMetadata,
  readSubscriptionPriceId,
} from "./stripe-webhook-helpers";

describe("normalizeStripeEvent", () => {
  it("parses a valid event with a type and a non-empty object", () => {
    const ev = normalizeStripeEvent({
      type: "invoice.paid",
      data: { object: { id: "in_1" } },
    });
    expect(ev).toEqual({ type: "invoice.paid", data: { object: { id: "in_1" } } });
  });

  it("returns null when the type is missing", () => {
    expect(
      normalizeStripeEvent({ data: { object: { id: "in_1" } } }),
    ).toBeNull();
  });

  it("returns null when the data object is empty", () => {
    expect(
      normalizeStripeEvent({ type: "invoice.paid", data: { object: {} } }),
    ).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(normalizeStripeEvent("nope")).toBeNull();
    expect(normalizeStripeEvent(null)).toBeNull();
    expect(normalizeStripeEvent(undefined)).toBeNull();
  });
});

describe("readSubscriptionId", () => {
  it("reads a string subscription id", () => {
    expect(readSubscriptionId({ subscription: "sub_123" })).toBe("sub_123");
  });

  it("reads a nested subscription object id", () => {
    expect(readSubscriptionId({ subscription: { id: "sub_456" } })).toBe(
      "sub_456",
    );
  });

  it("returns null when absent or the nested id is not a string", () => {
    expect(readSubscriptionId({})).toBeNull();
    expect(readSubscriptionId({ subscription: { id: 99 } })).toBeNull();
  });
});

describe("readSubscriptionPriceId", () => {
  it("extracts items.data[0].price.id", () => {
    expect(
      readSubscriptionPriceId({
        items: { data: [{ price: { id: "price_1" } }] },
      }),
    ).toBe("price_1");
  });

  it("returns undefined when the shape is missing", () => {
    expect(readSubscriptionPriceId({})).toBeUndefined();
    expect(readSubscriptionPriceId({ items: { data: [] } })).toBeUndefined();
  });
});

describe("readMetadata", () => {
  it("keeps only string-valued entries", () => {
    expect(readMetadata({ a: "x", b: 2, c: "y", d: null })).toEqual({
      a: "x",
      c: "y",
    });
  });

  it("returns an empty object for non-object input", () => {
    expect(readMetadata(undefined)).toEqual({});
    expect(readMetadata("nope")).toEqual({});
  });
});
