import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DiscoveryMeta } from "./DiscoveryMeta";

describe("DiscoveryMeta", () => {
  it("renders source, personalization, and reason labels compactly", () => {
    render(
      <DiscoveryMeta
        sourceLabel="Biblioteca crescita"
        personalization="profile"
        reasonLabels={["Profilo: Investigativo", "Tema: focus"]}
      />,
    );

    expect(screen.getByText("Biblioteca crescita")).toBeInTheDocument();
    expect(screen.getByText("Personalizzato")).toBeInTheDocument();
    expect(screen.getByText("Profilo: Investigativo")).toBeInTheDocument();
    expect(screen.getByText("Tema: focus")).toBeInTheDocument();
  });

  it("labels fallback/generic content as general", () => {
    render(
      <DiscoveryMeta
        sourceLabel="Percorso generale NorthStar"
        personalization="generic"
        reasonLabels={["Contenuto generale"]}
      />,
    );

    expect(screen.getByText("Percorso generale NorthStar")).toBeInTheDocument();
    expect(screen.getByText("Generale")).toBeInTheDocument();
    expect(screen.getByText("Contenuto generale")).toBeInTheDocument();
  });

  it("limits visible reasons to 3", () => {
    render(
      <DiscoveryMeta
        reasonLabels={["Uno", "Due", "Tre", "Quattro"]}
      />,
    );

    expect(screen.getByText("Uno")).toBeInTheDocument();
    expect(screen.getByText("Due")).toBeInTheDocument();
    expect(screen.getByText("Tre")).toBeInTheDocument();
    expect(screen.queryByText("Quattro")).not.toBeInTheDocument();
  });
});
