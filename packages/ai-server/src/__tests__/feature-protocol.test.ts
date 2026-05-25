import { describe, expect, it, beforeEach } from "vitest";
import {
  calendarFeatureManifest,
  objectivesFeatureManifest,
  profileFeatureManifest,
  sectorsFeatureManifest,
  featureManifests,
  getFeatureManifest,
  listFeatureManifests,
  listWendyToolsFromFeatures,
  registerFeatureManifest,
  resetFeatureManifests,
  validateFeatureManifest,
  validateWendyToolContract,
} from "../feature-protocol";
import type { FeatureManifest } from "../feature-protocol";

describe("Feature Protocol", () => {
  beforeEach(() => {
    resetFeatureManifests();
  });

  it("accepts the calendar pilot manifest", () => {
    const result = validateFeatureManifest(calendarFeatureManifest);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("accepts the sectors protocol manifest with read and navigation tools", () => {
    const result = validateFeatureManifest(sectorsFeatureManifest);
    expect(result.ok).toBe(true);
    expect(sectorsFeatureManifest.wendyTools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "list_sectors", policy: "read", risk: "low" }),
        expect.objectContaining({ name: "get_sector_detail", policy: "read", risk: "low" }),
        expect.objectContaining({ name: "open_view:settore", policy: "navigate", risk: "low" }),
      ]),
    );
  });

  it("accepts the profile protocol manifest with confirmed write tools", () => {
    const result = validateFeatureManifest(profileFeatureManifest);
    expect(result.ok).toBe(true);
    expect(profileFeatureManifest.wendyTools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "get_user_context", policy: "read", risk: "low" }),
        expect.objectContaining({ name: "open_view:profilo", policy: "navigate", risk: "low" }),
        expect.objectContaining({
          name: "update_profile_preferences",
          policy: "write",
          risk: "medium",
          requiresConfirmation: true,
        }),
      ]),
    );
  });

  it("accepts the objectives protocol manifest with confirmed mutation tools", () => {
    const result = validateFeatureManifest(objectivesFeatureManifest);
    expect(result.ok).toBe(true);
    expect(objectivesFeatureManifest.wendyTools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "get_user_objectives", policy: "read", risk: "low" }),
        expect.objectContaining({
          name: "save_objective",
          policy: "write",
          risk: "medium",
          requiresConfirmation: true,
        }),
        expect.objectContaining({
          name: "update_objective_progress",
          policy: "write",
          risk: "medium",
          requiresConfirmation: true,
        }),
      ]),
    );
  });

  it("rejects routes without schemas and smoke coverage", () => {
    const invalid: FeatureManifest = {
      ...calendarFeatureManifest,
      id: "broken-calendar",
      apiRoutes: [
        {
          method: "POST",
          path: "/api/calendar/events",
          auth: "authenticated",
        },
      ],
      smoke: [],
      tests: [],
    };

    const result = validateFeatureManifest(invalid);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("apiRoutes[0].schema is required");
    expect(result.errors).toContain("smoke must contain at least one smoke id");
    expect(result.errors).toContain("tests must contain at least one test reference");
  });

  it("requires high-risk and write/delete Wendy tools to use confirmation", () => {
    const result = validateWendyToolContract({
      name: "dangerous_delete",
      description: "Delete something",
      policy: "delete",
      risk: "high",
      requiresConfirmation: false,
      inputSchema: "DangerousDeleteInput",
      outputSchema: "WendyAction",
      telemetry: "wendy.dangerous_delete",
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("delete tools must require confirmation");
    expect(result.errors).toContain("high-risk tools must require confirmation");
  });

  it("registers feature manifests and exposes Wendy tools", () => {
    registerFeatureManifest(calendarFeatureManifest);

    expect(getFeatureManifest("calendar")).toBe(calendarFeatureManifest);
    expect(listFeatureManifests()).toHaveLength(1);
    expect(listWendyToolsFromFeatures()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          featureId: "calendar",
          name: "add_calendar_event",
          policy: "write",
        }),
      ]),
    );
  });

  it("calculates protocol coverage by status", () => {
    registerFeatureManifest(calendarFeatureManifest);
    registerFeatureManifest({
      ...calendarFeatureManifest,
      id: "legacy-placeholder",
      status: "legacy",
      wendyTools: [],
    });

    expect(featureManifests.coverage()).toMatchObject({
      total: 2,
      protocol: 1,
      pilot: 0,
      legacy: 1,
      protocolRatio: 0.5,
    });
  });
});
