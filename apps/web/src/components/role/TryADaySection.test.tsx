import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TryADaySection } from "./TryADaySection";

const postJson = vi.hoisted(() => vi.fn());
const getJson = vi.hoisted(() => vi.fn());
let authUser: { id: number; journeyType?: string | null } | null = null;

vi.mock("@/lib/apiClient", () => ({
  getJson,
  postJson,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: authUser,
    isLoggedIn: !!authUser,
    authReady: true,
  }),
}));

const role = {
  id: 7,
  title: "Data Analyst",
  sector: "Tecnologia",
  description: "Analizza dati e decisioni.",
  skills: ["SQL", "Storytelling", "Dashboard"],
  riasecFit: ["I", "C"],
  workModes: ["ibrido"],
};

describe("TryADaySection", () => {
  beforeEach(() => {
    authUser = null;
    getJson.mockReset();
    postJson.mockReset();
    getJson.mockResolvedValue({ completed: false });
  });

  it("renders a journey-specific inline CTA", () => {
    authUser = { id: 1, journeyType: "dipendente" };
    render(<TryADaySection role={role} journeyType="dipendente" />);

    expect(screen.getByText(/giornata da Data Analyst/i)).toBeInTheDocument();
    expect(screen.getByText(/valuta la transizione/i)).toBeInTheDocument();
  });

  it("generates scenes and unlocks them in sequence for logged users", async () => {
    authUser = { id: 1, journeyType: "indeciso" };
    getJson.mockResolvedValueOnce({ completed: false });
    postJson.mockResolvedValueOnce({
      simulationId: 11,
      professionId: 7,
      roleTitle: "Data Analyst",
      sector: "Tecnologia",
      completedAt: null,
      scenes: scenes(),
    });

    render(<TryADaySection role={role} journeyType="indeciso" />);
    fireEvent.click(screen.getByRole("button", { name: /provala/i }));

    expect(await screen.findByText("Mattina da Data Analyst")).toBeInTheDocument();
    expect(screen.queryByText("Pomeriggio operativo")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /analizzo/i }));
    fireEvent.change(screen.getByLabelText(/energia emotiva/i), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /continua al pomeriggio/i }));

    expect(await screen.findByText("Pomeriggio operativo")).toBeInTheDocument();
  });

  it("shows preview and login gate for anonymous users", async () => {
    authUser = null;
    render(<TryADaySection role={role} journeyType="indeciso" />);

    fireEvent.click(screen.getByRole("button", { name: /provala/i }));

    expect(await screen.findByText("Mattina da Data Analyst")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /analizzo/i }));
    fireEvent.click(screen.getByRole("button", { name: /continua/i }));

    expect(screen.getByText(/accedi per completare/i)).toBeInTheDocument();
    expect(postJson).not.toHaveBeenCalled();
  });

  it("completes and renders a deterministic debrief", async () => {
    authUser = { id: 1, journeyType: "indeciso" };
    getJson.mockResolvedValueOnce({ completed: false });
    postJson.mockResolvedValueOnce({
      simulationId: 12,
      professionId: 7,
      roleTitle: "Data Analyst",
      sector: "Tecnologia",
      completedAt: null,
      scenes: scenes(),
    });
    postJson.mockResolvedValueOnce({
      simulationId: 12,
      completedAt: "2026-05-28T10:00:00.000Z",
      debrief: {
        radar: { energy: 80, interest: 76, perceivedCompetence: 72, valuesAlignment: 70 },
        summary: "Buon fit.",
        highlights: ["Energia sostenuta."],
      },
    });

    render(<TryADaySection role={role} journeyType="indeciso" />);
    fireEvent.click(screen.getByRole("button", { name: /provala/i }));
    await screen.findByText("Mattina da Data Analyst");

    fireEvent.click(screen.getByRole("button", { name: /analizzo/i }));
    fireEvent.click(screen.getByRole("button", { name: /continua al pomeriggio/i }));
    fireEvent.click(await screen.findByRole("button", { name: /bisogno dell'utente/i }));
    fireEvent.click(screen.getByRole("button", { name: /continua alla sera/i }));
    fireEvent.change(await screen.findByLabelText(/comfort/i), { target: { value: "80" } });
    fireEvent.click(screen.getByRole("button", { name: /vedi debrief/i }));

    await waitFor(() => expect(screen.getByText(/Debrief della giornata/i)).toBeInTheDocument());
    expect(screen.getByText("80")).toBeInTheDocument();
  });
});

function scenes() {
  return [
    {
      timeBlock: "morning",
      title: "Mattina da Data Analyst",
      narrative: "Analizzi una richiesta ambigua e scegli da dove partire.",
      taskImportance: "Conta per capire il fit.",
      interaction: {
        type: "choice",
        prompt: "Quale prima mossa scegli?",
        options: [
          { id: "investigate", label: "Analizzo i dati", signal: "analisi", value: 92 },
          { id: "align", label: "Parlo con il team", signal: "team", value: 75 },
        ],
      },
      emotionalPrompt: "Energia?",
      signals: { skills: ["SQL"], values: ["chiarezza"], energy: 70, interest: 80, competence: 70 },
    },
    {
      timeBlock: "afternoon",
      title: "Pomeriggio operativo",
      narrative: "Ordini le priorita.",
      taskImportance: "Misura la tua lucidita.",
      interaction: {
        type: "priority_order",
        prompt: "Ordina le priorita.",
        options: [
          { id: "customer", label: "Bisogno dell'utente", signal: "valori", value: 88 },
          { id: "quality", label: "Qualita", signal: "competenza", value: 82 },
        ],
      },
      emotionalPrompt: "Come va?",
      signals: { skills: ["Storytelling"], values: ["qualita"], energy: 60, interest: 70, competence: 70 },
    },
    {
      timeBlock: "evening",
      title: "Chiusura e riflessione",
      narrative: "Valuti se ripeteresti la giornata.",
      taskImportance: "Misura sostenibilita.",
      interaction: {
        type: "comfort_slider",
        prompt: "Quanto comfort?",
        minLabel: "Basso",
        maxLabel: "Alto",
      },
      emotionalPrompt: "Temperatura emotiva?",
      signals: { skills: ["Dashboard"], values: ["crescita"], energy: 60, interest: 70, competence: 70 },
    },
  ];
}
