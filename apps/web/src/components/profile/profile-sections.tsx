import type { ReactNode } from "react";
import { JourneyScoreWidget } from "@/components/JourneyScoreWidget";
import { CvSection } from "@/components/CvSection";
import { CertificationsSection } from "@/components/CertificationsSection";
import { TestHistoryCard } from "@/components/TestHistoryCard";
import { NftCertificateGallery } from "@/components/NftCertificateGallery";
import { SavedItems } from "@/components/profile/sections/SavedItems";

export type JourneyType = "indeciso" | "dipendente" | "autonomo" | "azienda" | "investitore";

interface SectionDef {
  key: string;
  render: (props: { userId: number }) => ReactNode;
}

const SECTION_MAP: Record<JourneyType, SectionDef[]> = {
  indeciso: [
    { key: "test-history",  render: () => <TestHistoryCard /> },
    { key: "journey-score", render: ({ userId }) => <JourneyScoreWidget userId={userId} /> },
    { key: "saved",         render: () => <SavedItems /> },
    { key: "nft",           render: ({ userId }) => <NftCertificateGallery userId={userId} /> },
  ],
  dipendente: [
    { key: "journey-score", render: ({ userId }) => <JourneyScoreWidget userId={userId} /> },
    { key: "cv",            render: ({ userId }) => <CvSection userId={userId} /> },
    { key: "certifications",render: ({ userId }) => <CertificationsSection userId={userId} /> },
    { key: "test-history",  render: () => <TestHistoryCard /> },
    { key: "saved",         render: () => <SavedItems /> },
    { key: "nft",           render: ({ userId }) => <NftCertificateGallery userId={userId} /> },
  ],
  autonomo: [
    { key: "journey-score", render: ({ userId }) => <JourneyScoreWidget userId={userId} /> },
    { key: "cv",            render: ({ userId }) => <CvSection userId={userId} /> },
    { key: "certifications",render: ({ userId }) => <CertificationsSection userId={userId} /> },
    { key: "saved",         render: () => <SavedItems /> },
    { key: "nft",           render: ({ userId }) => <NftCertificateGallery userId={userId} /> },
  ],
  azienda: [
    { key: "journey-score", render: ({ userId }) => <JourneyScoreWidget userId={userId} /> },
    { key: "certifications",render: ({ userId }) => <CertificationsSection userId={userId} /> },
    { key: "saved",         render: () => <SavedItems /> },
    { key: "nft",           render: ({ userId }) => <NftCertificateGallery userId={userId} /> },
  ],
  investitore: [
    { key: "journey-score", render: ({ userId }) => <JourneyScoreWidget userId={userId} /> },
    { key: "saved",         render: () => <SavedItems /> },
    { key: "nft",           render: ({ userId }) => <NftCertificateGallery userId={userId} /> },
  ],
};

export function JourneySectionRenderer({
  journeyType,
  userId,
}: {
  journeyType: JourneyType;
  userId: number;
}) {
  const sections = SECTION_MAP[journeyType] ?? SECTION_MAP.indeciso;

  return (
    <div className="space-y-5">
      {sections.map(({ key, render }) => {
        return <div key={key}>{render({ userId })}</div>;
      })}
    </div>
  );
}
