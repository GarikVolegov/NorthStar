import React from "react";
import {
  Document, Page, Text, View, StyleSheet, Font,
} from "@react-pdf/renderer";

Font.registerHyphenationCallback((word) => [word]);

const DARK = "#1a2e1a";
const ACCENT = "#2d5a2d";
const LIGHT_BG = "#f5f7f5";
const WHITE = "#ffffff";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";

const s = StyleSheet.create({
  page: { flexDirection: "row", backgroundColor: WHITE, fontFamily: "Helvetica", fontSize: 9 },

  left: { width: 185, backgroundColor: DARK, color: WHITE, padding: 20, flexShrink: 0 },
  right: { flex: 1, padding: 24, backgroundColor: WHITE },

  name: { fontSize: 18, fontFamily: "Helvetica-Bold", color: WHITE, marginBottom: 3, lineHeight: 1.2 },
  title: { fontSize: 10, color: "#a3c4a3", marginBottom: 16, fontFamily: "Helvetica-Oblique" },

  leftSection: { marginBottom: 14 },
  leftSectionTitle: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#a3c4a3", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, borderBottomWidth: 0.5, borderBottomColor: "#3a5a3a", paddingBottom: 3 },
  leftItem: { fontSize: 8.5, color: "#d1e8d1", marginBottom: 3, lineHeight: 1.4 },
  leftMuted: { fontSize: 7.5, color: "#7da87d", marginBottom: 2, lineHeight: 1.3 },

  contactRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 4, gap: 4 },
  contactLabel: { fontSize: 7, color: "#7da87d", fontFamily: "Helvetica-Bold", textTransform: "uppercase", width: 40 },
  contactVal: { fontSize: 8, color: "#d1e8d1", flex: 1, lineHeight: 1.35 },

  tag: { backgroundColor: "#2d5a2d", color: "#a3c4a3", fontSize: 7.5, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, marginRight: 4, marginBottom: 4 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap" },

  langRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  langName: { fontSize: 8.5, color: "#d1e8d1" },
  langLevel: { fontSize: 7.5, color: "#7da87d", fontFamily: "Helvetica-Oblique" },

  rightSection: { marginBottom: 18 },
  rightSectionTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: ACCENT, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: BORDER },

  summary: { fontSize: 9, color: "#374151", lineHeight: 1.55, marginBottom: 2 },

  expBlock: { marginBottom: 10 },
  expHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 1.5 },
  expTitle: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: "#111827" },
  expPeriod: { fontSize: 8, color: MUTED, fontFamily: "Helvetica-Oblique" },
  expCompany: { fontSize: 8.5, color: ACCENT, marginBottom: 3 },
  expDesc: { fontSize: 8.5, color: "#4b5563", lineHeight: 1.5 },

  bullet: { flexDirection: "row", marginBottom: 2 },
  bulletDot: { color: ACCENT, marginRight: 4, fontSize: 8.5 },
  bulletText: { fontSize: 8.5, color: "#4b5563", flex: 1, lineHeight: 1.45 },

  expSkills: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  expSkillTag: { backgroundColor: LIGHT_BG, color: ACCENT, fontSize: 7, paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 3, marginRight: 3, marginBottom: 3, borderWidth: 0.5, borderColor: BORDER },

  eduBlock: { marginBottom: 8 },
  eduDegree: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: "#111827", marginBottom: 1 },
  eduInstitution: { fontSize: 8.5, color: ACCENT },
  eduYear: { fontSize: 8, color: MUTED, fontFamily: "Helvetica-Oblique" },
  eduDesc: { fontSize: 8, color: MUTED, marginTop: 1.5 },

  certItem: { fontSize: 8.5, color: "#d1e8d1", marginBottom: 3 },

  footer: { position: "absolute", bottom: 14, left: 24, right: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerText: { fontSize: 7, color: "#9ca3af" },
  footerBrand: { fontSize: 7, color: "#7da87d", fontFamily: "Helvetica-Oblique" },
});

interface GeneratedCv {
  personalInfo: {
    name: string; title?: string; email?: string; phone?: string;
    location?: string; linkedin?: string; website?: string;
  };
  summary?: string;
  experience: Array<{
    id: string; title: string; company: string; period: string;
    location?: string; description: string; skills: string[];
  }>;
  education: Array<{
    id: string; degree: string; institution: string; year: string; description?: string;
  }>;
  skills: string[];
  tools: string[];
  languages: Array<{ language: string; level: string }>;
  certifications: string[];
  targetRole?: string;
}

function parseDescriptionLines(desc: string) {
  return desc.split(/\n|(?=→)/).map((l) => l.trim()).filter(Boolean);
}

