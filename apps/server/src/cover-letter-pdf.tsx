import React from "react";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";

Font.registerHyphenationCallback((word) => [word]);

const GREEN_DARK = "#1a2e1a";
const GREEN_MID = "#2d5a2d";
const GREEN_LIGHT = "#a3c4a3";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";

const s = StyleSheet.create({
  page: { backgroundColor: "#ffffff", fontFamily: "Helvetica", fontSize: 10, paddingTop: 52, paddingBottom: 52, paddingHorizontal: 56 },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, paddingBottom: 20, borderBottomWidth: 2, borderBottomColor: GREEN_MID },
  headerLeft: { flex: 1 },
  senderName: { fontSize: 18, fontFamily: "Helvetica-Bold", color: GREEN_DARK, marginBottom: 3 },
  senderTitle: { fontSize: 10, color: GREEN_MID, fontFamily: "Helvetica-Oblique", marginBottom: 8 },
  contactGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  contactItem: { fontSize: 8.5, color: MUTED },

  dateBox: { alignItems: "flex-end" },
  dateText: { fontSize: 9, color: MUTED, fontFamily: "Helvetica-Oblique" },
  brandBadge: { marginTop: 6, backgroundColor: GREEN_MID, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  brandText: { fontSize: 7.5, color: "#ffffff", fontFamily: "Helvetica-Bold" },

  recipientBox: { marginBottom: 28 },
  recipientCompany: { fontSize: 10, fontFamily: "Helvetica-Bold", color: GREEN_DARK },
  recipientRole: { fontSize: 9.5, color: GREEN_MID, marginBottom: 2, fontFamily: "Helvetica-Oblique" },

  subjectLine: { marginBottom: 24, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#f0fdf4", borderLeftWidth: 3, borderLeftColor: GREEN_MID },
  subjectLabel: { fontSize: 8, color: GREEN_MID, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  subjectText: { fontSize: 10, fontFamily: "Helvetica-Bold", color: GREEN_DARK },

  salutation: { fontSize: 10.5, color: GREEN_DARK, fontFamily: "Helvetica-Bold", marginBottom: 16 },

  paragraph: { fontSize: 10, color: "#374151", lineHeight: 1.65, marginBottom: 14, textAlign: "justify" },

  closing: { marginTop: 24, marginBottom: 6, fontSize: 10, color: GREEN_DARK },
  signature: { fontSize: 12, fontFamily: "Helvetica-Bold", color: GREEN_DARK, marginTop: 4 },
  sigTitle: { fontSize: 9, color: MUTED, fontFamily: "Helvetica-Oblique", marginTop: 2 },

  footer: { position: "absolute", bottom: 20, left: 56, right: 56, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7.5, color: "#9ca3af" },
  footerBrand: { fontSize: 7.5, color: GREEN_LIGHT, fontFamily: "Helvetica-Oblique" },
});

export interface CoverLetterData {
  senderName: string;
  senderTitle?: string;
  senderEmail?: string;
  senderPhone?: string;
  senderLocation?: string;
  recipientCompany?: string;
  recipientRole?: string;
  date: string;
  subject?: string;
  salutation: string;
  paragraphs: string[];
  closing: string;
}

export function CoverLetterPdfDocument({ letter }: { letter: CoverLetterData }) {
  const contacts = [
    letter.senderEmail,
    letter.senderPhone,
    letter.senderLocation,
  ].filter(Boolean);

  return (
    <Document title={`Lettera – ${letter.senderName}`} author={letter.senderName} creator="NorthStar">
      <Page size="A4" style={s.page}>
        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.senderName}>{letter.senderName}</Text>
            {letter.senderTitle && <Text style={s.senderTitle}>{letter.senderTitle}</Text>}
            <View style={s.contactGrid}>
              {contacts.map((c, i) => (
                <Text key={i} style={s.contactItem}>{i > 0 ? "  ·  " : ""}{c}</Text>
              ))}
            </View>
          </View>
          <View style={s.dateBox}>
            <Text style={s.dateText}>{letter.date}</Text>
            <View style={s.brandBadge}>
              <Text style={s.brandText}>✦ NorthStar</Text>
            </View>
          </View>
        </View>

        {/* ── Recipient ── */}
        {(letter.recipientCompany || letter.recipientRole) && (
          <View style={s.recipientBox}>
            {letter.recipientCompany && <Text style={s.recipientCompany}>{letter.recipientCompany}</Text>}
            {letter.recipientRole && <Text style={s.recipientRole}>{letter.recipientRole}</Text>}
          </View>
        )}

        {/* ── Subject ── */}
        {letter.subject && (
          <View style={s.subjectLine}>
            <Text style={s.subjectLabel}>Oggetto</Text>
            <Text style={s.subjectText}>{letter.subject}</Text>
          </View>
        )}

        {/* ── Body ── */}
        <Text style={s.salutation}>{letter.salutation}</Text>
        {letter.paragraphs.map((p, i) => (
          <Text key={i} style={s.paragraph}>{p}</Text>
        ))}

        {/* ── Closing ── */}
        <Text style={s.closing}>{letter.closing}</Text>
        <Text style={s.signature}>{letter.senderName}</Text>
        {letter.senderTitle && <Text style={s.sigTitle}>{letter.senderTitle}</Text>}

        {/* ── Footer ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{letter.senderName} – Lettera di Presentazione</Text>
          <Text style={s.footerBrand}>Generato con NorthStar</Text>
        </View>
      </Page>
    </Document>
  );
}
