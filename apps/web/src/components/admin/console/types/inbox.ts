export type AdminAssignee = {
  id: number;
  name: string;
  email: string;
};

export type ContactMessageItem = {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  read: boolean;
  readAt: string | null;
  status: "new" | "in_progress" | "resolved" | "archived";
  internalNotes: string | null;
  assignedTo: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ContactInboxResponse = {
  items: ContactMessageItem[];
  stats: Record<string, number>;
  assignees: AdminAssignee[];
  generatedAt: string;
};

export type AffiliationLeadItem = {
  id: number;
  institutionName: string;
  contactName: string;
  email: string;
  partnerType: string;
  message: string | null;
  status: "pending" | "contacted" | "converted" | "rejected";
  read: boolean;
  readAt: string | null;
  internalNotes: string | null;
  assignedTo: number | null;
  createdAt: string;
  updatedAt: string;
};

export type AffiliationInboxResponse = {
  items: AffiliationLeadItem[];
  stats: Record<string, number>;
  sources: Array<{ source: string; count: number }>;
  assignees: AdminAssignee[];
  generatedAt: string;
};
