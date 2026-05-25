import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "./card";

describe("Card", () => {
  it("uses the liquid glass surface class so backgrounds can affect app cards", () => {
    render(<Card animate={false}>Widget</Card>);

    expect(screen.getByText("Widget")).toHaveClass("liquid-card");
  });
});
