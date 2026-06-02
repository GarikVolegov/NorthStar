import { render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import AdminHome from "./admin-home";

vi.mock("@/components/AdminAuthGate", () => ({
  AdminAuthGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/hooks/useAdminAuth", () => ({
  useAdminAuth: () => ({
    logout: vi.fn(),
  }),
}));

vi.mock("@/hooks/usePageModule", () => ({
  usePageModule: vi.fn(),
}));

describe("AdminHome", () => {
  it("links the quick calendar shortcut to the canonical Italian calendar route", () => {
    render(<AdminHome />);

    expect(screen.getByRole("link", { name: "Calendario" })).toHaveAttribute("href", "/calendario");
  });
});
