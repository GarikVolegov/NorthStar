import { describe, it, expect } from "vitest";
import { getWorkModeAlignment } from "@/lib/work-mode-utils";

describe("getWorkModeAlignment", () => {
  describe("missing / unknown inputs → aligned (no opinion)", () => {
    it("returns aligned when userWorkMode is null", () => {
      const r = getWorkModeAlignment(null, ["dipendente"]);
      expect(r.type).toBe("aligned");
      expect(r.tooltipKey).toBe("");
    });

    it("returns aligned when userWorkMode is undefined", () => {
      const r = getWorkModeAlignment(undefined, ["autonomo"]);
      expect(r.type).toBe("aligned");
    });

    it("returns aligned when userWorkMode is 'unknown'", () => {
      const r = getWorkModeAlignment("unknown", ["dipendente", "ibrido"]);
      expect(r.type).toBe("aligned");
    });

    it("returns aligned when sectorModes is null", () => {
      const r = getWorkModeAlignment("dipendente", null);
      expect(r.type).toBe("aligned");
    });

    it("returns aligned when sectorModes is empty array", () => {
      const r = getWorkModeAlignment("dipendente", []);
      expect(r.type).toBe("aligned");
    });
  });

  describe("ibrido user", () => {
    it("returns aligned when sector includes ibrido", () => {
      const r = getWorkModeAlignment("ibrido", ["dipendente", "ibrido"]);
      expect(r.type).toBe("aligned");
      expect(r.tooltipKey).toBe("workModeAlignment.aligned");
    });

    it("returns partial when sector does NOT include ibrido", () => {
      const r = getWorkModeAlignment("ibrido", ["dipendente"]);
      expect(r.type).toBe("partial");
      expect(r.tooltipKey).toBe("workModeAlignment.partialHybrid");
    });
  });

  describe("dipendente user", () => {
    it("returns aligned when sector includes dipendente", () => {
      const r = getWorkModeAlignment("dipendente", ["dipendente", "ibrido"]);
      expect(r.type).toBe("aligned");
      expect(r.tooltipKey).toBe("workModeAlignment.aligned");
    });

    it("returns misaligned when sector does not include dipendente", () => {
      const r = getWorkModeAlignment("dipendente", ["autonomo"]);
      expect(r.type).toBe("misaligned");
      expect(r.tooltipKey).toBe("workModeAlignment.misaligned");
      expect(r.tooltipModes).toEqual(["autonomo"]);
    });
  });

  describe("autonomo user", () => {
    it("returns aligned when sector includes autonomo", () => {
      const r = getWorkModeAlignment("autonomo", ["autonomo"]);
      expect(r.type).toBe("aligned");
    });

    it("returns misaligned when sector includes only dipendente", () => {
      const r = getWorkModeAlignment("autonomo", ["dipendente"]);
      expect(r.type).toBe("misaligned");
      expect(r.tooltipModes).toEqual(["dipendente"]);
    });

    it("passes all sector modes in tooltipModes when misaligned", () => {
      const r = getWorkModeAlignment("autonomo", ["dipendente", "ibrido"]);
      expect(r.type).toBe("misaligned");
      expect(r.tooltipModes).toEqual(["dipendente", "ibrido"]);
    });
  });
});
