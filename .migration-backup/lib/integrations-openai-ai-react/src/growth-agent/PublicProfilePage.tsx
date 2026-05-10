/**
 * PublicProfilePage — Passo 4: pagina pubblica /u/[username].
 *
 * Visibile a chiunque (no auth). Mostra:
 *   - Avatar + nome + username + journeyType badge
 *   - Livello XP + streak attivo
 *   - Profilo RIASEC: top-3 tipi + radar mini
 *   - Settori consigliati (top 3)
 *   - CTA "Unisciti a NorthStar" con link referral affiliato (opzionale)
 *   - Footer: data iscrizione
 *
 * Se isPublic = false (o utente inesistente), mostra pagina 404 graziosa.
 *
 * Props:
 *   username    lo slug dall'URL (/u/:username)
 *   apiBase     default '/api'
 *   referralCode se l'URL ha ?ref=CODE, pre-popola il link signup
 *   appUrl      base URL per CTA e link referral (default '/')
 */
import React, { useEffect, useState } from "react";

// ── Types ───────────────────────────────────────────────────────────────────

interface PublicProfile {
  name:         string;
  username:     string;
  avatarUrl:    string | null;
  journeyType:  string;
  totalXp:      number;
  level:        number;
  streakDays:   number;
  voiceStreak:  number;
  memberSince:  string; // ISO
  referralCode: string | null; // null se non affiliato
  riasec: {
    primaryTypes:    string[];
    riasecScores:    Record<string, number>;
    profileSummary:  string;
    recommendations: Array<{ sectorName: string; matchScore: number }>;
  } | null;
}

// ── RIASEC meta (subset) ──────────────────────────────────────────────────

const R_META: Record<string, { label: string; emoji: string; color: string }> = {
  R: { label: "Realistico",      emoji: "🔧", color: "#f97316" },
  I: { label: "Investigativo",   emoji: "🔬", color: "#6366f1" },
  A: { label: "Artistico",       emoji: "🎨", color: "#ec4899" },
  S: { label: "Sociale",         emoji: "🤝", color: "#22c55e" },
  E: { label: "Intraprendente",  emoji: "🚀", color: "#eab308" },
  C: { label: "Convenzionale",   emoji: "📊", color: "#14b8a6" },
};

const JOURNEY_LABELS: Record<string, { label: string; color: string }> = {
  indeciso:       { label: "In esplorazione",     color: "#6366f1" },
  in_transizione: { label: "In transizione",       color: "#f97316" },
  in_crescita:    { label: "In crescita attiva",   color: "#22c55e" },
  autonomo:       { label: "Imprenditore",         color: "#8b5cf6" },
};

const LEVEL_NAMES: Record<number, string> = {
  0:"Esploratore",1:"Curioso",2:"Apprendista",3:"Praticante",4:"Competente",
  5:"Esperto",6:"Specialista",7:"Maestro",8:"Campione",9:"Leggenda",10:"Visionario",
};

// ── Mini radar (100x100) ─────────────────────────────────────────────────────────

