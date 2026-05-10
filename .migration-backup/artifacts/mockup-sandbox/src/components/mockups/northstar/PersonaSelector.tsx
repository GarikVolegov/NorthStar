import { useState } from "react";

const personas = [
  {
    id: "indeciso",
    icon: "🧭",
    title: "Sto cercando la mia strada",
    subtitle: "Indeciso / Studente",
    description: "Non so ancora cosa fare della mia vita professionale. Voglio scoprire quali percorsi si adattano alla mia personalità.",
    badge: "Test RIASEC gratuito",
    badgeColor: "#A8D5BA",
    badgeText: "#003a1a",
    features: ["Test personalità RIASEC", "28 settori analizzati", "Roadmap guidata"],
    gradient: "linear-gradient(135deg, #002855 0%, #003d7a 100%)",
    accent: "#A8D5BA",
  },
  {
    id: "dipendente",
    icon: "📈",
    title: "Voglio crescere in carriera",
    subtitle: "Dipendente / Professionista",
    description: "Ho un lavoro ma voglio avanzare, cambiare ruolo o settore. Cerco strumenti concreti per fare il salto.",
    badge: "Career Climber Mode",
    badgeColor: "#D4AF37",
    badgeText: "#3a2d00",
    features: ["Analisi gap competenze", "Simulatore colloquio AI", "Coach AI personale"],
    gradient: "linear-gradient(135deg, #002855 0%, #00316b 100%)",
    accent: "#D4AF37",
  },
  {
    id: "autonomo",
    icon: "🚀",
    title: "Voglio scalare il mio business",
    subtitle: "Autonomo / Imprenditore",
    description: "Ho già un'attività o lavoro in proprio. Voglio validare idee, trovare finanziamenti e crescere più velocemente.",
    badge: "Business Validator AI",
    badgeColor: "#D4AF37",
    badgeText: "#3a2d00",
    features: ["Validatore idea AI", "Ricerca incubatori/bandi", "Knowledge Graph"],
    gradient: "linear-gradient(135deg, #002855 0%, #001f45 100%)",
    accent: "#D4AF37",
  },
  {
    id: "azienda",
    icon: "🏢",
    title: "Cerco il talento giusto",
    subtitle: "Azienda / HR",
    description: "Sono un'azienda o recruiter che vuole trovare candidati compatibili con la cultura e le esigenze del team.",
    badge: "Affiliazione Premium",
    badgeColor: "#A8D5BA",
    badgeText: "#003a1a",
    features: ["Match profili RIASEC", "Materiali affiliazione", "Dashboard HR"],
    gradient: "linear-gradient(135deg, #002855 0%, #00234f 100%)",
    accent: "#A8D5BA",
  },
  {
    id: "investitore",
    icon: "💡",
    title: "Voglio finanziare progetti",
    subtitle: "Investitore / Business Angel",
    description: "Cerco idee di business validate e team promettenti da sostenere. Voglio scoprire opportunità di investimento.",
    badge: "Deal Flow AI",
    badgeColor: "#D4AF37",
    badgeText: "#3a2d00",
    features: ["Report validazione AI", "Pitch canvas generato", "Analisi mercato"],
    gradient: "linear-gradient(135deg, #002855 0%, #001835 100%)",
    accent: "#D4AF37",
  },
];

