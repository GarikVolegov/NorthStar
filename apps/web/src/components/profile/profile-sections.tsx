import { CertificationsSection } from "@/components/CertificationsSection";
import { CvSection } from "@/components/CvSection";
import { JourneyScoreWidget } from "@/components/JourneyScoreWidget";
import { DiaryPreviewWidget } from "@/components/diary/DiaryPreviewWidget";
import { NftCertificateGallery } from "@/components/NftCertificateGallery";
import { SavedItems } from "@/components/profile/sections/SavedItems";
import { TestHistoryCard } from "@/components/TestHistoryCard";
import type { ReactNode } from "react";

export type JourneyType = "indeciso" | "dipendente" | "autonomo" | "azienda" | "investitore";

interface SectionDef {
  key: string;
  render: (props: { userId: number }) => ReactNode;
}

const DIARY_SECTION: SectionDef = {
  key: "diary-preview",
  render: ({ userId }) => <DiaryPreviewWidget userId={userId} />,
};

const SECTION_MAP: Record<JourneyType, SectionDef[]> = {
  indeciso: [
    DIARY_SECTION,
    { key: "test-history",  render: () => <TestHistoryCard /> },
    { key: "journey-score", render: ({ userId }) => <JourneyScoreWidget userId={userId} /> },
    { key: "saved",         render: () => <SavedItems /> },
    { key: "nft",           render: ({ userId }) => <NftCertificateGallery userId={userId} /> },
  ],
  dipendente: [
    DIARY_SECTION,
    { key: "journey-score", render: ({ userId }) => <JourneyScoreWidget userId={userId} /> },
    { key: "cv",            render: ({ userId }) => <CvSection userId={userId} /> },
    { key: "certifications",render: ({ userId }) => <CertificationsSection userId={userId} /> },
    { key: "test-history",  render: () => <TestHistoryCard /> },
    { key: "saved",         render: () => <SavedItems /> },
    { key: "nft",           render: ({ userId }) => <NftCertificateGallery userId={userId} /> },
  ],
  autonomo: [
    DIARY_SECTION,
    { key: "journey-score", render: ({ userId }) => <JourneyScoreWidget userId={userId} /> },
    { key: "cv",            render: ({ userId }) => <CvSection userId={userId} /> },
    { key: "certifications",render: ({ userId }) => <CertificationsSection userId={userId} /> },
    { key: "saved",         render: () => <SavedItems /> },
    { key: "nft",           render: ({ userId }) => <NftCertificateGallery userId={userId} /> },
  ],
  azienda: [
    DIARY_SECTION,
    { key: "journey-score", render: ({ userId }) => <JourneyScoreWidget userId={userId} /> },
    { key: "certifications",render: ({ userId }) => <CertificationsSection userId={userId} /> },
    { key: "saved",         render: () => <SavedItems /> },
    { key: "nft",           render: ({ userId }) => <NftCertificateGallery userId={userId} /> },
  ],
  investitore: [
    DIARY_SECTION,
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
