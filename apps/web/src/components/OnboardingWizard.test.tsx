import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { describe, expect, it, vi } from "vitest";

const getJsonMock = vi.hoisted(() => vi.fn());
const postJsonMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/apiClient", () => ({
  ApiClientError: class ApiClientError extends Error {},
  getJson: getJsonMock,
  postJson: postJsonMock,
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
  useReducedMotion: () => true,
  motion: {
    create:
      (Component: React.ComponentType<React.PropsWithChildren>) =>
      ({ children, ...props }: React.PropsWithChildren) => (
        <Component {...props}>{children}</Component>
      ),
    div: ({ children, ...props }: React.PropsWithChildren) => (
      <div {...props}>{children}</div>
    ),
  },
}));

vi.mock("wouter", () => ({
  Link: ({ children, href }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href}>{children}</a>
  ),
}));

import { OnboardingWizard } from "./OnboardingWizard";

function renderWizard(onComplete = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <OnboardingWizard
        userId={7}
        userName="Ada"
        onClose={vi.fn()}
        onComplete={onComplete}
      />
    </QueryClientProvider>,
  );
}

describe("OnboardingWizard", () => {
  it("keeps the user in onboarding when completion cannot be persisted", async () => {
    const onComplete = vi.fn();
    getJsonMock.mockResolvedValue({ sectors: [] });
    postJsonMock.mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();

    renderWizard(onComplete);

    await user.click(screen.getByRole("button", { name: /continua/i }));
    await user.click(screen.getByRole("button", { name: /continua/i }));
    await user.click(screen.getByRole("button", { name: /configura northstar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Non sono riuscito a salvare",
    );
    expect(screen.queryByText(/northstar è tuo/i)).not.toBeInTheDocument();
    await waitFor(() => expect(onComplete).not.toHaveBeenCalled());
  });
});
