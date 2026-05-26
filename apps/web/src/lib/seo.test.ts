import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { usePageMeta } from "./seo";

describe("usePageMeta", () => {
  it("does not append the NorthStar suffix when the title already contains NorthStar", () => {
    renderHook(() => usePageMeta({
      title: "Fondazione NorthStar",
      description: "Test",
    }));

    expect(document.title).toBe("Fondazione NorthStar");
  });
});
