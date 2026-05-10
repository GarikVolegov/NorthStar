/**
 * cv-extractor.ts — estrazione strutturata dal CV in testo libero.
 *
 * Chiamato in background dopo PATCH /api/users/me quando cvText è presente.
 * Non blocca la risposta HTTP.
 *
 * Output salvato in users.cv_json:
 * {
 *   skills:     string[]        // es. ['React', 'Node.js', 'SQL']
 *   experience: Array<{         // esperienze lavorative
 *     title: string;
 *     company: string;
 *     years: number | null;
 *   }>
 *   education: Array<{          // formazione
 *     degree: string;
 *     institution: string;
 *   }>
 *   languages: string[]         // es. ['Italiano', 'Inglese B2']
 *   summary:   string           // 1-2 frasi di sintesi generate dall’AI
 * }
 *
 * Modello: gpt-4o-mini (veloce, economico, sufficiente per estrazione)
 */
import { openai } from "../client"; // riusa il client OpenAI esistente

export interface CvJson {
  skills:     string[];
  experience: Array<{ title: string; company: string; years: number | null }>;
  education:  Array<{ degree: string; institution: string }>;
  languages:  string[];
  summary:    string;
}

const SYSTEM = `Sei un estrattore di dati strutturati da CV.
Ricevi un testo libero (CV, bio, descrizione professionale) e devi restituire
UNICAMENTE un oggetto JSON con questa struttura esatta (no markdown, no testo extra):
{
  "skills":     ["skill1", "skill2"],
  "experience": [{"title": "...", "company": "...", "years": null_o_numero}],
  "education":  [{"degree": "...", "institution": "..."}],
  "languages":  ["Italiano", "Inglese B2"],
  "summary":    "1-2 frasi di sintesi in italiano"
}
Se un campo non è rilevabile, usa array vuoto o stringa vuota. Non inventare.`;

export async function extractCvJson(cvText: string): Promise<CvJson> {
  const response = await openai.chat.completions.create({
    model:       "gpt-4o-mini",
    temperature: 0,
    max_tokens:  800,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user",   content: cvText.slice(0, 8000) }, // cap a 8k chars
    ],
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(raw) as CvJson;
  } catch {
    return { skills: [], experience: [], education: [], languages: [], summary: "" };
  }
}
