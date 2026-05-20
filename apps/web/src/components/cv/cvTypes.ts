export interface GraphNode {
  id: string;
  label: string;
  type: "role" | "skill" | "tool" | "certification";
  description: string;
  userAdded?: boolean;
}

export interface GeneratedCv {
  personalInfo: {
    name: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    website?: string;
    title?: string;
  };
  summary: string;
  experience: Array<{
    id: string;
    title: string;
    company: string;
    period: string;
    location?: string;
    description: string;
    skills: string[];
  }>;
  education: Array<{
    id: string;
    degree: string;
    institution: string;
    year: string;
    description?: string;
  }>;
  skills: string[];
  tools: string[];
  languages: Array<{ language: string; level: string }>;
  certifications: string[];
  targetRole?: string;
  generatedAt?: string;
}

export interface SavedGeneratedCvData {
  generated?: GeneratedCv | null;
  coverLetter?: CoverLetter | null;
  lastSaved?: string | null;
}

export interface CoverLetter {
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
  generatedAt?: string;
}

export interface AtsSection {
  name: string;
  score: number;
  feedback: string;
}

export interface AtsResult {
  score: number;
  label: string;
  sections: AtsSection[];
  missingKeywords: string[];
  strengths: string[];
  tips: string[];
}
