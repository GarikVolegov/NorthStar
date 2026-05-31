import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const redirectTargets = vi.hoisted(() => [] as string[]);

vi.mock("wouter", () => ({
  Redirect: ({ to }: { to: string }) => {
    redirectTargets.push(to);
    return null;
  },
}));

import Abbonamento from "./abbonamento";
import Login from "./login";
import Register from "./register";

describe("Italian CTA redirect aliases", () => {
  it("sends /accedi to Clerk sign-in preserving query params", () => {
    redirectTargets.length = 0;
    window.history.replaceState({}, "", "/accedi?next=/dashboard");

    render(<Login />);

    expect(redirectTargets).toEqual(["/sign-in?next=/dashboard"]);
  });

  it("sends /registrati to Clerk sign-up preserving query params", () => {
    redirectTargets.length = 0;
    window.history.replaceState({}, "", "/registrati?plan=premium");

    render(<Register />);

    expect(redirectTargets).toEqual(["/sign-up?plan=premium"]);
  });

  it("sends /abbonamento to the existing premium page preserving query params", () => {
    redirectTargets.length = 0;
    window.history.replaceState({}, "", "/abbonamento?from=hero");

    render(<Abbonamento />);

    expect(redirectTargets).toEqual(["/premium?from=hero"]);
  });
});
