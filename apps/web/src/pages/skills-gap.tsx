import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api-fetch";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetSector } from "@workspace/api-client-react";
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  Loader2,
  Plus,
  RefreshCw,
  Target,
  X,
} from "lucide-react";
import React, { useState } from "react";
import { Link, useLocation, useParams } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

type Step = "select" | "analyzing" | "results";
type Level = "junior" | "mid" | "senior";
type StreamError = {
  title: string;
  message: string;
  retryable: boolean;
};

const LEVEL_LABELS: Record<Level, string> = {
  junior: "Junior (0-2 anni)",
  mid: "Mid (2-5 anni)",
  senior: "Senior (5+ anni)",
};

function formatLine(line: string, key: number) {
  const parts = line.split(/\*\*(.*?)\*\*/g);
  return (
    <span key={key}>
      {parts.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : p))}
    </span>
  );
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line === "") {
      elements.push(<div key={i} className="h-2" />);
    } else if (line.startsWith("## ")) {
      elements.push(
        <h3 key={i} className="font-bold text-base mt-4 mb-1">
          {formatLine(line.slice(3), i)}
        </h3>,
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h4 key={i} className="font-semibold mt-3 mb-0.5">
          {formatLine(line.slice(4), i)}
        </h4>,
      );
    } else if (line.startsWith("- ") || line.startsWith("• ")) {
      elements.push(
        <div key={i} className="flex gap-2 items-start ml-2">
          <span className="shrink-0 mt-2 w-1.5 h-1.5 rounded-full bg-current opacity-40" />
          <span className="text-sm">{formatLine(line.slice(2), i)}</span>
        </div>,
      );
    } else if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\./)?.[1];
      elements.push(
        <div key={i} className="flex gap-2 items-start ml-2">
          <span className="shrink-0 font-mono text-xs opacity-50 mt-0.5 w-4">
            {num}.
          </span>
          <span className="text-sm">
            {formatLine(line.replace(/^\d+\.\s/, ""), i)}
          </span>
        </div>,
      );
    } else {
      elements.push(
        <p key={i} className="text-sm leading-relaxed">
          {formatLine(line, i)}
        </p>,
      );
    }
    i++;
  }
  return <div className="space-y-1">{elements}</div>;
}

function extractReadinessScore(text: string): number | null {
  const match = text.match(/Indice di Readiness[:\s]*(\d+)\s*\/\s*100/i);
  return match?.[1] ? parseInt(match[1], 10) : null;
}

const PROGRESS_TEXTS = [
  "Analizzando le tue competenze…",
  "Confrontando con i requisiti del settore…",
  "Calcolando i gap prioritari…",
  "Elaborando il piano d'azione…",
  "Preparazione del rapporto finale…",
];

function streamErrorFromUnknown(error: unknown): StreamError {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();
  if (normalized.includes("provider_not_configured") || normalized.includes("not_configured")) {
    return {
      title: "AI non configurata",
      message: "Il provider AI non e configurato. L'analisi non e stata aggiornata.",
      retryable: false,
    };
  }
  if (
    normalized.includes("malformed") ||
    normalized.includes("empty_stream") ||
    normalized.includes("incomplete")
  ) {
    return {
      title: "Risposta AI incompleta",
      message: "Lo stream dell'analisi si e interrotto o contiene dati non validi. Riprova senza perdere le competenze selezionate.",
      retryable: true,
    };
  }
  return {
    title: "Analisi non completata",
    message: "Non sono riuscito a completare l'analisi. Riprova tra poco.",
    retryable: true,
  };
}

function readSseContent(data: unknown) {
  if (typeof data !== "object" || data === null) return "";
  if ("content" in data && typeof data.content === "string") return data.content;
  if ("value" in data && typeof data.value === "string") return data.value;
  return "";
}

function isSseDone(data: unknown) {
  return (
    typeof data === "object" &&
    data !== null &&
    (("type" in data && data.type === "done") ||
      ("done" in data && data.done === true))
  );
}

