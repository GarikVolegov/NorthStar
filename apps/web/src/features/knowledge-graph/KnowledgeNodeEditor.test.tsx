import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { KnowledgeNodeEditor } from "./KnowledgeNodeEditor";
import type { KNode } from "./knowledgeGraphTypes";

const node: KNode = {
  id: 1,
  userId: 1,
  type: "note",
  title: "Originale",
  content: "Contenuto",
  color: null,
  url: null,
  sectorId: null,
  x: 0,
  y: 0,
  createdAt: "2026-05-29T00:00:00.000Z",
  updatedAt: "2026-05-29T00:00:00.000Z",
};

describe("KnowledgeNodeEditor", () => {
  it("keeps failed saves visible and does not show a saved state", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("Permesso negato"));

    render(
      <KnowledgeNodeEditor
        node={node}
        edges={[]}
        allNodes={[node]}
        onClose={vi.fn()}
        onSave={onSave}
        onDelete={vi.fn()}
        onStartLink={vi.fn()}
        onDeleteEdge={vi.fn()}
        onSaveRef={{ current: null }}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Titolo/i), {
      target: { value: "Titolo aggiornato" },
    });
    const saveButton = screen.getByRole("button", { name: /Salva/i });
    await waitFor(() => expect(saveButton).not.toBeDisabled());
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/Permesso negato/i)).toBeInTheDocument();
    });

    expect(screen.queryByText("Salvato")).not.toBeInTheDocument();
    expect(saveButton).not.toBeDisabled();
  }, 15000);
});
