import type { ReactNode } from "react";
import { ProssimiEventi } from "@/components/calendario/ProssimiEventi";
import { ProfileCompletionCard } from "@/components/ProfileCompletionCard";
import { JourneyScoreWidget } from "@/components/JourneyScoreWidget";
import { CvSection } from "@/components/CvSection";
import { CertificationsSection } from "@/components/CertificationsSection";
import { TestHistoryCard } from "@/components/TestHistoryCard";
import { NftCertificateGallery } from "@/components/NftCertificateGallery";
import { ObjectivesKanban } from "@/components/objectives/ObjectivesKanban";
import { WorkModeCard } from "@/components/profile/sections/WorkModeCard";
import { UserModeCard } from "@/components/profile/sections/UserModeCard";
import { SavedItems } from "@/components/profile/sections/SavedItems";

export type JourneyType = "indeciso" | "dipendente" | "autonomo" | "azienda" | "investitore";

export type CompletionShape = {
  hasTestSession: boolean;
  hasConfirmedSector: boolean;
  hasWorkPreference: boolean;
  hasCv: boolean;
  isPublic: boolean;
  streakDays: number;
  totalObjectives: number;
  completedObjectives: number;
};

interface SectionDef {
  key: string;
  render: (props: { userId: number; completionData: CompletionShape }) => ReactNode;
  condition?: (data: CompletionShape) => boolean;
}

const EMPTY_COMPLETION: CompletionShape = {
  hasTestSession: false,
  hasConfirmedSector: false,
  hasWorkPreference: false,
  hasCv: false,
  isPublic: false,
  streakDays: 0,
  totalObjectives: 0,
  completedObjectives: 0,
};

function isComplete(d: CompletionShape) {
  return d.hasTestSession && d.hasConfirmedSector && d.hasWorkPreference && d.hasCv && d.totalObjectives > 0;
}

