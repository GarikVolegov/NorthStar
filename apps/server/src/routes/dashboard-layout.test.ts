import { describe, expect, it } from "vitest";

import {
  getDefaultDashboardLayout,
  normalizeDashboardLayout,
  validateDashboardLayout,
} from "./dashboard-layout";

describe("dashboard-layout validation", () => {
  it("rejects old ghost widget ids on save", () => {
    const result = validateDashboardLayout(
      [{ id: "progress_objectives", position: 0, visible: true, size: "lg" }],
      "dipendente",
    );

    expect(result).toEqual({ error: "sezione dashboard non riconosciuta: progress_objectives" });
  });

  it("falls back to journey defaults when stored layout contains ghost widget ids", () => {
    const result = normalizeDashboardLayout(
      [{ id: "job_feed", position: 0, visible: true, size: "md" }],
      "dipendente",
    );

    expect(result).toEqual(getDefaultDashboardLayout("dipendente"));
  });
});