function MiniRadar({ scores }: { scores: Record<string, number> }) {
  const SIZE = 100; const C = SIZE / 2; const R = 36;
  const keys = ["R","I","A","S","E","C"]; const n = keys.length;
  const max = Math.max(...Object.values(scores), 1);
  function angle(i: number) { return (i / n) * 2 * Math.PI - Math.PI / 2; }
  function pt(i: number, r: number) { return { x: C + r * Math.cos(angle(i)), y: C + r * Math.sin(angle(i)) }; }
  const grid = [0.33,0.66,1].map((p) =>
    keys.map((_,i)=>pt(i,R*p)).map((pp,i)=>`${i===0?"M":"L"} ${pp.x} ${pp.y}`).join(" ")+" Z"
  );
  const data = keys.map((k,i) => pt(i,(scores[k]??0)/max*R));
  const dPath = data.map((p,i)=>`${i===0?"M":"L"} ${p.x} ${p.y}`).join(" ")+" Z";
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} className="overflow-visible">
      {grid.map((d,i)=><path key={i} d={d} fill="none" stroke="#e5e7eb" strokeWidth={0.7}/>)}
      {keys.map((_,i)=>{ const a=pt(i,R),b={x:C,y:C}; return <line key={i} x1={b.x} y1={b.y} x2={a.x} y2={a.y} stroke="#e5e7eb" strokeWidth={0.7}/>; })}
      <path d={dPath} fill="#6366f1" fillOpacity={0.25} stroke="#6366f1" strokeWidth={1.5} strokeLinejoin="round"/>
      {data.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={2.5} fill="#6366f1"/>)}
      {keys.map((k,i)=>{ const lp=pt(i,R+12); return <text key={k} x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle" fontSize={8} fontWeight={600} fill={R_META[k]?.color}>{k}</text>; })}
    </svg>
  );
}

// ── CopyButton ─────────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(()=>setCopied(false),2000); }}
      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors flex-shrink-0"
    >
      {copied ? "✓ Copiato" : "Copia"}
    </button>
  );
}

// ── NotFound / Private ─────────────────────────────────────────────────────────

