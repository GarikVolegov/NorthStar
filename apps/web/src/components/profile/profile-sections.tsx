import { CertificationsSection } from "@/components/CertificationsSection";
import { CvSection } from "@/components/CvSection";
import { JourneyScoreWidget } from "@/components/JourneyScoreWidget";
import { NftCertificateGallery } from "@/components/NftCertificateGallery";
import { SavedItems } from "@/components/profile/sections/SavedItems";
import { TestHistoryCard } from "@/components/TestHistoryCard";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Award,
  BookMarked,
  FileText,
  Gem,
  HeartPulse,
  History,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

export type JourneyType = "indeciso" | "dipendente" | "autonomo" | "azienda" | "investitore";

interface SectionDef {
  key: string;
  title: string;
  description: string;
  Icon: LucideIcon;
  render: (props: { userId: number }) => ReactNode;
}

const SECTION_MAP: Record<JourneyType, SectionDef[]> = {
  indeciso: [
    { key: "test-history", title: "Storico test", description: "Sessioni e risultati completati.", Icon: History, render: () => <TestHistoryCard /> },
    { key: "journey-score", title: "Salute del piano", description: "Completezza e progressi del tuo cammino.", Icon: HeartPulse, render: ({ userId }) => <JourneyScoreWidget userId={userId} /> },
    { key: "saved", title: "Elementi salvati", description: "Risorse e contenuti messi da parte.", Icon: BookMarked, render: () => <SavedItems /> },
    { key: "nft", title: "Corsi e certificati NFT", description: "Attestati emessi al completamento degli obiettivi.", Icon: Gem, render: ({ userId }) => <NftCertificateGallery userId={userId} /> },
  ],
  dipendente: [
    { key: "journey-score", title: "Salute del piano", description: "Completezza e progressi del tuo cammino.", Icon: HeartPulse, render: ({ userId }) => <JourneyScoreWidget userId={userId} /> },
    { key: "cv", title: "Generazione curriculum", description: "Carica, genera, modifica e scarica il CV.", Icon: FileText, render: ({ userId }) => <CvSection userId={userId} /> },
    { key: "certifications", title: "Certificazioni", description: "Corsi, attestati e credenziali professionali.", Icon: Award, render: ({ userId }) => <CertificationsSection userId={userId} /> },
    { key: "test-history", title: "Storico test", description: "Sessioni e risultati completati.", Icon: History, render: () => <TestHistoryCard /> },
    { key: "saved", title: "Elementi salvati", description: "Risorse e contenuti messi da parte.", Icon: BookMarked, render: () => <SavedItems /> },
    { key: "nft", title: "Corsi e certificati NFT", description: "Attestati emessi al completamento degli obiettivi.", Icon: Gem, render: ({ userId }) => <NftCertificateGallery userId={userId} /> },
  ],
  autonomo: [
    { key: "journey-score", title: "Salute del piano", description: "Completezza e progressi del tuo cammino.", Icon: HeartPulse, render: ({ userId }) => <JourneyScoreWidget userId={userId} /> },
    { key: "cv", title: "Generazione curriculum", description: "Carica, genera, modifica e scarica il CV.", Icon: FileText, render: ({ userId }) => <CvSection userId={userId} /> },
    { key: "certifications", title: "Certificazioni", description: "Corsi, attestati e credenziali professionali.", Icon: Award, render: ({ userId }) => <CertificationsSection userId={userId} /> },
    { key: "saved", title: "Elementi salvati", description: "Risorse e contenuti messi da parte.", Icon: BookMarked, render: () => <SavedItems /> },
    { key: "nft", title: "Corsi e certificati NFT", description: "Attestati emessi al completamento degli obiettivi.", Icon: Gem, render: ({ userId }) => <NftCertificateGallery userId={userId} /> },
  ],
  azienda: [
    { key: "journey-score", title: "Salute del piano", description: "Completezza e progressi del tuo cammino.", Icon: HeartPulse, render: ({ userId }) => <JourneyScoreWidget userId={userId} /> },
    { key: "certifications", title: "Certificazioni", description: "Corsi, attestati e credenziali professionali.", Icon: Award, render: ({ userId }) => <CertificationsSection userId={userId} /> },
    { key: "saved", title: "Elementi salvati", description: "Risorse e contenuti messi da parte.", Icon: BookMarked, render: () => <SavedItems /> },
    { key: "nft", title: "Corsi e certificati NFT", description: "Attestati emessi al completamento degli obiettivi.", Icon: Gem, render: ({ userId }) => <NftCertificateGallery userId={userId} /> },
  ],
  investitore: [
    { key: "journey-score", title: "Salute del piano", description: "Completezza e progressi del tuo cammino.", Icon: HeartPulse, render: ({ userId }) => <JourneyScoreWidget userId={userId} /> },
    { key: "saved", title: "Elementi salvati", description: "Risorse e contenuti messi da parte.", Icon: BookMarked, render: () => <SavedItems /> },
    { key: "nft", title: "Corsi e certificati NFT", description: "Attestati emessi al completamento degli obiettivi.", Icon: Gem, render: ({ userId }) => <NftCertificateGallery userId={userId} /> },
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
    <>
      {sections.map(({ key, title, description, Icon, render }) => (
        <AccordionItem key={key} value={key} className="border-b border-border px-4">
          <AccordionTrigger className="py-3.5 hover:no-underline">
            <span className="flex min-w-0 flex-1 flex-col gap-1 text-left md:flex-row md:items-center md:justify-between md:gap-6">
              <span className="flex min-w-0 items-center gap-2.5">
                <Icon className="h-4 w-4 shrink-0 text-primary" />
                <span className="text-sm font-semibold text-foreground">{title}</span>
              </span>
              <span className="text-xs font-normal leading-relaxed text-muted-foreground md:max-w-md md:text-right">
                {description}
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="pb-4">
              {render({ userId })}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </>
  );
}
