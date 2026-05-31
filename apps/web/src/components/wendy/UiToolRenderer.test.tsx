import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UiToolRenderer } from "./UiToolRenderer";

describe("UiToolRenderer", () => {
  it("renders roadmap args emitted by the server UI tool schema", () => {
    render(
      <UiToolRenderer
        name="render_roadmap"
        args={{
          title: "Piano UX",
          steps: [
            { label: "Studia basi", description: "Ripassa ricerca utente", durationWeeks: 2 },
          ],
        }}
      />,
    );

    expect(screen.getByText("Piano UX")).toBeInTheDocument();
    expect(screen.getByText("Studia basi")).toBeInTheDocument();
    expect(screen.getByText("2 settimane")).toBeInTheDocument();
  });

  it("renders single career match args emitted by the server UI tool schema", () => {
    render(
      <UiToolRenderer
        name="render_career_match"
        args={{
          careerName: "Product Designer",
          matchScore: 82,
          riasecTypes: ["A", "S"],
          pros: ["Creativita", "Ricerca"],
          cons: [],
          nextStep: "Apri la scheda ruolo",
        }}
      />,
    );

    expect(screen.getByText("Product Designer")).toBeInTheDocument();
    expect(screen.getByText("82%")).toBeInTheDocument();
    expect(screen.getByText("Apri la scheda ruolo")).toBeInTheDocument();
  });

  it("renders server resource list args without requiring legacy items", () => {
    render(
      <UiToolRenderer
        name="render_resource_list"
        args={{
          heading: "Risorse consigliate",
          resources: [
            {
              title: "Guida al portfolio",
              url: "/crescita/articolo/portfolio",
              description: "Come costruire una prova concreta.",
              type: "article",
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("Risorse consigliate")).toBeInTheDocument();
    expect(screen.getByText("Guida al portfolio")).toBeInTheDocument();
    expect(screen.getByText("Come costruire una prova concreta.")).toBeInTheDocument();
  });
});
