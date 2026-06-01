export type AdminSubscriptionPlan = "free" | "pro" | "team";
export type AdminSubscriptionStatus = "free" | "active" | "expired" | "cancelled";
export type AdminSubscriptionSource = "free" | "internal" | "stripe";

export type AdminSubscriptionCurrent = {
  id: number | null;
  plan: AdminSubscriptionPlan;
  rawPlan: AdminSubscriptionPlan | null;
  status: AdminSubscriptionStatus;
  source: AdminSubscriptionSource;
  validUntil: string | null;
  cancelledAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  hasStripeSubscription: boolean;
  stripeSubscriptionId: string | null;
};

export type AdminSubscriptionItem = {
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
    createdAt: string | null;
  };
  current: AdminSubscriptionCurrent;
};

export type AdminSubscriptionHistoryItem = {
  id: number;
  plan: AdminSubscriptionPlan;
  effectivePlan: AdminSubscriptionPlan;
  status: AdminSubscriptionStatus;
  source: Exclude<AdminSubscriptionSource, "free">;
  validUntil: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  hasStripeSubscription: boolean;
  stripeSubscriptionId: string | null;
};

export type AdminSubscriptionsResponse = {
  generatedAt: string;
  items: AdminSubscriptionItem[];
  total: number;
  limit: number;
  offset: number;
  stats: Record<AdminSubscriptionPlan | "total", number>;
};

export type AdminSubscriptionDetail = AdminSubscriptionItem & {
  history: AdminSubscriptionHistoryItem[];
};
