import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Percorso from "./percorso";

const authState = vi.hoisted(() => ({
  user: { id: 7, name: "Ada", email: "ada@example.com", journeyType: null },
  token: "token-7",
  login: vi.fn(),
}));

const routerState = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

const wendyState = vi.hoisted(() => ({
  open: vi.fn(),
}));

const apiFetchMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: authState.user,
    token: authState.token,
    login: authState.login,
  }),
}));

vi.mock("@/contexts/WendyProvider", () => ({
  useWendy: () => ({ open: wendyState.open }),
}));

vi.mock("@/lib/api-fetch", () => ({
  apiFetch: apiFetchMock,
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: toastMock,
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/percorso", routerState.navigate],
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
      const { initial, animate, transition, ...rest } = props;
      return <div {...rest}>{children}</div>;
    },
    button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
      const { initial, animate, transition, ...rest } = props;
      return <button {...rest}>{children}</button>;
    },
  },
}));

describe("Percorso save reliability", () => {
  beforeEach(() => {
    authState.user = { id: 7, name: "Ada", email: "ada@example.com", journeyType: null };
    authState.token = "token-7";
    authState.login.mockReset();
    routerState.navigate.mockReset();
    wendyState.open.mockReset();
    apiFetchMock.mockReset();
    toastMock.mockReset();
  });

  it("does not navigate or update auth when the journey save returns an error", async () => {
    apiFetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({ error: "Database non disponibile" }),
    });

    render(<Percorso />);

    await userEvent.click(screen.getByRole("button", { name: /dipendente che vuole crescere/i }));
    await userEvent.click(screen.getByRole("button", { name: /inizia il tuo percorso/i }));

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/journey-type/me/journey-type",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ journeyType: "dipendente" }),
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Database non disponibile");
    expect(authState.login).not.toHaveBeenCalled();
    expect(routerState.navigate).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Salvataggio non riuscito", variant: "destructive" }),
    );
  });

  it("navigates only after the authenticated journey save succeeds", async () => {
    apiFetchMock.mockResolvedValue({ ok: true, status: 200, json: vi.fn() });

    render(<Percorso />);

    await userEvent.click(screen.getByRole("button", { name: /dipendente che vuole crescere/i }));
    await userEvent.click(screen.getByRole("button", { name: /inizia il tuo percorso/i }));

    expect(authState.login).toHaveBeenCalledWith(
      expect.objectContaining({ journeyType: "dipendente" }),
      "token-7",
    );
    expect(routerState.navigate).toHaveBeenCalledWith("/dashboard");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clears a previous save error when the user picks another journey", async () => {
    apiFetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue({}),
    });

    render(<Percorso />);

    await userEvent.click(screen.getByRole("button", { name: /dipendente che vuole crescere/i }));
    await userEvent.click(screen.getByRole("button", { name: /inizia il tuo percorso/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Scelta non valida");

    await userEvent.click(screen.getByRole("button", { name: /^investitore/i }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
