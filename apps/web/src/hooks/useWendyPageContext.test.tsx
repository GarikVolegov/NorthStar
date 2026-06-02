import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useWendyPageContext } from "./useWendyPageContext";

const wendyMock = vi.hoisted(() => ({
  setPageContext: vi.fn(),
}));

vi.mock("../contexts/WendyProvider", () => ({
  useWendy: () => wendyMock,
}));

function InlinePageContext({ tick }: { tick: number }) {
  useWendyPageContext({
    page: "settori",
    title: "Settori",
    capabilities: ["navigate", "set_filters"],
    fields: ["search", "riasecTypes"],
    actions: ["Filtra settori", "Apri settore"],
    adaptiveNextAction: {
      label: "Scegli settore e ruolo",
      href: "/settori",
    },
  });

  return <div data-testid="tick">{tick}</div>;
}

describe("useWendyPageContext", () => {
  it("does not reset Wendy context when rerendered with equivalent inline arrays", () => {
    const { rerender, unmount } = render(<InlinePageContext tick={1} />);

    rerender(<InlinePageContext tick={2} />);

    expect(wendyMock.setPageContext).toHaveBeenCalledTimes(1);
    expect(wendyMock.setPageContext).not.toHaveBeenCalledWith({ page: "default" });

    unmount();

    expect(wendyMock.setPageContext).toHaveBeenCalledWith({ page: "default" });
  });
});
