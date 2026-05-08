/**
 * Template "Minimal" — 1 colonna, bianco/grigio, moderno e pulito
 */
import React from "react";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";

Font.registerHyphenationCallback((w) => [w]);

const C = {
  text:    "#111827",
  muted:   "#6b7280",
  accent:  "#374151",
  border:  "#e5e7eb",
  bg:      "#f9fafb",
  white:   "#ffffff",
  tag:     "#f3f4f6",
  tagText: "#374151",
};

const s = StyleSheet.create({
  page: { backgroundColor: C.white, fontFamily: "Helvetica", fontSize: 9, paddingHorizontal: 48, paddingVertical: 44 },

  header: { marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1.5, borderBottomColor: C.text },
  name: { fontSize: 22, fontFamily: "Helvetica-Bold", color: C.text, letterSpacing: 0.5, marginBottom: 3 },
  titleLine: { fontSize: 10.5, color: C.muted, fontFamily: "Helvetica-Oblique", marginBottom: 10 },
  contactRow: { flexDirection: "row", flexWrap: "wrap", gap: 0 },
  contactChip: { fontSize: 7.5, color: C.muted, marginRight: 16, marginBottom: 2 },
  contactSep:  { fontSize: 7.5, color: C.border, marginRight: 16 },

  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 7.5, fontFamily: "Helvetica-Bold", color: C.muted,
    textTransform: "uppercase", letterSpacing: 1.2,
    marginBottom: 8,
  },

  summary: { fontSize: 9, color: C.accent, lineHeight: 1.6 },

  expBlock: { marginBottom: 10 },
  expRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 1 },
  expTitle: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: C.text },
  expPeriod: { fontSize: 8, color: C.muted, fontFamily: "Helvetica-Oblique" },
  expCompany: { fontSize: 8.5, color: C.muted, marginBottom: 4 },
  bullet: { flexDirection: "row", marginBottom: 2 },
  bulletDot: { color: C.muted, marginRight: 5, fontSize: 8 },
  bulletText: { fontSize: 8.5, color: C.accent, flex: 1, lineHeight: 1.5 },
  expDesc: { fontSize: 8.5, color: C.accent, lineHeight: 1.5 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  tag: { backgroundColor: C.tag, color: C.tagText, fontSize: 7, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, marginRight: 4, marginBottom: 3 },

  eduBlock: { marginBottom: 8 },
  eduRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 1 },
  eduDegree: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: C.text },
  eduYear: { fontSize: 8, color: C.muted, fontFamily: "Helvetica-Oblique" },
  eduInstitution: { fontSize: 8.5, color: C.muted },
  eduDesc: { fontSize: 8, color: C.muted, marginTop: 2 },

  twoCol: { flexDirection: "row", gap: 32 },
  col: { flex: 1 },

  skillsRow: { flexDirection: "row", flexWrap: "wrap" },
  skillTag: { fontSize: 8, color: C.tagText, marginBottom: 3, marginRight: 14 },

  langRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  langName: { fontSize: 8.5, color: C.text },
  langLevel: { fontSize: 7.5, color: C.muted, fontFamily: "Helvetica-Oblique" },

  footer: { position: "absolute", bottom: 16, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7, color: C.border },
  footerBrand: { fontSize: 7, color: C.muted, fontFamily: "Helvetica-Oblique" },
});

interface GeneratedCv {
  personalInfo: { name: string; title?: string; email?: string; phone?: string; location?: string; linkedin?: string; website?: string };
  summary?: string;
  experience: Array<{ id: string; title: string; company: string; period: string; location?: string; description: string; skills: string[] }>;
  education: Array<{ id: string; degree: string; institution: string; year: string; description?: string }>;
  skills: string[];
  tools: string[];
  languages: Array<{ language: string; level: string }>;
  certifications: string[];
}

function parseLines(desc: string) {
  return desc.split(/\n|(?=[→•])/).map((l) => l.trim()).filter(Boolean);
}