const SECTION_MAP: Record<JourneyType, SectionDef[]> = {
  indeciso: [
    { key: "events",        render: ({ userId }) => <ProssimiEventi userId={userId} limit={5} /> },
    { key: "completion",    render: ({ completionData }) => <ProfileCompletionCard data={{ hasTestSession: completionData.hasTestSession, hasConfirmedSector: completionData.hasConfirmedSector, hasWorkPreference: completionData.hasWorkPreference, hasCv: completionData.hasCv, hasObjectives: completionData.totalObjectives > 0 }} />, condition: (d) => !isComplete(d) },
    { key: "test-history",  render: () => <TestHistoryCard /> },
    { key: "journey-score", render: ({ userId }) => <JourneyScoreWidget userId={userId} /> },
    { key: "work-mode",     render: ({ userId }) => <WorkModeCard userId={userId} /> },
    { key: "user-mode",     render: ({ userId }) => <UserModeCard userId={userId} /> },
    { key: "saved",         render: () => <SavedItems /> },
    { key: "objectives",    render: ({ userId }) => <ObjectivesKanban userId={userId} /> },
    { key: "nft",           render: ({ userId }) => <NftCertificateGallery userId={userId} /> },
  ],
  dipendente: [
    { key: "events",        render: ({ userId }) => <ProssimiEventi userId={userId} limit={5} /> },
    { key: "completion",    render: ({ completionData }) => <ProfileCompletionCard data={{ hasTestSession: completionData.hasTestSession, hasConfirmedSector: completionData.hasConfirmedSector, hasWorkPreference: completionData.hasWorkPreference, hasCv: completionData.hasCv, hasObjectives: completionData.totalObjectives > 0 }} />, condition: (d) => !isComplete(d) },
    { key: "journey-score", render: ({ userId }) => <JourneyScoreWidget userId={userId} /> },
    { key: "cv",            render: ({ userId }) => <CvSection userId={userId} /> },
    { key: "certifications",render: ({ userId }) => <CertificationsSection userId={userId} /> },
    { key: "work-mode",     render: ({ userId }) => <WorkModeCard userId={userId} /> },
    { key: "user-mode",     render: ({ userId }) => <UserModeCard userId={userId} /> },
    { key: "test-history",  render: () => <TestHistoryCard /> },
    { key: "saved",         render: () => <SavedItems /> },
    { key: "objectives",    render: ({ userId }) => <ObjectivesKanban userId={userId} /> },
    { key: "nft",           render: ({ userId }) => <NftCertificateGallery userId={userId} /> },
  ],
  autonomo: [
    { key: "events",        render: ({ userId }) => <ProssimiEventi userId={userId} limit={5} /> },
    { key: "completion",    render: ({ completionData }) => <ProfileCompletionCard data={{ hasTestSession: completionData.hasTestSession, hasConfirmedSector: completionData.hasConfirmedSector, hasWorkPreference: completionData.hasWorkPreference, hasCv: completionData.hasCv, hasObjectives: completionData.totalObjectives > 0 }} />, condition: (d) => !isComplete(d) },
    { key: "journey-score", render: ({ userId }) => <JourneyScoreWidget userId={userId} /> },
    { key: "cv",            render: ({ userId }) => <CvSection userId={userId} /> },
    { key: "certifications",render: ({ userId }) => <CertificationsSection userId={userId} /> },
    { key: "work-mode",     render: ({ userId }) => <WorkModeCard userId={userId} /> },
    { key: "user-mode",     render: ({ userId }) => <UserModeCard userId={userId} /> },
    { key: "saved",         render: () => <SavedItems /> },
    { key: "objectives",    render: ({ userId }) => <ObjectivesKanban userId={userId} /> },
    { key: "nft",           render: ({ userId }) => <NftCertificateGallery userId={userId} /> },
  ],
  azienda: [
    { key: "events",        render: ({ userId }) => <ProssimiEventi userId={userId} limit={5} /> },
    { key: "completion",    render: ({ completionData }) => <ProfileCompletionCard data={{ hasTestSession: completionData.hasTestSession, hasConfirmedSector: completionData.hasConfirmedSector, hasWorkPreference: completionData.hasWorkPreference, hasCv: completionData.hasCv, hasObjectives: completionData.totalObjectives > 0 }} />, condition: (d) => !isComplete(d) },
    { key: "journey-score", render: ({ userId }) => <JourneyScoreWidget userId={userId} /> },
    { key: "certifications",render: ({ userId }) => <CertificationsSection userId={userId} /> },
    { key: "user-mode",     render: ({ userId }) => <UserModeCard userId={userId} /> },
    { key: "saved",         render: () => <SavedItems /> },
    { key: "objectives",    render: ({ userId }) => <ObjectivesKanban userId={userId} /> },
    { key: "nft",           render: ({ userId }) => <NftCertificateGallery userId={userId} /> },
  ],
  investitore: [
    { key: "events",        render: ({ userId }) => <ProssimiEventi userId={userId} limit={5} /> },
    { key: "completion",    render: ({ completionData }) => <ProfileCompletionCard data={{ hasTestSession: completionData.hasTestSession, hasConfirmedSector: completionData.hasConfirmedSector, hasWorkPreference: completionData.hasWorkPreference, hasCv: completionData.hasCv, hasObjectives: completionData.totalObjectives > 0 }} />, condition: (d) => !isComplete(d) },
    { key: "journey-score", render: ({ userId }) => <JourneyScoreWidget userId={userId} /> },
    { key: "user-mode",     render: ({ userId }) => <UserModeCard userId={userId} /> },
    { key: "saved",         render: () => <SavedItems /> },
    { key: "objectives",    render: ({ userId }) => <ObjectivesKanban userId={userId} /> },
    { key: "nft",           render: ({ userId }) => <NftCertificateGallery userId={userId} /> },
  ],
};

export function JourneySectionRenderer({
  journeyType,
  userId,
  completionData,
}: {
  journeyType: JourneyType;
  userId: number;
  completionData: CompletionShape | null;
}) {
  const sections = SECTION_MAP[journeyType] ?? SECTION_MAP.indeciso;
  const completion = completionData ?? EMPTY_COMPLETION;

  return (
    <div className="space-y-5">
      {sections.map(({ key, render, condition }) => {
        if (condition && !condition(completion)) return null;
        return <div key={key}>{render({ userId, completionData: completion })}</div>;
      })}
    </div>
  );
}
