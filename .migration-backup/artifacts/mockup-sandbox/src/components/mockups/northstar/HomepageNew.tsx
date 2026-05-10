import { useState } from "react";

const NAV = ["Il Test", "Settori", "Ruoli", "Crescita", "News", "Premium"];

const STATS = [
  { value: "12.400+", label: "Test completati" },
  { value: "28", label: "Settori analizzati" },
  { value: "94%", label: "Soddisfazione utenti" },
];

const HOW_STEPS = [
  {
    num: "01",
    icon: "🧬",
    title: "Scopri la tua personalità",
    desc: "Completa il test RIASEC + Cinque Spiriti in 5 minuti. Nessuna risposta giusta o sbagliata.",
    color: "#A8D5BA",
  },
  {
    num: "02",
    icon: "🗺️",
    title: "Esplora i tuoi settori",
    desc: "Ricevi i tuoi 28 settori ordinati per compatibilità con salari, trend e automazione.",
    color: "#D4AF37",
  },
  {
    num: "03",
    icon: "🤖",
    title: "Attiva gli strumenti AI",
    desc: "Coach AI, simulatore colloquio, gap analysis, roadmap personalizzata e molto altro.",
    color: "#A8D5BA",
  },
];

const TOOLS = [
  { icon: "💬", name: "Coach AI", desc: "Sessioni guidate con l'AI", premium: false },
  { icon: "🎯", name: "Skills Gap", desc: "Analisi lacune competenze", premium: true },
  { icon: "🎤", name: "Colloquio AI", desc: "Simula un'intervista reale", premium: true },
  { icon: "🗺️", name: "Roadmap AI", desc: "Piano d'azione step-by-step", premium: true },
  { icon: "💡", name: "Valida Idea", desc: "Validazione business AI", premium: true },
  { icon: "🔬", name: "Knowledge Graph", desc: "Mappa la tua conoscenza", premium: true },
];

