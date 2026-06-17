import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-fetch";
import { useGetSector } from "@workspace/api-client-react";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  Lightbulb,
  Loader2,
  Lock,
  MessageSquare,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";
const MAX_TURNS = 5;

type Difficulty = "base" | "media" | "avanzata";

interface Evaluation {
  score: number;
  clarity: number;
  relevance: number;
  depth: number;
  feedback: string;
  suggestions: string[];
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  phase?: string;
}

interface Turn {
  question: string;
  difficulty: Difficulty;
  focus: string;
  answer?: string;
  evaluation?: Evaluation;
}

interface FinalReport {
  totalScore: number;
  questionsAnswered: number;
  averageScore: number;
}

interface GateInfo {
  currentPlan: string;
  message: string;
}

type Phase =
  | "intro"
  | "thinking"
  | "answering"
  | "evaluating"
  | "reviewing"
  | "final"
  | "gate";

// ── SSE helpers (mirror skills-gap.tsx streaming pattern) ──────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function readStr(o: Record<string, unknown>, k: string): string {
  const v = o[k];
  return typeof v === "string" ? v : "";
}
function readNum(o: Record<string, unknown>, k: string): number {
  const v = o[k];
  return typeof v === "number" ? v : 0;
}
function readStrArray(o: Record<string, unknown>, k: string): string[] {
  const v = o[k];
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : [];
}
function readDifficulty(o: Record<string, unknown>, k: string): Difficulty {
  const v = o[k];
  return v === "base" || v === "media" || v === "avanzata" ? v : "media";
}

