import { describe, it, expect } from "vitest";
import { springs, durations, easings, fadeIn, fadeInUp, fadeInDown, staggerContainer } from "@/lib/motion";

describe("motion constants", () => {
  describe("springs", () => {
    it("all spring configs have type 'spring'", () => {
      for (const key of Object.keys(springs) as Array<keyof typeof springs>) {
        expect(springs[key].type).toBe("spring");
      }
    });

    it("gentle spring has correct stiffness", () => {
      expect(springs.gentle.stiffness).toBe(200);
      expect(springs.gentle.damping).toBe(30);
    });

    it("snappy spring is stiffer than gentle", () => {
      expect(springs.snappy.stiffness).toBeGreaterThan(springs.gentle.stiffness);
    });
  });

  describe("durations", () => {
    it("fast < normal < slow < verySlow", () => {
      expect(durations.fast).toBeLessThan(durations.normal);
      expect(durations.normal).toBeLessThan(durations.slow);
      expect(durations.slow).toBeLessThan(durations.verySlow);
    });

    it("all durations are positive numbers", () => {
      for (const val of Object.values(durations)) {
        expect(val).toBeGreaterThan(0);
      }
    });
  });

  describe("easings", () => {
    it("each easing is an array of 4 numbers in [0,1]", () => {
      for (const curve of Object.values(easings)) {
        expect(Array.isArray(curve)).toBe(true);
        expect((curve as number[]).length).toBe(4);
        for (const n of curve as number[]) {
          expect(typeof n).toBe("number");
          expect(n).toBeGreaterThanOrEqual(0);
          expect(n).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  describe("variants", () => {
    it("fadeIn has hidden, visible, and exit states", () => {
      expect(fadeIn).toHaveProperty("hidden");
      expect(fadeIn).toHaveProperty("visible");
      expect(fadeIn).toHaveProperty("exit");
    });

    it("fadeIn hidden state has opacity 0", () => {
      expect((fadeIn.hidden as { opacity: number }).opacity).toBe(0);
    });

    it("fadeIn visible state has opacity 1", () => {
      expect((fadeIn.visible as { opacity: number }).opacity).toBe(1);
    });

    it("fadeInUp hidden state has positive y offset", () => {
      expect((fadeInUp.hidden as { y: number }).y).toBeGreaterThan(0);
    });

    it("fadeInDown hidden state has negative y offset", () => {
      expect((fadeInDown.hidden as { y: number }).y).toBeLessThan(0);
    });

    it("staggerContainer hidden state is empty object", () => {
      expect(staggerContainer.hidden).toEqual({});
    });
  });
});