function NotFoundPage({ appUrl }: { appUrl: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 text-center">
      <p className="text-6xl mb-4">🔒</p>
      <h1 className="text-xl font-bold mb-2">Profilo non trovato</h1>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs">
        Questo profilo non esiste o ha scelto di tenerlo privato.
      </p>
      <a href={appUrl}
        className="rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90">
        Vai a NorthStar
      </a>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────────

export interface PublicProfilePageProps {
  username:      string;
  apiBase?:      string;
  appUrl?:       string;
  referralCode?: string; // da query string ?ref=CODE
  className?:    string;
}

export function PublicProfilePage({
  username,
  apiBase = "/api",
  appUrl  = "/",
  referralCode,
  className = "",
}: PublicProfilePageProps) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${apiBase}/u/${encodeURIComponent(username)}`);
        if (res.status === 404) { setNotFound(true); return; }
        if (!res.ok) throw new Error();
        setProfile(await res.json() as PublicProfile);
      } catch { setNotFound(true); }
      finally { setLoading(false); }
    })();
  }, [username, apiBase]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"/>
    </div>
  );

  if (notFound || !profile) return <NotFoundPage appUrl={appUrl}/>;

  const journey     = JOURNEY_LABELS[profile.journeyType] ?? { label: profile.journeyType, color: "#6366f1" };
  const levelName   = LEVEL_NAMES[Math.min(profile.level, 10)] ?? `Livello ${profile.level}`;
  const topStreak   = Math.max(profile.streakDays, profile.voiceStreak);
  const memberYear  = new Date(profile.memberSince).getFullYear();
  const initials    = profile.name.split(" ").slice(0,2).map((w)=>w[0]?.toUpperCase()??" ").join("");

  // Signup URL: with referral if present
  const signupUrl = referralCode
    ? `${appUrl}/signup?ref=${referralCode}`
    : profile.referralCode
    ? `${appUrl}/signup?ref=${profile.referralCode}`
    : `${appUrl}/signup`;

  return (
    <div className={`min-h-screen bg-gray-50 ${className}`}>

      {/* Top bar */}
      <header className="bg-white border-b border-border px-4 py-3 flex items-center justify-between">
        <a href={appUrl} className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <span className="text-white text-xs font-black">N</span>
          </div>
          <span className="text-sm font-semibold">NorthStar</span>
        </a>
        <a href={signupUrl}
          className="rounded-xl bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
          Unisciti gratis
        </a>
      </header>

      <main className="max-w-xl mx-auto px-4 py-8 space-y-5">

        {/* ── Hero card ─────────────────────────────────────────── */}
        <div className="rounded-2xl bg-white border border-border p-6">
          <div className="flex items-start gap-4">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={profile.name}
                className="h-20 w-20 rounded-2xl object-cover flex-shrink-0 shadow-sm"/>
            ) : (
              <div className="h-20 w-20 rounded-2xl bg-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                <span className="text-white text-2xl font-black">{initials}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold leading-tight">{profile.name}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">@{profile.username}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {/* Journey badge */}
                <span
                  className="rounded-full px-3 py-0.5 text-xs font-medium text-white"
                  style={{ background: journey.color }}
                >
                  {journey.label}
                </span>
                {/* Level badge */}
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-0.5 text-xs font-medium text-indigo-700">
                  Lv.{profile.level} {levelName}
                </span>
                {/* Streak badge */}
                {topStreak > 0 && (
                  <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-0.5 text-xs font-medium text-orange-600">
                    🔥 {topStreak} giorni
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* XP bar */}
          <div className="mt-4">
            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
              <span>{profile.totalXp.toLocaleString("it-IT")} XP totali</span>
              <span>Lv.{profile.level + 1} → {(profile.level + 1) * 500} XP</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                style={{ width: `${Math.round(((profile.totalXp % 500) / 500) * 100)}%` }}
              />
            </div>
          </div>

          {/* Member since */}
          <p className="mt-3 text-[11px] text-muted-foreground">
            Membro NorthStar dal {memberYear}
          </p>
        </div>

        {/* ── RIASEC card ─────────────────────────────────────────── */}
        {profile.riasec && (
          <div className="rounded-2xl bg-white border border-border p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4">Profilo RIASEC</p>
            <div className="flex items-center gap-5">
              <MiniRadar scores={profile.riasec.riasecScores}/>
              <div className="flex-1 space-y-2">
                {profile.riasec.primaryTypes.slice(0,3).map((key) => {
                  const m = R_META[key]; if (!m) return null;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-base">{m.emoji}</span>
                      <span className="text-xs font-bold" style={{color:m.color}}>{key}</span>
                      <span className="text-xs font-medium">{m.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            {profile.riasec.profileSummary && (
              <p className="mt-3 text-xs text-muted-foreground leading-relaxed border-t border-border pt-3">
                {profile.riasec.profileSummary}
              </p>
            )}
          </div>
        )}

        {/* ── Settori ─────────────────────────────────────────────── */}
        {profile.riasec?.recommendations?.length ? (
          <div className="rounded-2xl bg-white border border-border p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Settori di interesse</p>
            <div className="space-y-2">
              {profile.riasec.recommendations.slice(0,3).map((r, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium">{r.sectorName}</span>
                    <span className="text-primary font-semibold">{Math.round(r.matchScore)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-400" style={{width:`${Math.round(r.matchScore)}%`}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* ── CTA affiliato ─────────────────────────────────────────── */}
        <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-6 text-white text-center">
          <p className="text-2xl mb-2">🌟</p>
          <h2 className="text-base font-bold mb-1">Scopri il tuo percorso</h2>
          <p className="text-xs text-indigo-200 mb-4">
            NorthStar ti aiuta a trovare la direzione giusta con coaching AI personalizzato.
          </p>
          <a href={signupUrl}
            className="inline-block rounded-xl bg-white px-6 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 transition-colors">
            Inizia gratis →
          </a>
          {profile.referralCode && (
            <p className="mt-3 text-[10px] text-indigo-300">
              Invitato da @{profile.username} • primo mese con sconto
            </p>
          )}
        </div>

        {/* Share link */}
        <div className="rounded-2xl bg-white border border-border p-4">
          <p className="text-xs font-medium mb-2">Condividi questo profilo</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-muted px-3 py-2 text-xs truncate">
              {typeof window !== "undefined" ? window.location.href : `https://northstar.app/u/${profile.username}`}
            </code>
            <CopyButton text={typeof window !== "undefined" ? window.location.href : `https://northstar.app/u/${profile.username}`}/>
          </div>
        </div>

      </main>
    </div>
  );
}