export function PersonaSelector() {
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #001229 0%, #002855 40%, #001a3d 100%)",
        fontFamily: "'Inter', -apple-system, sans-serif",
        padding: "48px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "48px", maxWidth: "640px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "20px" }}>
          <div style={{
            width: "40px", height: "40px", borderRadius: "50%",
            background: "linear-gradient(135deg, #D4AF37, #f0cc5a)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "20px", boxShadow: "0 0 20px rgba(212,175,55,0.4)"
          }}>✦</div>
          <span style={{ color: "#D4AF37", fontWeight: 700, fontSize: "18px", letterSpacing: "0.08em" }}>NORTHSTAR</span>
        </div>
        <h1 style={{
          fontSize: "clamp(26px, 4vw, 38px)",
          fontWeight: 800,
          color: "#ffffff",
          lineHeight: 1.2,
          margin: "0 0 16px",
        }}>
          Dove sei nel tuo{" "}
          <span style={{ color: "#D4AF37" }}>percorso?</span>
        </h1>
        <p style={{ color: "#93b8d8", fontSize: "17px", lineHeight: 1.6, margin: 0 }}>
          NorthStar si adatta al tuo punto di partenza. Scegli il profilo che ti descrive meglio per un'esperienza su misura.
        </p>
      </div>

      {/* Cards grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: "16px",
        width: "100%",
        maxWidth: "1100px",
      }}>
        {personas.map((p) => {
          const isSelected = selected === p.id;
          const isHovered = hovered === p.id;
          const active = isSelected || isHovered;

          return (
            <div
              key={p.id}
              onClick={() => setSelected(p.id)}
              onMouseEnter={() => setHovered(p.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                background: active ? p.gradient : "rgba(255,255,255,0.04)",
                border: `2px solid ${isSelected ? p.accent : active ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: "20px",
                padding: "28px 24px",
                cursor: "pointer",
                transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                transform: active ? "translateY(-4px)" : "translateY(0)",
                boxShadow: isSelected
                  ? `0 12px 40px rgba(0,40,85,0.6), 0 0 0 1px ${p.accent}40`
                  : active ? "0 8px 30px rgba(0,20,50,0.5)" : "none",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Selected indicator */}
              {isSelected && (
                <div style={{
                  position: "absolute", top: "16px", right: "16px",
                  width: "24px", height: "24px", borderRadius: "50%",
                  background: p.accent, display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: "13px", fontWeight: 700,
                  color: p.badgeText,
                }}>✓</div>
              )}

              {/* Icon */}
              <div style={{
                fontSize: "36px", marginBottom: "16px",
                filter: active ? "none" : "grayscale(20%)",
                transition: "filter 0.2s",
              }}>{p.icon}</div>

              {/* Badge */}
              <div style={{
                display: "inline-flex", alignItems: "center",
                background: `${p.badgeColor}22`,
                border: `1px solid ${p.badgeColor}55`,
                borderRadius: "100px",
                padding: "4px 12px",
                marginBottom: "14px",
              }}>
                <span style={{ color: p.badgeColor, fontSize: "11px", fontWeight: 600, letterSpacing: "0.05em" }}>
                  {p.badge}
                </span>
              </div>

              {/* Title */}
              <h3 style={{
                color: "#ffffff",
                fontSize: "18px",
                fontWeight: 700,
                margin: "0 0 6px",
                lineHeight: 1.3,
              }}>{p.title}</h3>

              <p style={{
                color: "#93b8d8",
                fontSize: "13px",
                fontWeight: 500,
                margin: "0 0 14px",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}>{p.subtitle}</p>

              <p style={{
                color: active ? "#c8ddf0" : "#7a9bb5",
                fontSize: "14px",
                lineHeight: 1.6,
                margin: "0 0 20px",
                transition: "color 0.2s",
              }}>{p.description}</p>

              {/* Features */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {p.features.map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{
                      width: "6px", height: "6px", borderRadius: "50%",
                      background: p.accent, flexShrink: 0,
                    }} />
                    <span style={{ color: active ? "#dceeff" : "#7a9bb5", fontSize: "13px", transition: "color 0.2s" }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div style={{ marginTop: "40px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
        <button
          style={{
            background: selected ? "linear-gradient(135deg, #D4AF37, #f0cc5a)" : "rgba(212,175,55,0.2)",
            color: selected ? "#001229" : "#D4AF37",
            border: selected ? "none" : "1px solid #D4AF3766",
            borderRadius: "100px",
            padding: "16px 48px",
            fontSize: "16px",
            fontWeight: 700,
            cursor: selected ? "pointer" : "default",
            transition: "all 0.25s",
            letterSpacing: "0.02em",
            boxShadow: selected ? "0 8px 24px rgba(212,175,55,0.4)" : "none",
          }}
        >
          {selected
            ? `Inizia come ${personas.find((p) => p.id === selected)?.subtitle} →`
            : "Seleziona il tuo percorso"}
        </button>
        <span style={{ color: "#4a7a9b", fontSize: "13px" }}>
          Puoi cambiare profilo in qualsiasi momento
        </span>
      </div>
    </div>
  );
}
