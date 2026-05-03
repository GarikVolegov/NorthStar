import type { Agent, AgentInput, AgentOutput } from "./types";
import { EducationInputSchema, EducationOutputSchema } from "./types";
import { db, educationPathsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

interface EducationPath {
  path: string;
  type: "universitario" | "professionale" | "online" | "bootcamp";
  duration: string;
  cost: string;
  steps: string[];
  careerOutcomes: string[];
  sectorFit: string[];
}

const EDUCATION_FALLBACK: EducationPath[] = [
  {
    path: "Laurea in Informatica / Ingegneria Informatica",
    type: "universitario", duration: "3–5 anni", cost: "€1.000 – €3.000/anno",
    steps: ["Basi di programmazione", "Algoritmi e strutture dati", "Reti e sistemi", "Progetto di tesi"],
    careerOutcomes: ["Sviluppatore software", "DevOps engineer", "Data engineer"],
    sectorFit: ["tecnologia", "software", "data"],
  },
  {
    path: "Bootcamp di Sviluppo Web Full-Stack",
    type: "bootcamp", duration: "3–6 mesi", cost: "€3.000 – €8.000",
    steps: ["HTML/CSS/JS", "React & Node.js", "Database", "Progetto portfolio"],
    careerOutcomes: ["Frontend developer", "Backend developer", "Freelance dev"],
    sectorFit: ["tecnologia", "digitale", "software"],
  },
  {
    path: "Laurea in Economia / Management",
    type: "universitario", duration: "3–5 anni", cost: "€1.000 – €3.000/anno",
    steps: ["Microeconomia e macro", "Marketing", "Finanza aziendale", "Stage"],
    careerOutcomes: ["Consulente", "Manager", "Imprenditore"],
    sectorFit: ["business", "finanza", "consulenza", "marketing"],
  },
  {
    path: "Laurea in Psicologia / Scienze dell'educazione",
    type: "universitario", duration: "3–5 anni", cost: "€1.000 – €2.500/anno",
    steps: ["Psicologia generale", "Metodologia della ricerca", "Stage clinico", "Tesi"],
    careerOutcomes: ["Psicologo", "HR specialist", "Formatore"],
    sectorFit: ["salute", "istruzione", "risorse umane"],
  },
  {
    path: "Corso Professionale in Design Grafico / UX",
    type: "professionale", duration: "1–2 anni", cost: "€2.000 – €6.000",
    steps: ["Principi del design", "Figma & Adobe Suite", "Portfolio", "Stage"],
    careerOutcomes: ["UX designer", "Graphic designer", "Art director"],
    sectorFit: ["design", "creatività", "marketing"],
  },
  {
    path: "Laurea in Medicina / Infermieristica",
    type: "universitario", duration: "3–6 anni", cost: "€1.000 – €2.500/anno",
    steps: ["Anatomia e fisiologia", "Clinica medica", "Tirocini ospedalieri", "Esame di stato"],
    careerOutcomes: ["Medico", "Infermiere", "Operatore sanitario"],
    sectorFit: ["salute", "healthcare", "benessere"],
  },
  {
    path: "Master / MBA in Business Administration",
    type: "universitario", duration: "1–2 anni", cost: "€5.000 – €20.000",
    steps: ["Strategia aziendale", "Leadership", "Finance", "Project finale"],
    careerOutcomes: ["Senior manager", "Imprenditore", "Consulente senior"],
    sectorFit: ["business", "consulenza", "finanza"],
  },
  {
    path: "Certificazioni Online (Coursera, edX, Google, AWS)",
    type: "online", duration: "1–6 mesi", cost: "€0 – €1.000",
    steps: ["Scelta certificazione", "Moduli online", "Progetto pratico", "Esame finale"],
    careerOutcomes: ["Specialista tecnico", "Freelance", "Transizione di carriera"],
    sectorFit: ["tecnologia", "data", "marketing", "digitale"],
  },
];

async function loadEducationPaths(): Promise<EducationPath[]> {
  try {
    const rows = await db.select().from(educationPathsTable).where(eq(educationPathsTable.isActive, true));
    if (rows.length === 0) return EDUCATION_FALLBACK;
    return rows.map((r) => ({
      path: r.path,
      type: r.type as EducationPath["type"],
      duration: r.duration,
      cost: r.cost,
      steps: r.steps ?? [],
      careerOutcomes: r.careerOutcomes ?? [],
      sectorFit: r.sectorFit ?? [],
    }));
  } catch {
    return EDUCATION_FALLBACK;
  }
}

export const educationAgent: Agent = {
  name: "EducationAgent",

  async run(input: AgentInput): Promise<AgentOutput> {
    try {
      const parsed = EducationInputSchema.safeParse(input.payload);
      if (!parsed.success) {
        return {
          agentName: this.name,
          success: false,
          data: {},
          error: `Invalid input: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
        };
      }

      const { topSectors, professions } = parsed.data;
      const isPremium = input.context.plan === "premium";
      const limit = isPremium ? 4 : 2;

      const sectorKeywords = [
        ...(topSectors ?? []).map((s) => s.sectorName.toLowerCase()),
        ...(professions ?? []).map((p) => p.sector.toLowerCase()),
      ];

      const allPaths = await loadEducationPaths();

      let matched = allPaths.filter((ep) =>
        ep.sectorFit.some((sf) =>
          sectorKeywords.some((kw) => kw.includes(sf) || sf.includes(kw.split(" ")[0]!)),
        ),
      );

      if (matched.length === 0) matched = allPaths.slice(0, limit);

      const educationPaths = matched.slice(0, limit).map((ep) => ({
        path: ep.path,
        type: ep.type,
        duration: ep.duration,
        cost: ep.cost,
        steps: ep.steps,
        careerOutcomes: isPremium ? ep.careerOutcomes : ep.careerOutcomes.slice(0, 2),
      }));

      const output = { educationPaths };

      const outputValidation = EducationOutputSchema.safeParse(output);
      if (!outputValidation.success) {
        return {
          agentName: this.name,
          success: false,
          data: output,
          error: `Output validation failed: ${outputValidation.error.issues.map((i) => i.message).join(", ")}`,
          partial: true,
        };
      }

      return {
        agentName: this.name,
        success: true,
        data: output,
      };
    } catch (err) {
      return {
        agentName: this.name,
        success: false,
        data: {},
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
