import { render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_NEWS_TICKER_ITEMS } from "./navbarConfig";

vi.mock("@/components/brand/AppLogo", () => ({
  AppLogo: ({ decorative, className }: { decorative?: boolean; className?: string }) => (
    <span aria-hidden={decorative ? "true" : undefined} className={className}>
      compass
    </span>
  ),
}));

vi.mock("@/components/search/SearchDialog", () => ({
  SearchDialog: () => null,
}));

vi.mock("@/components/layout/NavbarProfileMenus", () => ({
  NavbarDesktopProfileMenu: () => null,
  NavbarMobileProfileMenu: () => null,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: React.PropsWithChildren) => <>{children}</>,
  DropdownMenuContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, isLoggedIn: false }),
}));

vi.mock("@/contexts/WendyProvider", () => ({
  useWendy: () => ({ phase: "idle", isOpen: false }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/hooks/useAffiliateInvitePreview", () => ({
  useAffiliateInvitePreview: () => ({ referralLink: "" }),
}));

vi.mock("@/hooks/useGlobalSearch", () => ({
  useGlobalSearch: () => ({
    query: "",
    setQuery: vi.fn(),
    results: [],
    suggestions: [],
    route: null,
    hasSemantic: false,
    searchMode: "keyword",
    indexStatus: "ready",
    isLoading: false,
    isOpen: false,
    setIsOpen: vi.fn(),
    close: vi.fn(),
    trackClick: vi.fn(),
  }),
}));

vi.mock("@/hooks/useProactiveInsights", () => ({
  useProactiveInsights: () => ({ unreadCount: 0 }),
}));

vi.mock("@/lib/api-fetch", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/lib/apiClient", () => ({
  getJson: vi.fn().mockResolvedValue({ news: [] }),
}));

vi.mock("@/lib/motion", () => ({
  useReducedMotion: () => false,
}));

vi.mock("@clerk/react", () => ({
  useClerk: () => ({ signOut: vi.fn() }),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark", setTheme: vi.fn() }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: "it", language: "it", changeLanguage: vi.fn() },
  }),
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useLocation: () => ["/", vi.fn()],
}));

vi.mock("framer-motion", () => {
  const M = new Proxy(
    {},
    {
      get:
        (_target, tag: string) =>
        ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
          const cleanProps = { ...props };
          delete cleanProps.animate;
          delete cleanProps.initial;
          delete cleanProps.transition;
          delete cleanProps.whileHover;
          delete cleanProps.whileTap;
          delete cleanProps.exit;
          return React.createElement(tag, cleanProps, children);
        },
    },
  );

  return {
    LazyMotion: ({ children }: React.PropsWithChildren) => <>{children}</>,
    domAnimation: {},
    m: M,
  };
});

import { Navbar } from "./Navbar";

describe("Navbar", () => {
  it("shows a slow rotating compass in Wendy search and a configurable news ticker fallback", async () => {
    render(<Navbar />);

    expect(screen.getByTestId("nav-search-compass")).toHaveAttribute(
      "data-motion",
      "slow-rotate",
    );
    expect(
      screen.getAllByText(DEFAULT_NEWS_TICKER_ITEMS[0] ?? "")[0],
    ).toBeInTheDocument();
  });
});
