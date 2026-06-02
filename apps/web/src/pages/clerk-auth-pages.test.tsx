import { render } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signInMock = vi.hoisted(() => vi.fn());
const signUpMock = vi.hoisted(() => vi.fn());
const useDynamicTranslationMock = vi.hoisted(() => vi.fn());

vi.mock("@clerk/react", () => ({
  SignIn: (props: Record<string, unknown>) => {
    signInMock(props);
    return <div data-testid="sign-in" />;
  },
  SignUp: (props: Record<string, unknown>) => {
    signUpMock(props);
    return <div data-testid="sign-up" />;
  },
}));

vi.mock("@/components/brand/AppLogo", () => ({
  AppLogo: ({ decorative, className }: { decorative?: boolean; className?: string }) => (
    <span aria-hidden={decorative ? "true" : undefined} className={className}>
      NorthStar
    </span>
  ),
}));

vi.mock("@/lib/dynamic-translation", () => ({
  useDynamicTranslation: useDynamicTranslationMock,
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import SignInPage from "./sign-in";
import SignUpPage from "./sign-up";

describe("Clerk auth pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDynamicTranslationMock.mockImplementation(
      ({ key, source }: { key?: string; source: string }) => key ? `dynamic:${key}` : source,
    );
  });

  it("sends signed-in users to the dashboard after sign-in", () => {
    render(<SignInPage />);

    expect(signInMock).toHaveBeenCalledWith(
      expect.objectContaining({
        fallbackRedirectUrl: "/dashboard",
        forceRedirectUrl: "/dashboard",
      }),
    );
  });

  it("uses dynamic translations for sign-in page copy", () => {
    const { getByText } = render(<SignInPage />);

    expect(getByText("dynamic:auth.brandTagline")).toBeInTheDocument();
    expect(getByText("dynamic:auth.signIn.subtitle")).toBeInTheDocument();
    expect(getByText("dynamic:auth.signIn.noAccount")).toBeInTheDocument();
    expect(getByText("dynamic:auth.signIn.startFree")).toBeInTheDocument();
    expect(useDynamicTranslationMock).toHaveBeenCalledWith(expect.objectContaining({
      key: "auth.signIn.subtitle",
      source: "Accedi per continuare il tuo percorso di crescita",
    }));
  });

  it("sends new users to the dashboard after sign-up", () => {
    render(<SignUpPage />);

    expect(signUpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        fallbackRedirectUrl: "/dashboard",
        forceRedirectUrl: "/dashboard",
      }),
    );
  });

  it("uses dynamic translations for sign-up page copy", () => {
    const { getByText } = render(<SignUpPage />);

    expect(getByText("dynamic:auth.brandTagline")).toBeInTheDocument();
    expect(getByText("dynamic:auth.signUp.subtitle")).toBeInTheDocument();
    expect(getByText("dynamic:auth.signUp.hasAccount")).toBeInTheDocument();
    expect(getByText("dynamic:auth.signUp.signIn")).toBeInTheDocument();
    expect(useDynamicTranslationMock).toHaveBeenCalledWith(expect.objectContaining({
      key: "auth.signUp.subtitle",
      source: "Gratis - inizia il tuo percorso oggi",
    }));
  });
});