export function CvPdfDocument({ cv }: { cv: GeneratedCv }) {
  const pi = cv.personalInfo;

  return (
    <Document
      title={`CV – ${pi.name}`}
      author={pi.name}
      creator="NorthStar"
      producer="NorthStar"
    >
      <Page size="A4" style={s.page}>
        {/* ── Left column ── */}
        <View style={s.left}>
          <Text style={s.name}>{pi.name || "Nome Cognome"}</Text>
          {pi.title && <Text style={s.title}>{pi.title}</Text>}

          {/* Contact */}
          <View style={s.leftSection}>
            <Text style={s.leftSectionTitle}>Contatti</Text>
            {pi.email && (
              <View style={s.contactRow}>
                <Text style={s.contactLabel}>Email</Text>
                <Text style={s.contactVal}>{pi.email}</Text>
              </View>
            )}
            {pi.phone && (
              <View style={s.contactRow}>
                <Text style={s.contactLabel}>Tel</Text>
                <Text style={s.contactVal}>{pi.phone}</Text>
              </View>
            )}
            {pi.location && (
              <View style={s.contactRow}>
                <Text style={s.contactLabel}>Sede</Text>
                <Text style={s.contactVal}>{pi.location}</Text>
              </View>
            )}
            {pi.linkedin && (
              <View style={s.contactRow}>
                <Text style={s.contactLabel}>LinkedIn</Text>
                <Text style={s.contactVal}>{pi.linkedin}</Text>
              </View>
            )}
            {pi.website && (
              <View style={s.contactRow}>
                <Text style={s.contactLabel}>Web</Text>
                <Text style={s.contactVal}>{pi.website}</Text>
              </View>
            )}
          </View>

          {/* Skills */}
          {cv.skills.length > 0 && (
            <View style={s.leftSection}>
              <Text style={s.leftSectionTitle}>Competenze</Text>
              <View style={s.tagsRow}>
                {cv.skills.map((sk, i) => (
                  <Text key={i} style={s.tag}>{sk}</Text>
                ))}
              </View>
            </View>
          )}

          {/* Tools */}
          {cv.tools.length > 0 && (
            <View style={s.leftSection}>
              <Text style={s.leftSectionTitle}>Strumenti</Text>
              <View style={s.tagsRow}>
                {cv.tools.map((t, i) => (
                  <Text key={i} style={s.tag}>{t}</Text>
                ))}
              </View>
            </View>
          )}

          {/* Languages */}
          {cv.languages.length > 0 && (
            <View style={s.leftSection}>
              <Text style={s.leftSectionTitle}>Lingue</Text>
              {cv.languages.map((l, i) => (
                <View key={i} style={s.langRow}>
                  <Text style={s.langName}>{l.language}</Text>
                  <Text style={s.langLevel}>{l.level}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Certifications */}
          {cv.certifications.length > 0 && (
            <View style={s.leftSection}>
              <Text style={s.leftSectionTitle}>Certificazioni</Text>
              {cv.certifications.map((c, i) => (
                <Text key={i} style={s.certItem}>▸ {c}</Text>
              ))}
            </View>
          )}
        </View>

        {/* ── Right column ── */}
        <View style={s.right}>
          {/* Summary */}
          {cv.summary && (
            <View style={s.rightSection}>
              <Text style={s.rightSectionTitle}>Profilo</Text>
              <Text style={s.summary}>{cv.summary}</Text>
            </View>
          )}

          {/* Experience */}
          {cv.experience.length > 0 && (
            <View style={s.rightSection}>
              <Text style={s.rightSectionTitle}>Esperienza</Text>
              {cv.experience.map((exp) => {
                const lines = parseDescriptionLines(exp.description);
                return (
                  <View key={exp.id} style={s.expBlock}>
                    <View style={s.expHeader}>
                      <Text style={s.expTitle}>{exp.title}</Text>
                      <Text style={s.expPeriod}>{exp.period}</Text>
                    </View>
                    <Text style={s.expCompany}>
                      {exp.company}{exp.location ? `  ·  ${exp.location}` : ""}
                    </Text>
                    {lines.map((line, i) => {
                      const isBullet = line.startsWith("→") || line.startsWith("•") || line.startsWith("-");
                      const text = isBullet ? line.replace(/^[→•\-]\s*/, "") : line;
                      return isBullet ? (
                        <View key={i} style={s.bullet}>
                          <Text style={s.bulletDot}>→</Text>
                          <Text style={s.bulletText}>{text}</Text>
                        </View>
                      ) : (
                        <Text key={i} style={s.expDesc}>{text}</Text>
                      );
                    })}
                    {exp.skills.length > 0 && (
                      <View style={s.expSkills}>
                        {exp.skills.map((sk, i) => (
                          <Text key={i} style={s.expSkillTag}>{sk}</Text>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Education */}
          {cv.education.length > 0 && (
            <View style={s.rightSection}>
              <Text style={s.rightSectionTitle}>Formazione</Text>
              {cv.education.map((edu) => (
                <View key={edu.id} style={s.eduBlock}>
                  <Text style={s.eduDegree}>{edu.degree}</Text>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                    <Text style={s.eduInstitution}>{edu.institution}</Text>
                    <Text style={s.eduYear}>{edu.year}</Text>
                  </View>
                  {edu.description && <Text style={s.eduDesc}>{edu.description}</Text>}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{pi.name} – Curriculum Vitae</Text>
          <Text style={s.footerBrand}>✦ Generato con NorthStar</Text>
        </View>
      </Page>
    </Document>
  );
}
