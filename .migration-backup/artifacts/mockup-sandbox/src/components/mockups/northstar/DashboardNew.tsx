import { useState } from "react";

const SIDEBAR_ITEMS = [
  { icon: "🏠", label: "Home", active: true },
  { icon: "📊", label: "I miei risultati", active: false },
  { icon: "🗺️", label: "Roadmap", active: false },
  { icon: "🎯", label: "Skills Gap", active: false },
  { icon: "🎤", label: "Colloquio AI", active: false },
  { icon: "💡", label: "Valida Idea", active: false },
  { icon: "📰", label: "News", active: false },
  { icon: "📅", label: "Calendario", active: false },
];

const TOP_SECTORS = [
  { name: "Tecnologia & AI", match: 92, icon: "💻", trend: "+12%", salary: "38-65k" },
  { name: "Design & UX", match: 87, icon: "🎨", trend: "+8%", salary: "32-55k" },
  { name: "Marketing Digitale", match: 79, icon: "📣", trend: "+6%", salary: "28-50k" },
];

const QUICK_TOOLS = [
  { icon: "💬", label: "Coach AI", desc: "Chatta con il tuo coach", color: "#A8D5BA", textColor: "#003a1a" },
  { icon: "🎤", label: "Colloquio", desc: "Simula un'intervista", color: "#002855", textColor: "#D4AF37" },
  { icon: "📊", label: "Skills Gap", desc: "Analizza le tue lacune", color: "#D4AF37", textColor: "#001229" },
  { icon: "🗺️", label: "Roadmap", desc: "Il tuo piano d'azione", color: "#002855", textColor: "#A8D5BA" },
];

const OBJECTIVES = [
  { label: "Completa il profilo LinkedIn", done: true, priority: "media" },
  { label: "Studia Python base (2h/sett)", done: false, priority: "alta" },
  { label: "Partecipa a 1 hackathon", done: false, priority: "alta" },
  { label: "Aggiorna il CV con skill AI", done: true, priority: "bassa" },
];

