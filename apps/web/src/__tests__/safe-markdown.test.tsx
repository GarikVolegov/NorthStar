import { SafeMarkdown } from "@/components/SafeMarkdown";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("SafeMarkdown", () => {
  it("does not render executable HTML from untrusted content", () => {
    const payload =
      "<img src=x onerror=fetch('/admin?cookie='+document.cookie)>";

    render(<SafeMarkdown content={`Test ${payload}`} />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(document.querySelector("[onerror]")).toBeNull();
    expect(document.body.innerHTML).toContain("&lt;img");
  });

  it("renders basic markdown formatting", () => {
    render(<SafeMarkdown content={"**Nodo**\n\n- primo\n- *secondo*"} />);

    expect(screen.getByText("Nodo").tagName).toBe("STRONG");
    expect(screen.getByText("primo").closest("li")).toBeInTheDocument();
    expect(screen.getByText("secondo").tagName).toBe("EM");
  });
});