function readSseError(data: unknown) {
  if (
    typeof data !== "object" ||
    data === null ||
    !("type" in data) ||
    data.type !== "error"
  ) {
    return null;
  }
  const code = "code" in data && typeof data.code === "string" ? data.code : "stream_failed";
  const message = "message" in data && typeof data.message === "string" ? data.message : "Errore stream";
  return new Error(`${code}: ${message}`);
}

export default function SkillsGap() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const id = parseInt(params.id || "0", 10);

  const [step, setStep] = useState<Step>("select");
  const [userSkills, setUserSkills] = useState<string[]>([]);
  const [customSkill, setCustomSkill] = useState("");
  const [level, setLevel] = useState<Level>("junior");
  const [result, setResult] = useState("");
  const [streamError, setStreamError] = useState<StreamError | null>(null);
  const [progressIdx, setProgressIdx] = useState(0);
  const [, setIsStreaming] = useState(false);

  const { data: sector, isLoading: sectorLoading } = useGetSector(id, {
    query: { enabled: !!id, queryKey: ["sector", id] },
  });

  const sectorSkills = (sector?.skills as string[] | undefined) ?? [];

  function toggleSkill(skill: string) {
    setUserSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill],
    );
  }

  function addCustomSkill() {
    const s = customSkill.trim();
    if (s && !userSkills.includes(s)) {
      setUserSkills((prev) => [...prev, s]);
    }
    setCustomSkill("");
  }

  async function analyze() {
    setStep("analyzing");
    setResult("");
    setStreamError(null);
    setProgressIdx(0);
    setIsStreaming(true);

    const interval = setInterval(() => {
      setProgressIdx((prev) =>
        prev < PROGRESS_TEXTS.length - 1 ? prev + 1 : prev,
      );
    }, 1800);

    let accumulated = "";

    try {
      const res = await apiFetch(`${BASE}api/skills-gap/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectorId: id,
          userSkills,
          experienceLevel: level,
        }),
        credentials: "include",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null) as { code?: string; error?: string; message?: string } | null;
        throw new Error(body?.code ?? body?.error ?? body?.message ?? `HTTP ${res.status}`);
      }
      if (!res.body) throw new Error("empty_stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let sawMalformedEvent = false;
      let sawTerminalEvent = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let data: unknown;
          try {
            data = JSON.parse(line.slice(6)) as unknown;
          } catch {
            sawMalformedEvent = true;
            continue;
          }
          const streamFailure = readSseError(data);
          if (streamFailure) throw streamFailure;
          if (isSseDone(data)) {
            sawTerminalEvent = true;
            continue;
          }
          const content = readSseContent(data);
          if (content) {
            accumulated += content;
            setResult(accumulated);
          }
        }
      }

      buffer += decoder.decode();
      if (buffer.trim()) {
        sawMalformedEvent = true;
      }
      if (sawMalformedEvent) throw new Error("malformed_sse");
      if (!sawTerminalEvent || !accumulated.trim()) throw new Error("empty_stream");

      setStep("results");
    } catch (error) {
      setStreamError(streamErrorFromUnknown(error));
      setResult("");
      setStep("results");
    }

    clearInterval(interval);
    setIsStreaming(false);
  }

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
            <ArrowLeft className="w-4 h-4 mr-2" />
            Aree
          </Button>
        </Link>
      </div>
    );
  }

  const readiness = extractReadinessScore(result);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/settore/${id}`}>
          <Button variant="ghost" size="icon" className="rounded-full shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-bold text-xl">Skills Gap Analysis</h1>
            <Badge variant="outline">{sector.name}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Scopri cosa ti manca per entrare nel settore
          </p>
        </div>
      </div>

      {/* Step 1 — Select skills */}
      {step === "select" && (
        <div className="space-y-6">
          {/* Level selector */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">
                Livello esperienza
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(LEVEL_LABELS) as Level[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLevel(l)}
                    className={`rounded-xl border py-2.5 px-3 text-xs font-medium transition-colors ${
                      level === l
                        ? "bg-primary text-primary-foreground border-primary"
                        : "hover:border-primary/50 hover:bg-muted/50"
                    }`}
                  >
                    {LEVEL_LABELS[l]}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Sector skills checkboxes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">
                Competenze del settore — seleziona quelle che già possiedi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {sectorSkills.map((skill) => (
                  <button
                    key={skill}
                    onClick={() => toggleSkill(skill)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                      userSkills.includes(skill)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "hover:border-primary/40 hover:bg-muted/40"
                    }`}
                  >
                    {userSkills.includes(skill) && (
                      <span className="mr-1">✓</span>
                    )}
                    {skill}
                  </button>
                ))}
              </div>

              {/* Custom skill input */}
              <div className="flex gap-2 mt-4">
                <input
                  type="text"
                  value={customSkill}
                  onChange={(e) => setCustomSkill(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustomSkill()}
                  placeholder="Aggiungi competenza…"
                  className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addCustomSkill}
                  disabled={!customSkill.trim()}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {userSkills.filter((s) => !sectorSkills.includes(s)).length >
                0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {userSkills
                    .filter((s) => !sectorSkills.includes(s))
                    .map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-medium"
                      >
                        {s}
                        <button
                          onClick={() => toggleSkill(s)}
                          className="hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Button className="w-full" size="lg" onClick={analyze}>
            <Target className="w-4 h-4 mr-2" />
            Analizza il mio gap
            {userSkills.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-2 bg-primary-foreground/20 text-primary-foreground"
              >
                {userSkills.length} skill
              </Badge>
            )}
          </Button>
        </div>
      )}

      {/* Step 2 — Analyzing */}
      {step === "analyzing" && (
        <div className="flex flex-col items-center justify-center py-20 gap-6 text-center">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Target className="w-8 h-8 text-primary" />
            </div>
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
              <Loader2 className="w-3 h-3 text-primary-foreground animate-spin" />
            </div>
          </div>
          <div>
            <h2 className="font-semibold text-lg mb-2">Analisi in corso…</h2>
            <p className="text-sm text-muted-foreground animate-pulse">
              {PROGRESS_TEXTS[progressIdx] ?? PROGRESS_TEXTS[0]}
            </p>
          </div>
          <div className="flex gap-1">
            {PROGRESS_TEXTS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  i <= progressIdx ? "bg-primary w-8" : "bg-muted w-4"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Step 3 — Results */}
      {step === "results" && (
        <div className="space-y-4">
          {streamError && (
            <Card role="alert" className="border-destructive/35 bg-destructive/5">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="font-semibold text-base">{streamError.title}</h2>
                    <p className="text-sm text-muted-foreground">{streamError.message}</p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button onClick={analyze} disabled={!streamError.retryable}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Riprova analisi
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStreamError(null);
                      setStep("select");
                    }}
                  >
                    Modifica competenze
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {readiness !== null && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">
                    Indice di Readiness
                  </span>
                  <span className="font-bold text-lg">{readiness}/100</span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      readiness >= 70
                        ? "bg-emerald-500"
                        : readiness >= 40
                          ? "bg-amber-500"
                          : "bg-rose-500"
                    }`}
                    style={{ width: `${readiness}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {readiness >= 70
                    ? "Ottima preparazione!"
                    : readiness >= 40
                      ? "Buona base, con gap da colmare"
                      : "Piano di formazione necessario"}
                </p>
              </CardContent>
            </Card>
          )}

          {!streamError && (
            <Card>
              <CardContent className="pt-6">
                <MarkdownContent content={result} />
              </CardContent>
            </Card>
          )}

          {!streamError && <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setStep("select");
                setResult("");
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Rinizia analisi
            </Button>
            <Button
              className="flex-1"
              onClick={() => setLocation(`/roadmap/${id}`)}
            >
              Vai alla Roadmap
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>}
        </div>
      )}
    </div>
  );
}
