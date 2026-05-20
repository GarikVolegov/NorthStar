import type { GeneratedCv } from "./cvTypes";

export function CvDocument({ cv }: { cv: GeneratedCv }) {
  return (
    <div
      id="cv-document"
      className="bg-white text-gray-900 shadow-2xl mx-auto"
      style={{
        width: "210mm",
        minHeight: "297mm",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "hsl(var(--growth))",
          padding: "32px 40px 28px",
          color: "hsl(var(--foreground))",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "28px",
            fontWeight: "700",
            letterSpacing: "-0.5px",
            fontFamily: "Georgia, serif",
          }}
        >
          {cv.personalInfo.name || "Nome Cognome"}
        </h1>
        {cv.personalInfo.title && (
          <p
            style={{
              margin: "6px 0 0",
              fontSize: "14px",
              color: "hsl(var(--chart-2))",
              fontWeight: "500",
            }}
          >
            {cv.personalInfo.title}
          </p>
        )}
        {cv.targetRole && cv.targetRole !== cv.personalInfo.title && (
          <p
            style={{
              margin: "4px 0 0",
              fontSize: "12px",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            Target: {cv.targetRole}
          </p>
        )}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            marginTop: "16px",
          }}
        >
          {cv.personalInfo.email && (
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>
              ? {cv.personalInfo.email}
            </span>
          )}
          {cv.personalInfo.phone && (
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>
              ? {cv.personalInfo.phone}
            </span>
          )}
          {cv.personalInfo.location && (
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>
              ? {cv.personalInfo.location}
            </span>
          )}
          {cv.personalInfo.linkedin && (
            <span style={{ fontSize: "12px", color: "hsl(var(--chart-2))" }}>
              in{" "}
              {cv.personalInfo.linkedin.replace(
                /https?:\/\/(www\.)?linkedin\.com\/in\//,
                "",
              )}
            </span>
          )}
          {cv.personalInfo.website && (
            <span style={{ fontSize: "12px", color: "hsl(var(--chart-2))" }}>
              ? {cv.personalInfo.website}
            </span>
          )}
        </div>
      </div>

      {/* Two-column body */}
      <div style={{ display: "flex" }}>
        {/* Left column */}
        <div
          style={{
            width: "38%",
            background: "hsl(var(--card))",
            borderRight: "1px solid hsl(var(--border))",
            padding: "28px 24px",
            flexShrink: 0,
          }}
        >
          {cv.skills.length > 0 && (
            <CvSection title="Competenze">
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {cv.skills.map((s) => (
                  <span
                    key={s}
                    style={{
                      fontSize: "11px",
                      background: "hsl(var(--chart-2) / 0.15)",
                      color: "hsl(var(--chart-2))",
                      border: "1px solid hsl(var(--chart-2) / 0.3)",
                      borderRadius: "999px",
                      padding: "3px 10px",
                      fontWeight: "500",
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </CvSection>
          )}
          {cv.tools.length > 0 && (
            <CvSection title="Strumenti">
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {cv.tools.map((t) => (
                  <span
                    key={t}
                    style={{
                      fontSize: "11px",
                      background: "hsl(var(--primary) / 0.1)",
                      color: "hsl(var(--primary))",
                      border: "1px solid hsl(var(--primary) / 0.3)",
                      borderRadius: "999px",
                      padding: "3px 10px",
                      fontWeight: "500",
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </CvSection>
          )}
          {cv.languages.length > 0 && (
            <CvSection title="Lingue">
              {cv.languages.map((l) => (
                <div
                  key={l.language}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "6px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "hsl(var(--foreground))",
                    }}
                  >
                    {l.language}
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "hsl(var(--muted-foreground))",
                      background: "hsl(var(--muted))",
                      borderRadius: "999px",
                      padding: "2px 8px",
                    }}
                  >
                    {l.level}
                  </span>
                </div>
              ))}
            </CvSection>
          )}
          {cv.certifications.length > 0 && (
            <CvSection title="Certificazioni">
              {cv.certifications.map((c) => (
                <div
                  key={c}
                  style={{ display: "flex", gap: "8px", marginBottom: "6px" }}
                >
                  <span
                    style={{ color: "hsl(var(--growth))", fontSize: "14px" }}
                  >
                    ?
                  </span>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "hsl(var(--foreground))",
                      lineHeight: "1.5",
                    }}
                  >
                    {c}
                  </span>
                </div>
              ))}
            </CvSection>
          )}
          <div
            style={{
              padding: "12px",
              background: "hsl(var(--chart-2) / 0.1)",
              border: "1px solid hsl(var(--chart-2) / 0.3)",
              borderRadius: "10px",
              marginTop: "24px",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "10px",
                color: "hsl(var(--chart-2))",
                textAlign: "center",
                fontWeight: "500",
              }}
            >
              ? Generato con NorthStar
            </p>
          </div>
        </div>

        {/* Right column */}
        <div style={{ flex: 1, padding: "28px 32px" }}>
          {cv.summary && (
            <CvSection title="Profilo Professionale">
              <p
                style={{
                  fontSize: "13px",
                  color: "hsl(var(--muted-foreground))",
                  lineHeight: "1.7",
                  margin: 0,
                }}
              >
                {cv.summary}
              </p>
            </CvSection>
          )}
          {cv.experience.length > 0 && (
            <CvSection title="Esperienza Professionale">
              {cv.experience.map((e) => (
                <div key={e.id} style={{ marginBottom: "18px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "4px",
                    }}
                  >
                    <div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "14px",
                          fontWeight: "700",
                          color: "hsl(var(--foreground))",
                        }}
                      >
                        {e.title}
                      </p>
                      <p
                        style={{
                          margin: "2px 0 0",
                          fontSize: "12px",
                          color: "hsl(var(--muted-foreground))",
                        }}
                      >
                        {e.company}
                        {e.location ? ` ? ${e.location}` : ""}
                      </p>
                    </div>
                    <span
                      style={{
                        fontSize: "11px",
                        color: "hsl(var(--muted-foreground))",
                        background: "hsl(var(--muted))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "999px",
                        padding: "2px 10px",
                        flexShrink: 0,
                      }}
                    >
                      {e.period}
                    </span>
                  </div>
                  {e.description && (
                    <div
                      style={{
                        fontSize: "12px",
                        color: "hsl(var(--muted-foreground))",
                        lineHeight: "1.7",
                        marginTop: "6px",
                      }}
                    >
                      {e.description.split("\n").map((line, i) => (
                        <p key={i} style={{ margin: "3px 0" }}>
                          {line.startsWith("?") ? (
                            <>
                              <span style={{ color: "hsl(var(--growth))" }}>
                                ?
                              </span>{" "}
                              {line.slice(1).trim()}
                            </>
                          ) : (
                            line
                          )}
                        </p>
                      ))}
                    </div>
                  )}
                  {e.skills.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "4px",
                        marginTop: "8px",
                      }}
                    >
                      {e.skills.map((s) => (
                        <span
                          key={s}
                          style={{
                            fontSize: "10px",
                            background: "hsl(var(--muted))",
                            color: "hsl(var(--muted-foreground))",
                            borderRadius: "999px",
                            padding: "2px 8px",
                          }}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CvSection>
          )}
          {cv.education.length > 0 && (
            <CvSection title="Formazione">
              {cv.education.map((e) => (
                <div
                  key={e.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "12px",
                  }}
                >
                  <div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "13px",
                        fontWeight: "700",
                        color: "hsl(var(--foreground))",
                      }}
                    >
                      {e.degree}
                    </p>
                    <p
                      style={{
                        margin: "2px 0 0",
                        fontSize: "12px",
                        color: "hsl(var(--muted-foreground))",
                      }}
                    >
                      {e.institution}
                    </p>
                    {e.description && (
                      <p
                        style={{
                          margin: "3px 0 0",
                          fontSize: "11px",
                          color: "hsl(var(--muted-foreground))",
                        }}
                      >
                        {e.description}
                      </p>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "hsl(var(--muted-foreground))",
                      background: "hsl(var(--muted))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "999px",
                      padding: "2px 10px",
                      flexShrink: 0,
                    }}
                  >
                    {e.year}
                  </span>
                </div>
              ))}
            </CvSection>
          )}
        </div>
      </div>
    </div>
  );
}

function CvSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "24px" }}>
      <h3
        style={{
          fontSize: "11px",
          fontWeight: "700",
          letterSpacing: "1.5px",
          textTransform: "uppercase",
          color: "hsl(var(--growth))",
          marginBottom: "10px",
          borderBottom: "2px solid hsl(var(--growth))",
          paddingBottom: "6px",
          margin: "0 0 10px 0",
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}
