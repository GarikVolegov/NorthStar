import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserBackgroundLayer } from "./UserBackgroundLayer";

const authMock = vi.hoisted(() => vi.fn());
const backgroundMock = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: authMock,
}));

vi.mock("@/hooks/useUserBackground", () => ({
  useUserBackground: backgroundMock,
}));

describe("UserBackgroundLayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.removeAttribute("data-user-background");
    document.documentElement.style.cssText = "";
    backgroundMock.mockReturnValue({ activeBackground: null });
  });

  it("does not render for anonymous users", () => {
    authMock.mockReturnValue({ user: null });

    render(<UserBackgroundLayer />);

    expect(screen.queryByTestId("user-background-layer")).not.toBeInTheDocument();
    expect(backgroundMock).toHaveBeenCalledWith(null);
  });

  it("renders a preset background for authenticated users", () => {
    authMock.mockReturnValue({ user: { id: 7 } });
    backgroundMock.mockReturnValue({
      activeBackground: {
        kind: "preset",
        preset: { id: "preset:aurora", overlayClassName: "bg-info-surface" },
      },
      appearance: {
        mode: "manual",
        glassOpacity: 0.6,
        blur: 20,
        overlay: 0.3,
        saturation: 1.1,
        desktopPosition: "center",
        mobilePosition: "center",
      },
    });

    render(<UserBackgroundLayer />);

    expect(screen.getByTestId("user-background-layer")).toHaveClass("bg-info-surface");
    expect(document.documentElement).toHaveAttribute("data-user-background", "active");
    expect(document.documentElement.style.getPropertyValue("--app-glass-alpha")).toBe("0.6");
  });

  it("renders user image background when active", () => {
    authMock.mockReturnValue({ user: { id: 7 } });
    backgroundMock.mockReturnValue({
      activeBackground: {
        kind: "user",
        entry: {
          id: "abc",
          dataUrl: "data:image/png;base64,desktop",
          dataUrlMobile: "data:image/png;base64,mobile",
        },
      },
      appearance: {
        mode: "auto",
        glassOpacity: 0.72,
        blur: 18,
        overlay: 0.32,
        saturation: 1.08,
        desktopPosition: "center",
        mobilePosition: "center",
      },
    });

    render(<UserBackgroundLayer />);

    expect(screen.getByTestId("user-background-layer")).toHaveStyle({
      backgroundImage: "url(data:image/png;base64,desktop)",
    });
  });
});