export function HomepageNew() {
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", background: "#F8F9FB", minHeight: "100vh" }}>

      {/* Navbar */}
      <nav style={{
        background: "#002855",
        padding: "0 48px",
        height: "64px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 100,
        boxShadow: "0 2px 20px rgba(0,40,85,0.3)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "32px", height: "32px", borderRadius: "50%",
            background: "linear-gradient(135deg, #D4AF37, #f0cc5a)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "16px",
          }}>✦</div>
          <span style={{ color: "#D4AF37", fontWeight: 800, fontSize: "16px", letterSpacing: "0.06em" }}>NORTHSTAR</span>
        </div>

        <div style={{ display: "flex", gap: "32px" }}>
          {NAV.map((n) => (
            <span key={n} style={{
              color: "#93b8d8", fontSize: "13px", fontWeight: 500,
              letterSpacing: "0.04em", cursor: "pointer",
              textTransform: "uppercase",
            }}>{n}</span>
          ))}
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button style={{
            background: "transparent", border: "1px solid rgba(255,255,255,0.2)",
            color: "#93b8d8", borderRadius: "8px",
            padding: "8px 20px", fontSize: "13px", fontWeight: 500, cursor: "pointer",
          }}>Accedi</button>
          <button style={{
            background: "linear-gradient(135deg, #D4AF37, #f0cc5a)",
            border: "none", color: "#001229",
            borderRadius: "8px", padding: "8px 20px",
            fontSize: "13px", fontWeight: 700, cursor: "pointer",
          }}>Inizia Gratis</button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        background: "linear-gradient(160deg, #002855 0%, #003d7a 50%, #002040 100%)",
        padding: "80px 48px 100px",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Background glow */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: "600px", height: "400px",
          background: "radial-gradient(ellipse, rgba(212,175,55,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{
          display: "inline-flex", alignItems: "center", gap: "8px",
          background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.3)",
          borderRadius: "100px", padding: "6px 16px", marginBottom: "28px",
        }}>
          <span style={{ color: "#D4AF37", fontSize: "13px", fontWeight: 600 }}>
            ✦ La piattaforma italiana per l'orientamento professionale
          </span>
        </div>

        <h1 style={{
          fontSize: "clamp(32px, 5vw, 56px)",
          fontWeight: 900,
          color: "#ffffff",
          lineHeight: 1.15,
          margin: "0 auto 24px",
          maxWidth: "780px",
        }}>
          Trova il tuo percorso,{" "}
          <span style={{
            background: "linear-gradient(90deg, #D4AF37, #f0cc5a)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>con consapevolezza</span>
        </h1>

        <p style={{
          color: "#93b8d8",
          fontSize: "18px",
          lineHeight: 1.7,
          maxWidth: "560px",
          margin: "0 auto 40px",
        }}>
          NorthStar non ti dice cosa fare. Ti offre una bussola per esplorare i settori che risuonano con la tua natura, guidandoti verso una scelta autentica.
        </p>

        <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
          <button style={{
            background: "linear-gradient(135deg, #D4AF37, #f0cc5a)",
            border: "none", color: "#001229",
            borderRadius: "100px", padding: "16px 40px",
            fontSize: "16px", fontWeight: 700, cursor: "pointer",
            boxShadow: "0 8px 24px rgba(212,175,55,0.4)",
          }}>
            Inizia il Test Gratuito →
          </button>
          <button style={{
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.25)",
            color: "#ffffff",
            borderRadius: "100px", padding: "16px 40px",
            fontSize: "16px", fontWeight: 500, cursor: "pointer",
          }}>
            Scopri come funziona
          </button>
        </div>

        {/* Stats */}
        <div style={{
          display: "flex", gap: "0", justifyContent: "center",
          margin: "60px auto 0", maxWidth: "600px",
          background: "rgba(255,255,255,0.06)",
          borderRadius: "16px",
          border: "1px solid rgba(255,255,255,0.1)",
          overflow: "hidden",
        }}>
          {STATS.map((s, i) => (
            <div key={s.label} style={{
              flex: 1, padding: "24px",
              borderRight: i < STATS.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none",
              textAlign: "center",
            }}>
              <div style={{ color: "#D4AF37", fontSize: "28px", fontWeight: 800, marginBottom: "4px" }}>{s.value}</div>
              <div style={{ color: "#6a9bb5", fontSize: "13px" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Percorso personalizzato banner */}
      <section style={{
        background: "#002855",
        padding: "20px 48px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "24px",
        flexWrap: "wrap",
      }}>
        <span style={{ color: "#93b8d8", fontSize: "14px" }}>Il tuo percorso:</span>
        {["Indeciso", "Dipendente", "Autonomo", "Azienda", "Investitore"].map((p) => (
          <button key={p} style={{
            background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.25)",
            color: "#D4AF37", borderRadius: "100px", padding: "6px 18px",
            fontSize: "13px", fontWeight: 600, cursor: "pointer",
          }}>{p}</button>
        ))}
      </section>

      {/* Come funziona */}
      <section style={{ padding: "80px 48px", background: "#F8F9FB" }}>
        <div style={{ textAlign: "center", marginBottom: "56px" }}>
          <div style={{
            display: "inline-block",
            background: "#A8D5BA22", border: "1px solid #A8D5BA55",
            borderRadius: "100px", padding: "6px 20px", marginBottom: "16px",
          }}>
            <span style={{ color: "#2d7a52", fontSize: "13px", fontWeight: 600 }}>Come funziona</span>
          </div>
          <h2 style={{ color: "#002855", fontSize: "36px", fontWeight: 800, margin: "0 0 16px" }}>
            Tre passi verso la chiarezza
          </h2>
          <p style={{ color: "#6b7280", fontSize: "16px", maxWidth: "500px", margin: "0 auto" }}>
            Dal test alla roadmap operativa, tutto in un'unica piattaforma intelligente.
          </p>
        </div>

        <div style={{ display: "flex", gap: "24px", maxWidth: "960px", margin: "0 auto", flexWrap: "wrap" }}>
          {HOW_STEPS.map((s) => (
            <div key={s.num} style={{
              flex: "1 1 280px",
              background: "#ffffff",
              borderRadius: "20px",
              padding: "32px",
              border: "1px solid #E5E7EB",
              position: "relative",
              overflow: "hidden",
            }}>
              <div style={{
                position: "absolute", top: "20px", right: "20px",
                fontSize: "48px", fontWeight: 900, opacity: 0.06, color: "#002855",
              }}>{s.num}</div>
              <div style={{ fontSize: "40px", marginBottom: "20px" }}>{s.icon}</div>
              <h3 style={{ color: "#002855", fontSize: "20px", fontWeight: 700, margin: "0 0 12px" }}>{s.title}</h3>
              <p style={{ color: "#6b7280", fontSize: "14px", lineHeight: 1.7, margin: 0 }}>{s.desc}</p>
              <div style={{
                marginTop: "20px", height: "3px", borderRadius: "100px",
                background: `linear-gradient(90deg, ${s.color}, ${s.color}44)`,
                width: "48px",
              }} />
            </div>
          ))}
        </div>
      </section>

      {/* Strumenti AI */}
      <section style={{ padding: "80px 48px", background: "#002855" }}>
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <h2 style={{ color: "#ffffff", fontSize: "34px", fontWeight: 800, margin: "0 0 12px" }}>
            Il tuo arsenale <span style={{ color: "#D4AF37" }}>AI</span>
          </h2>
          <p style={{ color: "#6a9bb5", fontSize: "16px", maxWidth: "480px", margin: "0 auto" }}>
            Strumenti avanzati per ogni fase del tuo percorso professionale.
          </p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          maxWidth: "960px",
          margin: "0 auto",
        }}>
          {TOOLS.map((t) => (
            <div key={t.name} style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "16px",
              padding: "24px",
              position: "relative",
            }}>
              {t.premium && (
                <div style={{
                  position: "absolute", top: "12px", right: "12px",
                  background: "rgba(212,175,55,0.2)", border: "1px solid rgba(212,175,55,0.4)",
                  borderRadius: "6px", padding: "2px 8px",
                  color: "#D4AF37", fontSize: "10px", fontWeight: 700,
                }}>PREMIUM</div>
              )}
              <div style={{ fontSize: "32px", marginBottom: "12px" }}>{t.icon}</div>
              <div style={{ color: "#ffffff", fontWeight: 700, fontSize: "15px", marginBottom: "6px" }}>{t.name}</div>
              <div style={{ color: "#6a9bb5", fontSize: "13px" }}>{t.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA footer */}
      <section style={{
        background: "linear-gradient(135deg, #A8D5BA 0%, #7fc4a0 100%)",
        padding: "64px 48px",
        textAlign: "center",
      }}>
        <h2 style={{ color: "#002855", fontSize: "36px", fontWeight: 900, margin: "0 0 16px" }}>
          Inizia il tuo viaggio oggi
        </h2>
        <p style={{ color: "#1a4d35", fontSize: "16px", margin: "0 0 32px" }}>
          Test gratuito, nessuna carta di credito richiesta.
        </p>
        <button style={{
          background: "#002855",
          border: "none", color: "#D4AF37",
          borderRadius: "100px", padding: "18px 56px",
          fontSize: "17px", fontWeight: 700, cursor: "pointer",
          boxShadow: "0 8px 24px rgba(0,40,85,0.3)",
        }}>
          Inizia il Test Gratuito ✦
        </button>
      </section>
    </div>
  );
}