/** POSTs one phase to the interview SSE endpoint and returns the parsed events. */
async function askInterview(
  sectorId: number,
  body: {
    message: string;
    history: ChatMsg[];
    phase: "question" | "evaluate" | "final";
  },
): Promise<Record<string, unknown>[]> {
  const res = await apiFetch(`${BASE}api/interview/${sectorId}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (!res.ok || !res.body) throw new Error("network");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const events: Record<string, unknown>[] = [];
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const parsed: unknown = JSON.parse(line.slice(6));
        if (isRecord(parsed)) events.push(parsed);
      } catch {
        /* skip malformed chunk */
      }
    }
  }
  return events;
}

/** Rebuilds the server-contract history from the rendered turns. */
function buildHistory(turns: Turn[]): ChatMsg[] {
  const h: ChatMsg[] = [];
  for (const tn of turns) {
    h.push({ role: "assistant", content: tn.question, phase: "question" });
    if (tn.answer !== undefined) {
      h.push({ role: "user", content: tn.answer });
      if (tn.evaluation) {
        h.push({
          role: "assistant",
          content: JSON.stringify(tn.evaluation),
          phase: "evaluate",
        });
      }
    }
  }
  return h;
}

const DIFFICULTY_STYLE: Record<Difficulty, string> = {
  base: "bg-emerald-50 text-emerald-700 border-emerald-200",
  media: "bg-amber-50 text-amber-700 border-amber-200",
  avanzata: "bg-rose-50 text-rose-700 border-rose-200",
};
const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  base: "Base",
  media: "Media",
  avanzata: "Avanzata",
};

function scoreColor(score10: number): string {
  if (score10 >= 7.5) return "bg-emerald-500";
  if (score10 >= 5) return "bg-amber-500";
  return "bg-rose-500";
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function Colloquio() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const id = parseInt(params.id || "0", 10);

  const [phase, setPhase] = useState<Phase>("intro");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [answer, setAnswer] = useState("");
  const [report, setReport] = useState<FinalReport | null>(null);
  const [gate, setGate] = useState<GateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: sector, isLoading: sectorLoading } = useGetSector(id, {
    query: { enabled: !!id, queryKey: ["sector", id] },
  });

  const answeredCount = turns.filter((tn) => tn.evaluation).length;
  const lastTurn = turns[turns.length - 1];

  function evaluationFrom(ev: Record<string, unknown>): Evaluation {
    return {
      score: readNum(ev, "score"),
      clarity: readNum(ev, "clarity"),
      relevance: readNum(ev, "relevance"),
      depth: readNum(ev, "depth"),
      feedback: readStr(ev, "feedback") || "Risposta registrata.",
      suggestions: readStrArray(ev, "suggestions"),
    };
  }

  function questionTurnFrom(q: Record<string, unknown>): Turn {
    return {
      question: readStr(q, "question") || "Parlami della tua esperienza.",
      difficulty: readDifficulty(q, "difficulty"),
      focus: readStr(q, "focus") || "Esperienza",
    };
  }

  /** Returns "gate" and sets gate state if the events contain a gate event. */
  function handleGate(events: Record<string, unknown>[]): boolean {
    const gateEv = events.find((e) => readStr(e, "type") === "gate");
    if (!gateEv) return false;
    setGate({
      currentPlan: readStr(gateEv, "currentPlan") || "free",
      message:
        readStr(gateEv, "message") ||
        "Hai esaurito i colloqui gratuiti di questo mese. Passa a Pro per continuare.",
    });
    setPhase("gate");
    return true;
  }

  async function startInterview() {
    setError(null);
    setReport(null);
    setGate(null);
    setTurns([]);
    setAnswer("");
    setPhase("thinking");
    try {
      const events = await askInterview(id, {
        message: "",
        history: [],
        phase: "question",
      });
      if (handleGate(events)) return;
      const q = events.find((e) => readStr(e, "type") === "question");
      if (!q) throw new Error("no-question");
      setTurns([questionTurnFrom(q)]);
      setPhase("answering");
    } catch {
      setError("Non è stato possibile avviare il colloquio. Riprova.");
      setPhase("intro");
    }
  }

  async function submitAnswer() {
    const text = answer.trim();
    if (!text || phase !== "answering") return;
    setPhase("evaluating");
    setError(null);
    try {
      // buildHistory(turns): l'ultima turn è senza risposta = domanda corrente.
      const history = buildHistory(turns);
      const events = await askInterview(id, {
        message: text,
        history,
        phase: "evaluate",
      });
      const evEv = events.find((e) => readStr(e, "type") === "evaluation");
      const evaluation = evaluationFrom(evEv ?? {});
      setTurns((prev) =>
        prev.map((tn, i) =>
          i === prev.length - 1 ? { ...tn, answer: text, evaluation } : tn,
        ),
      );
      setAnswer("");
      setPhase("reviewing");
    } catch {
      setError("Errore nella valutazione. Riprova.");
      setPhase("answering");
    }
  }

  async function nextQuestion() {
    setPhase("thinking");
    setError(null);
    try {
      const events = await askInterview(id, {
        message: "",
        history: buildHistory(turns),
        phase: "question",
      });
      if (handleGate(events)) return;
      const q = events.find((e) => readStr(e, "type") === "question");
      if (!q) throw new Error("no-question");
      setTurns((prev) => [...prev, questionTurnFrom(q)]);
      setPhase("answering");
    } catch {
      setError("Errore nel generare la prossima domanda. Riprova.");
      setPhase("reviewing");
    }
  }

  async function finishInterview() {
    setPhase("thinking");
    setError(null);
    try {
      const events = await askInterview(id, {
        message: "",
        history: buildHistory(turns),
        phase: "final",
      });
      const fin = events.find((e) => readStr(e, "type") === "final");
      setReport({
        totalScore: fin ? readNum(fin, "totalScore") : 0,
        questionsAnswered: fin ? readNum(fin, "questionsAnswered") : answeredCount,
        averageScore: fin ? readNum(fin, "averageScore") : 0,
      });
      setPhase("final");
    } catch {
      setError("Errore nel generare il report. Riprova.");
      setPhase("reviewing");
    }
  }

  // ── Loading / not-found ──────────────────────────────────────────────────────

  if (sectorLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!sector) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground">Settore non trovato.</p>
        <Link href="/settori">
          <Button variant="ghost" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Aree
          </Button>
        </Link>
      </div>
    );
  }

  const busy = phase === "thinking" || phase === "evaluating";

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/settore/${id}`}>
          <Button variant="ghost" size="icon" className="rounded-full shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-bold text-xl">Simulatore Colloquio</h1>
            <Badge variant="outline">{sector.name}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Colloquio AI adattivo · {MAX_TURNS} domande
          </p>
        </div>
      </div>

      {/* Progress */}
      {(phase === "answering" ||
        phase === "evaluating" ||
        phase === "reviewing" ||
        (phase === "thinking" && turns.length > 0)) && (
        <div className="flex gap-1.5 mb-6">
          {Array.from({ length: MAX_TURNS }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                i < answeredCount
                  ? "bg-primary"
                  : i === answeredCount
                    ? "bg-primary/40"
                    : "bg-muted"
              }`}
            />
          ))}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ── Intro ── */}
      {phase === "intro" && (
        <Card>
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center mx-auto mb-5">
              <MessageSquare className="w-8 h-8 text-orange-600" />
            </div>
            <h2 className="font-bold text-lg mb-2">
              Pronto per il colloquio in {sector.name}?
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6 leading-relaxed">
              Wendy ti farà {MAX_TURNS} domande tecnico-comportamentali, valuterà ogni
              risposta e adatterà la difficoltà in base a come vai. Alla fine ricevi un
              report con il tuo punteggio di preparazione. Se hai caricato un CV, le
              domande saranno cucite sul tuo profilo.
            </p>
            <Button size="lg" onClick={startInterview} className="rounded-full px-8">
              <Sparkles className="w-4 h-4 mr-2" /> Inizia il colloquio
            </Button>
            <p className="text-xs text-muted-foreground mt-4">
              1 colloquio di prova gratuito al mese · illimitati con Pro
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Gate (free quota exhausted) ── */}
      {phase === "gate" && gate && (
        <Card className="border-2 border-primary/30">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
              <Lock className="w-7 h-7 text-primary" />
            </div>
            <h2 className="font-bold text-lg mb-2">Colloqui illimitati con Pro</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6 leading-relaxed">
              {gate.message}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                className="rounded-full px-8"
                onClick={() => setLocation("/premium")}
              >
                <Sparkles className="w-4 h-4 mr-2" /> Passa a Pro
              </Button>
              <Button size="lg" variant="outline" className="rounded-full px-6" asChild>
                <Link href={`/settore/${id}`}>Torna al settore</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Conversation (turns) ── */}
      {phase !== "intro" && phase !== "gate" && (
        <div className="space-y-4">
          {turns.map((tn, i) => {
            const isCurrent = i === turns.length - 1 && !tn.evaluation;
            return (
              <Card key={i} className={isCurrent ? "border-primary/40" : undefined}>
                <CardContent className="pt-5 pb-5 space-y-4">
                  {/* Question */}
                  <div>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        Domanda {i + 1}/{MAX_TURNS}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs ${DIFFICULTY_STYLE[tn.difficulty]}`}
                      >
                        {DIFFICULTY_LABEL[tn.difficulty]}
                      </Badge>
                      {tn.focus && (
                        <span className="text-xs text-muted-foreground">· {tn.focus}</span>
                      )}
                    </div>
                    <p className="text-sm font-medium leading-relaxed">{tn.question}</p>
                  </div>

                  {/* Answer (submitted) */}
                  {tn.answer !== undefined && (
                    <div className="rounded-xl bg-muted/50 px-4 py-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">
                        La tua risposta
                      </p>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                        {tn.answer}
                      </p>
                    </div>
                  )}

                  {/* Evaluation */}
                  {tn.evaluation && (
                    <div className="rounded-xl border bg-card px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">Valutazione</span>
                        <span className="text-sm font-bold">
                          {tn.evaluation.score}/10
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${scoreColor(tn.evaluation.score)}`}
                          style={{
                            width: `${Math.max(0, Math.min(100, tn.evaluation.score * 10))}%`,
                          }}
                        />
                      </div>
                      <p className="text-sm leading-relaxed">{tn.evaluation.feedback}</p>
                      {tn.evaluation.suggestions.length > 0 && (
                        <ul className="space-y-1 pt-1">
                          {tn.evaluation.suggestions.map((s, si) => (
                            <li
                              key={si}
                              className="flex gap-2 items-start text-xs text-muted-foreground"
                            >
                              <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* Answer input (current open question) */}
          {phase === "answering" && lastTurn && !lastTurn.evaluation && (
            <Card className="border-primary/40">
              <CardContent className="pt-4 pb-4">
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Scrivi la tua risposta…"
                  rows={5}
                  className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
                />
                <div className="flex justify-end mt-3">
                  <Button onClick={submitAnswer} disabled={!answer.trim()}>
                    <Send className="w-4 h-4 mr-2" /> Invia risposta
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Thinking / evaluating loader */}
          {busy && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              {phase === "evaluating" ? "Valutazione in corso…" : "Wendy sta pensando…"}
            </div>
          )}

          {/* Review actions */}
          {phase === "reviewing" && (
            <div className="flex justify-end">
              {answeredCount >= MAX_TURNS ? (
                <Button onClick={finishInterview}>
                  <Award className="w-4 h-4 mr-2" /> Vedi il report finale
                </Button>
              ) : (
                <Button onClick={nextQuestion}>
                  Prossima domanda <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Final report ── */}
      {phase === "final" && report && (
        <div className="space-y-4">
          <Card className="border-2 border-primary/30">
            <CardContent className="pt-8 pb-6 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Award className="w-8 h-8 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground mb-1">
                Punteggio di preparazione
              </p>
              <div className="text-5xl font-bold mb-2">{report.totalScore}%</div>
              <p className="text-sm text-muted-foreground">
                {report.questionsAnswered} risposte · media {report.averageScore}/10
              </p>
              <div className="h-3 rounded-full bg-muted overflow-hidden max-w-xs mx-auto mt-4">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    report.totalScore >= 70
                      ? "bg-emerald-500"
                      : report.totalScore >= 40
                        ? "bg-amber-500"
                        : "bg-rose-500"
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, report.totalScore))}%` }}
                />
              </div>
              <p className="text-sm mt-4 font-medium">
                {report.totalScore >= 70
                  ? "Ottima preparazione — sei pronto!"
                  : report.totalScore >= 40
                    ? "Buona base, con margini di miglioramento."
                    : "Continua ad allenarti: rivedi i feedback qui sopra."}
              </p>
            </CardContent>
          </Card>

          {/* Per-question recap */}
          <Card>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-semibold">Riepilogo risposte</span>
              </div>
              <div className="space-y-2">
                {turns.map((tn, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground truncate mr-3">
                      {i + 1}. {tn.focus}
                    </span>
                    <span className="font-semibold shrink-0">
                      {tn.evaluation?.score ?? 0}/10
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={startInterview}>
              <RefreshCw className="w-4 h-4 mr-2" /> Nuovo colloquio
            </Button>
            <Button className="flex-1" onClick={() => setLocation(`/skills-gap/${id}`)}>
              Analizza le competenze <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
