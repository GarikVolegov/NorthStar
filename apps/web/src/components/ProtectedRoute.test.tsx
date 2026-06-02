import { render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const clerkState = vi.hoisted(() => ({
  isLoaded: true,
  isSignedIn: false,
}));

const authState = vi.hoisted(() => ({
  authReady: true,
  authSyncError: null as string | null,
  authSyncFailed: false,
  isLoggedIn: false,
  logout: vi.fn(),
  user: null as null | { onboardingCompleted?: boolean },
}));

const redirectMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/PageLoader", () => ({
  PageLoader: () => <div data-testid="page-loader" />,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("@clerk/react", () => ({
  useClerk: () => ({ signOut: vi.fn() }),
  useUser: () => clerkState,
}));

vi.mock("wouter", () => ({
  Redirect: ({ to }: { to: string }) => {
    redirectMock(to);
    return <div data-testid="redirect" data-to={to} />;
  },
}));

import { ProtectedRoute, PublicOnlyRoute } from "./ProtectedRoute";

function PublicPage() {
  return <div>Public auth page</div>;
}

function ProtectedPage() {
  return <div>Protected page</div>;
}

describe("PublicOnlyRoute", () => {
  beforeEach(() => {
    redirectMock.mockClear();
    authState.authReady = true;
    authState.authSyncError = null;
    authState.authSyncFailed = false;
    authState.isLoggedIn = false;
    authState.logout.mockClear();
    authState.user = null;
    clerkState.isLoaded = true;
    clerkState.isSignedIn = false;
  });

  it("waits for NorthStar auth sync before redirecting a Clerk signed-in user", () => {
    clerkState.isSignedIn = true;
    authState.authReady = false;

    render(<PublicOnlyRoute component={PublicPage} />);

    expect(screen.getByTestId("page-loader")).toBeInTheDocument();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects incomplete signed-in users to the onboarding gate instead of dashboard", () => {
    clerkState.isSignedIn = true;
    authState.isLoggedIn = true;
    authState.user = { onboardingCompleted: false };

    render(<PublicOnlyRoute component={PublicPage} />);

    expect(redirectMock).toHaveBeenCalledWith("/");
  });
});

describe("ProtectedRoute", () => {
  beforeEach(() => {
    redirectMock.mockClear();
    authState.authReady = true;
    authState.authSyncError = null;
    authState.authSyncFailed = false;
    authState.isLoggedIn = false;
    authState.logout.mockClear();
    authState.user = null;
    clerkState.isLoaded = true;
    clerkState.isSignedIn = false;
  });

  it("redirects incomplete logged-in users away from protected routes to the onboarding gate", () => {
    clerkState.isSignedIn = true;
    authState.isLoggedIn = true;
    authState.user = { onboardingCompleted: false };

    render(<ProtectedRoute component={ProtectedPage} />);

    expect(redirectMock).toHaveBeenCalledWith("/");
    expect(screen.queryByText("Protected page")).not.toBeInTheDocument();
  });
});
