import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { HomeNewsCard } from "./HomeNewsCard";
import type { HomeNewsItem } from "./homeTypes";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      String(options?.defaultValue ?? key),
  }),
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const item: HomeNewsItem = {
  category: "technology",
  description: "Una notizia utile",
  detailUrl: "/news/1",
  id: "1",
  image: "https://cdn.example.com/broken.jpg",
  publishedAt: new Date().toISOString(),
  source: "GNews",
  tags: ["technology"],
  title: "Titolo",
  url: "https://example.com/news",
};

describe("HomeNewsCard", () => {
  it("shows a visible fallback when the article image fails", () => {
    render(<HomeNewsCard item={item} />);

    fireEvent.error(screen.getByRole("img", { name: "Titolo" }));

    expect(screen.getByTestId("home-news-image-fallback")).toBeInTheDocument();
  });

  it("shows an accessible fallback image when the article has no image", () => {
    render(<HomeNewsCard item={{ ...item, image: null }} />);

    expect(screen.getByRole("img", { name: /titolo/i })).toBeInTheDocument();
  });
});