export function CvPdfMinimal({ cv }: { cv: GeneratedCv }) {
  const pi = cv.personalInfo;
  const contacts = [
    pi.email, pi.phone, pi.location, pi.linkedin, pi.website,
  ].filter(Boolean) as string[];

  return (
    <Document title={`CV – ${pi.name}`} author={pi.name} creator="NorthStar" producer="NorthStar">
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.name}>{pi.name || "Nome Cognome"}</Text>
          {pi.title && <Text style={s.titleLine}>{pi.title}</Text>}
          <View style={s.contactRow}>
            {contacts.map((c, i) => (
              <Text key={i} style={s.contactChip}>{c}{i < contacts.length - 1 ? "  ·  " : ""}</Text>
            ))}
          </View>
        </View>

        {/* Summary */}
        {cv.summary && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Profilo</Text>
            <Text style={s.summary}>{cv.summary}</Text>
          </View>
        )}

        {/* Experience */}
        {cv.experience.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Esperienza</Text>
            {cv.experience.map((exp) => {
              const lines = parseLines(exp.description);
              return (
                <View key={exp.id} style={s.expBlock}>
                  <View style={s.expRow}>
                    <Text style={s.expTitle}>{exp.title}</Text>
                    <Text style={s.expPeriod}>{exp.period}</Text>
                  </View>
                  <Text style={s.expCompany}>{exp.company}{exp.location ? `  ·  ${exp.location}` : ""}</Text>
                  {lines.map((line, i) => {
                    const isBullet = /^[→•\-]/.test(line);
                    const text = isBullet ? line.replace(/^[→•\-]\s*/, "") : line;
                    return isBullet ? (
                      <View key={i} style={s.bullet}>
                        <Text style={s.bulletDot}>–</Text>
                        <Text style={s.bulletText}>{text}</Text>
                      </View>
                    ) : (
                      <Text key={i} style={s.expDesc}>{text}</Text>
                    );
                  })}
                  {exp.skills.length > 0 && (
                    <View style={s.tagsRow}>
                      {exp.skills.map((sk, i) => <Text key={i} style={s.tag}>{sk}</Text>)}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Education */}
        {cv.education.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Formazione</Text>
            {cv.education.map((edu) => (
              <View key={edu.id} style={s.eduBlock}>
                <View style={s.eduRow}>
                  <Text style={s.eduDegree}>{edu.degree}</Text>
                  <Text style={s.eduYear}>{edu.year}</Text>
                </View>
                <Text style={s.eduInstitution}>{edu.institution}</Text>
                {edu.description && <Text style={s.eduDesc}>{edu.description}</Text>}
              </View>
            ))}
          </View>
        )}

        {/* Skills + Languages in 2 col */}
        <View style={[s.section, s.twoCol]}>
          {(cv.skills.length > 0 || cv.tools.length > 0) && (
            <View style={s.col}>
              <Text style={s.sectionTitle}>Competenze & Strumenti</Text>
              <View style={s.skillsRow}>
                {[...cv.skills, ...cv.tools].map((sk, i) => (
                  <Text key={i} style={s.skillTag}>{sk}</Text>
                ))}
              </View>
            </View>
          )}
          {(cv.languages.length > 0 || cv.certifications.length > 0) && (
            <View style={s.col}>
              {cv.languages.length > 0 && (
                <>
                  <Text style={s.sectionTitle}>Lingue</Text>
                  {cv.languages.map((l, i) => (
                    <View key={i} style={s.langRow}>
                      <Text style={s.langName}>{l.language}</Text>
                      <Text style={s.langLevel}>{l.level}</Text>
                    </View>
                  ))}
                </>
              )}
              {cv.certifications.length > 0 && (
                <>
                  <Text style={[s.sectionTitle, { marginTop: 10 }]}>Certificazioni</Text>
                  {cv.certifications.map((c, i) => (
                    <Text key={i} style={s.skillTag}>{c}</Text>
                  ))}
                </>
              )}
            </View>
          )}
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>{pi.name} – Curriculum Vitae</Text>
          <Text style={s.footerBrand}>✦ Generato con NorthStar</Text>
        </View>
      </Page>
    </Document>
  );
}