export function DashboardNew() {
  const [activeNav, setActiveNav] = useState("Home");

  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, sans-serif",
      background: "#F0F4F8",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
    }}>

      {/* Top bar */}
      <div style={{
        background: "#002855",
        height: "56px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "28px", height: "28px", borderRadius: "50%",
            background: "linear-gradient(135deg, #D4AF37, #f0cc5a)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "14px",
          }}>✦</div>
          <span style={{ color: "#D4AF37", fontWeight: 800, fontSize: "15px", letterSpacing: "0.06em" }}>NORTHSTAR</span>
        </div>

        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <div style={{
            background: "rgba(168,213,186,0.2)", border: "1px solid rgba(168,213,186,0.4)",
            borderRadius: "100px", padding: "4px 14px",
          }}>
            <span style={{ color: "#A8D5BA", fontSize: "12px", fontWeight: 600 }}>📈 Career Climber</span>
          </div>
          <div style={{
            width: "32px", height: "32px", borderRadius: "50%",
            background: "linear-gradient(135deg, #A8D5BA, #7fc4a0)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#002855", fontWeight: 700, fontSize: "13px",
          }}>MR</div>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar */}
        <aside style={{
          width: "220px",
          background: "#002855",
          flexShrink: 0,
          padding: "24px 12px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}>
          {/* User section */}
          <div style={{
            background: "rgba(255,255,255,0.07)",
            borderRadius: "14px", padding: "16px",
            marginBottom: "20px", textAlign: "center",
          }}>
            <div style={{
              width: "48px", height: "48px", borderRadius: "50%",
              background: "linear-gradient(135deg, #D4AF37, #f0cc5a)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#001229", fontWeight: 800, fontSize: "18px",
              margin: "0 auto 10px",
            }}>MR</div>
            <div style={{ color: "#ffffff", fontWeight: 700, fontSize: "14px" }}>Marco Rossi</div>
            <div style={{ color: "#6a9bb5", fontSize: "12px", marginTop: "4px" }}>Percorso: Dipendente</div>
            <div style={{
              marginTop: "12px",
              background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.3)",
              borderRadius: "8px", padding: "8px",
            }}>
              <div style={{ color: "#D4AF37", fontSize: "11px", fontWeight: 600, marginBottom: "6px" }}>Streak 🔥 7 giorni</div>
              <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: "100px", height: "4px" }}>
                <div style={{ background: "linear-gradient(90deg, #D4AF37, #f0cc5a)", width: "65%", height: "100%", borderRadius: "100px" }} />
              </div>
            </div>
          </div>

          {SIDEBAR_ITEMS.map((item) => (
            <button
              key={item.label}
              onClick={() => setActiveNav(item.label)}
              style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "10px 14px", borderRadius: "10px",
                background: item.active ? "rgba(212,175,55,0.15)" : "transparent",
                border: item.active ? "1px solid rgba(212,175,55,0.3)" : "1px solid transparent",
                color: item.active ? "#D4AF37" : "#7a9bb5",
                cursor: "pointer", fontSize: "13px", fontWeight: item.active ? 600 : 400,
                textAlign: "left", width: "100%",
                transition: "all 0.15s",
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}

          <div style={{ flex: 1 }} />

          {/* Premium upgrade */}
          <div style={{
            background: "linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05))",
            border: "1px solid rgba(212,175,55,0.3)",
            borderRadius: "14px", padding: "16px", marginTop: "16px",
          }}>
            <div style={{ color: "#D4AF37", fontWeight: 700, fontSize: "13px", marginBottom: "6px" }}>✦ Upgrade Premium</div>
            <div style={{ color: "#6a9bb5", fontSize: "11px", lineHeight: 1.5, marginBottom: "12px" }}>
              Sblocca Coach AI, Simulatore Colloquio e Roadmap illimitata
            </div>
            <button style={{
              width: "100%", background: "linear-gradient(135deg, #D4AF37, #f0cc5a)",
              border: "none", color: "#001229", borderRadius: "8px",
              padding: "8px", fontSize: "12px", fontWeight: 700, cursor: "pointer",
            }}>Da €19/mese</button>
          </div>
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, padding: "28px", overflowY: "auto" }}>
          {/* Welcome */}
          <div style={{ marginBottom: "28px" }}>
            <h1 style={{ color: "#002855", fontSize: "24px", fontWeight: 800, margin: "0 0 6px" }}>
              Buongiorno, Marco 👋
            </h1>
            <p style={{ color: "#6b7280", fontSize: "14px", margin: 0 }}>
              Sei nel percorso <strong style={{ color: "#002855" }}>Dipendente → Crescita</strong>. Continua a costruire il tuo futuro.
            </p>
          </div>

          {/* Top sectors */}
          <div style={{ marginBottom: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h2 style={{ color: "#002855", fontSize: "16px", fontWeight: 700, margin: 0 }}>I tuoi settori top</h2>
              <span style={{ color: "#D4AF37", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>Vedi tutti →</span>
            </div>
            <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
              {TOP_SECTORS.map((s, i) => (
                <div key={s.name} style={{
                  flex: "1 1 200px",
                  background: i === 0 ? "linear-gradient(135deg, #002855, #003d7a)" : "#ffffff",
                  borderRadius: "16px",
                  padding: "20px",
                  border: i === 0 ? "none" : "1px solid #E5E7EB",
                  position: "relative",
                  overflow: "hidden",
                }}>
                  {i === 0 && (
                    <div style={{
                      position: "absolute", top: "12px", right: "12px",
                      background: "rgba(212,175,55,0.2)", border: "1px solid rgba(212,175,55,0.4)",
                      borderRadius: "6px", padding: "3px 8px",
                      color: "#D4AF37", fontSize: "10px", fontWeight: 700,
                    }}>TOP MATCH</div>
                  )}
                  <div style={{ fontSize: "28px", marginBottom: "10px" }}>{s.icon}</div>
                  <div style={{
                    color: i === 0 ? "#ffffff" : "#002855",
                    fontWeight: 700, fontSize: "15px", marginBottom: "6px",
                  }}>{s.name}</div>
                  <div style={{
                    display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px",
                  }}>
                    <span style={{
                      background: i === 0 ? "rgba(168,213,186,0.2)" : "#A8D5BA22",
                      color: i === 0 ? "#A8D5BA" : "#2d7a52",
                      borderRadius: "100px", padding: "2px 10px",
                      fontSize: "12px", fontWeight: 600,
                    }}>{s.match}% match</span>
                    <span style={{ color: i === 0 ? "#6a9bb5" : "#9ca3af", fontSize: "12px" }}>{s.trend}</span>
                  </div>
                  {/* Progress bar */}
                  <div style={{ background: i === 0 ? "rgba(255,255,255,0.1)" : "#E5E7EB", borderRadius: "100px", height: "5px" }}>
                    <div style={{
                      background: i === 0 ? "linear-gradient(90deg, #D4AF37, #f0cc5a)" : "linear-gradient(90deg, #A8D5BA, #7fc4a0)",
                      width: `${s.match}%`, height: "100%", borderRadius: "100px",
                    }} />
                  </div>
                  <div style={{ color: i === 0 ? "#6a9bb5" : "#9ca3af", fontSize: "12px", marginTop: "8px" }}>
                    Stipendio: {s.salary}€
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
            {/* Quick tools */}
            <div style={{ flex: "2 1 400px" }}>
              <h2 style={{ color: "#002855", fontSize: "16px", fontWeight: 700, margin: "0 0 14px" }}>Strumenti rapidi</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                {QUICK_TOOLS.map((t) => (
                  <button key={t.label} style={{
                    background: t.color,
                    borderRadius: "14px", padding: "20px",
                    border: "none", cursor: "pointer",
                    textAlign: "left",
                  }}>
                    <div style={{ fontSize: "28px", marginBottom: "10px" }}>{t.icon}</div>
                    <div style={{ color: t.textColor, fontWeight: 700, fontSize: "14px", marginBottom: "4px" }}>{t.label}</div>
                    <div style={{ color: t.textColor, fontSize: "12px", opacity: 0.75 }}>{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Objectives */}
            <div style={{ flex: "1 1 260px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <h2 style={{ color: "#002855", fontSize: "16px", fontWeight: 700, margin: 0 }}>Obiettivi</h2>
                <span style={{ color: "#A8D5BA", fontSize: "12px", fontWeight: 600, background: "#A8D5BA22", padding: "3px 10px", borderRadius: "100px" }}>
                  2/4 ✓
                </span>
              </div>
              <div style={{ background: "#ffffff", borderRadius: "16px", border: "1px solid #E5E7EB", overflow: "hidden" }}>
                {OBJECTIVES.map((obj, i) => (
                  <div key={obj.label} style={{
                    padding: "14px 16px",
                    borderBottom: i < OBJECTIVES.length - 1 ? "1px solid #E5E7EB" : "none",
                    display: "flex", alignItems: "center", gap: "12px",
                    opacity: obj.done ? 0.6 : 1,
                  }}>
                    <div style={{
                      width: "20px", height: "20px", borderRadius: "50%",
                      background: obj.done ? "#A8D5BA" : "transparent",
                      border: obj.done ? "none" : "2px solid #D1D5DB",
                      flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "11px", color: "#002855",
                    }}>{obj.done ? "✓" : ""}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        color: "#002855", fontSize: "13px", fontWeight: 500,
                        textDecoration: obj.done ? "line-through" : "none",
                      }}>{obj.label}</div>
                    </div>
                    <div style={{
                      background: obj.priority === "alta" ? "#fef2f2" : obj.priority === "media" ? "#fffbeb" : "#f0fdf4",
                      color: obj.priority === "alta" ? "#ef4444" : obj.priority === "media" ? "#D4AF37" : "#2d7a52",
                      borderRadius: "6px", padding: "2px 8px",
                      fontSize: "10px", fontWeight: 700, textTransform: "uppercase",
                    }}>{obj.priority}</div>
                  </div>
                ))}
              </div>

              {/* Progress */}
              <div style={{
                background: "#002855", borderRadius: "14px",
                padding: "16px", marginTop: "12px",
              }}>
                <div style={{ color: "#93b8d8", fontSize: "12px", marginBottom: "8px" }}>Completamento profilo</div>
                <div style={{ color: "#ffffff", fontSize: "22px", fontWeight: 800, marginBottom: "10px" }}>68%</div>
                <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: "100px", height: "6px" }}>
                  <div style={{
                    background: "linear-gradient(90deg, #A8D5BA, #D4AF37)",
                    width: "68%", height: "100%", borderRadius: "100px",
                  }} />
                </div>
                <div style={{ color: "#6a9bb5", fontSize: "11px", marginTop: "8px" }}>
                  Aggiungi esperienze per sbloccare raccomandazioni personalizzate
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
