import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WendyPromptSuggestions } from "./WendyPromptSuggestions";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "en-US", resolvedLanguage: "en-US" },
  }),
}));

vi.mock("@/lib/dynamic-translation", () => ({
  useDynamicTranslation: ({ key, source }: { key?: string; source: string }) =>
    key ? `dynamic:${key}` : source,
}));

vi.mock("@/hooks/useProactiveInsights", () => ({
  useProactiveInsights: () => ({ insights: [] }),
}));

describe("WendyPromptSuggestions", () => {
  it("renders its chrome through dynamic translation", () => {
    render(
      <WendyPromptSuggestions
        fallbackPrompts={[{ label: "Cosa dovrei fare oggi?" }]}
        onPromptSelect={() => undefined}
      />,
    );

    expect(screen.getByRole("region", { name: "dynamic:wendy.promptSuggestions.ariaLabel" })).toBeInTheDocument();
    expect(screen.getByText("dynamic:wendy.promptSuggestions.heading")).toBeInTheDocument();
    expect(screen.queryByText("Wendy ti suggerisce")).not.toBeInTheDocument();
  });
});
