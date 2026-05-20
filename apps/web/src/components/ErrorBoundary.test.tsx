import { render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

const captureClientException = vi.hoisted(() => vi.fn());

vi.mock("@/lib/sentry", () => ({
  captureClientException,
}));

function BrokenChild(): React.ReactNode {
  throw new Error("render failed");
}

describe("ErrorBoundary", () => {
  it("renders fallback UI and captures the error", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <BrokenChild />
      </ErrorBoundary>,
    );

    expect(screen.getByText(/Qualcosa/)).toBeInTheDocument();
    expect(captureClientException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ boundary: "ErrorBoundary" }),
    );
  });
});
