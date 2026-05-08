/**
 * Template "Bold" — Header navy full-width, accento arancio, massimo impatto visivo
 */
import React from "react";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";

Font.registerHyphenationCallback((w) => [w]);

const C = {
  navy:    "#0f172a",
  orange:  "#f97316",
  orangeL: "#fff7ed",
  orangeD: "#c2410c",
  white:   "#ffffff",
  text:    "#1e293b",
  muted:   "#64748b",
  border:  "#e2e8f0",
  bg:      "#f8fafc",
};

const s = StyleSheet.create({
  page: { backgroundColor: C.white, fontFamily: "Helvetica", fontSize: 9 },

  header: {
    backgroundColor: C.navy, paddingHorizontal: 40, paddingTop: 30, paddingBottom: 24,
  },
  headerName: { fontSize: 24, fontFamily: "Helvetica-Bold", color: C.white, letterSpacing: 0.3, marginBottom: 4 },
  headerTitle: { fontSize: 11, color: C.orange, fontFamily: "Helvetica-Oblique", marginBottom: 14 },
  headerContacts: { flexDirection: "row", flexWrap: "wrap", gap: 0 },
  headerContact: { fontSize: 7.5, color: "#94a3b8", marginRight: 18, marginBottom: 2 },

  accentBar: { backgroundColor: C.orange, height: 3 },

  body: { paddingHorizontal: 40, paddingVertical: 28, flexDirection: "row", gap: 28 },
  mainCol: { flex: 2.2 },
  sideCol: { flex: 1 },

  section: { marginBottom: 18 },
  sectionTitle: {
    fontSize: 8, fontFamily: "Helvetica-Bold", color: C.orange,
    textTransform: "uppercase", letterSpacing: 1,
    marginBottom: 8, paddingBottom: 3,
    borderBottomWidth: 1.5, borderBottomColor: C.orange,
  },

  summary: { fontSize: 9, color: C.text, lineHeight: 1.6 },

  expBlock: { marginBottom: 11 },
  expRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 1.5 },
  expTitle: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: C.text },
  expPeriod: {
    fontSize: 7.5, color: C.white, backgroundColor: C.navy,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3,
  },
  expCompany: { fontSize: 8.5, color: C.muted, marginBottom: 4 },
  bullet: { flexDirection: "row", marginBottom: 2.5 },
  bulletDot: { color: C.orange, marginRight: 5, fontSize: 9, fontFamily: "Helvetica-Bold" },
  bulletText: { fontSize: 8.5, color: C.text, flex: 1, lineHeight: 1.5 },
  expDesc: { fontSize: 8.5, color: C.text, lineHeight: 1.5 },
  skillsRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  skillTag: {
    backgroundColor: C.orangeL, color: C.orangeD,
    fontSize: 7, paddingHorizontal: 5, paddingVertical: 2,
    borderRadius: 3, marginRight: 3, marginBottom: 3,
  },

  sideSection: { marginBottom: 16 },
  sideSectionTitle: {
    fontSize: 7.5, fontFamily: "Helvetica-Bold", color: C.navy,
    textTransform: "uppercase", letterSpacing: 0.8,
    marginBottom: 6, paddingBottom: 3,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  sideTag: {
    backgroundColor: C.bg, color: C.text,
    fontSize: 8, paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 4, marginBottom: 4, borderWidth: 0.5, borderColor: C.border,
    display: "flex",
  },
  langRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4, alignItems: "center" },
  langName: { fontSize: 8.5, color: C.text },
  langBadge: {
    fontSize: 7, color: C.navy, backgroundColor: C.border,
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3,
  },

  eduBlock: { marginBottom: 9 },
  eduDegree: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.text, marginBottom: 1 },
  eduInst: { fontSize: 8, color: C.muted, marginBottom: 1 },
  eduYear: { fontSize: 7.5, color: C.orange, fontFamily: "Helvetica-Oblique" },

  footer: { position: "absolute", bottom: 14, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 6.5, color: "#cbd5e1" },
  footerBrand: { fontSize: 6.5, color: C.orange, fontFamily: "Helvetica-Oblique" },
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

export function CvPdfBold({ cv }: { cv: GeneratedCv }) {
  const pi = cv.personalInfo;
  const contacts = [pi.email, pi.phone, pi.location, pi.linkedin, pi.website].filter(Boolean) as string[];

  return (
    <Document title={`CV – ${pi.name}`} author={pi.name} creator="NorthStar" producer="NorthStar">
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerName}>{pi.name || "Nome Cognome"}</Text>
          {pi.title && <Text style={s.headerTitle}>{pi.title}</Text>}
          <View style={s.headerContacts}>
            {contacts.map((c, i) => <Text key={i} style={s.headerContact}>{c}{i < contacts.length - 1 ? "  ·  " : ""}</Text>)}
          </View>
        </View>
        <View style={s.accentBar} />

        {/* Body 2-col */}
        <View style={s.body}>

          {/* Main column */}
          <View style={s.mainCol}>

            {cv.summary && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Profilo</Text>
                <Text style={s.summary}>{cv.summary}</Text>
              </View>
            )}

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
                            <Text style={s.bulletDot}>▸</Text>
                            <Text style={s.bulletText}>{text}</Text>
                          </View>
                        ) : (
                          <Text key={i} style={s.expDesc}>{text}</Text>
                        );
                      })}
                      {exp.skills.length > 0 && (
                        <View style={s.skillsRow}>
                          {exp.skills.map((sk, i) => <Text key={i} style={s.skillTag}>{sk}</Text>)}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {cv.education.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Formazione</Text>
                {cv.education.map((edu) => (
                  <View key={edu.id} style={s.eduBlock}>
                    <Text style={s.eduDegree}>{edu.degree}</Text>
                    <Text style={s.eduInst}>{edu.institution}</Text>
                    <Text style={s.eduYear}>{edu.year}</Text>
                  </View>
                ))}
              </View>
            )}

          </View>

          {/* Side column */}
          <View style={s.sideCol}>

            {cv.skills.length > 0 && (
              <View style={s.sideSection}>
                <Text style={s.sideSectionTitle}>Competenze</Text>
                {cv.skills.map((sk, i) => <Text key={i} style={s.sideTag}>{sk}</Text>)}
              </View>
            )}

            {cv.tools.length > 0 && (
              <View style={s.sideSection}>
                <Text style={s.sideSectionTitle}>Strumenti</Text>
                {cv.tools.map((t, i) => <Text key={i} style={s.sideTag}>{t}</Text>)}
              </View>
            )}

            {cv.languages.length > 0 && (
              <View style={s.sideSection}>
                <Text style={s.sideSectionTitle}>Lingue</Text>
                {cv.languages.map((l, i) => (
                  <View key={i} style={s.langRow}>
                    <Text style={s.langName}>{l.language}</Text>
                    <Text style={s.langBadge}>{l.level}</Text>
                  </View>
                ))}
              </View>
            )}

            {cv.certifications.length > 0 && (
              <View style={s.sideSection}>
                <Text style={s.sideSectionTitle}>Certificazioni</Text>
                {cv.certifications.map((c, i) => <Text key={i} style={s.sideTag}>{c}</Text>)}
              </View>
            )}

          </View>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>{pi.name} – Curriculum Vitae</Text>
          <Text style={s.footerBrand}>✦ Generato con NorthStar</Text>
        </View>
      </Page>
    </Document>
  );
}
