import { apiFetch } from "@/lib/api-fetch";
import { useQuery } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL || "/";

export type AffiliateInvitePreviewStatus = "idle" | "loading" | "ready" | "unavailable" | "error";

export interface AffiliateInvitePreview {
  status: AffiliateInvitePreviewStatus;
  referralCode: string | null;
  referralLink: string | null;
}

const EMPTY_PREVIEW: AffiliateInvitePreview = {
  status: "idle",
  referralCode: null,
  referralLink: null,
};

interface AffiliatePreviewData {
  referralCode: string | null;
  referralLink: string | null;
}

export function useAffiliateInvitePreview(open: boolean, enabled: boolean): AffiliateInvitePreview {
  // apiFetch (non apiClient) perché serve distinguere lo status 403 = "unavailable"
  const { data, isError } = useQuery<AffiliatePreviewData>({
    queryKey: ["affiliate-invite-preview"],
    enabled: open && enabled,
    queryFn: async () => {
      const response = await apiFetch(`${BASE}api/affiliate/dashboard`);
      if (response.status === 403) return { referralCode: null, referralLink: null };
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as {
        referralCode?: string | null;
        code?: string | null;
        referralLink?: string | null;
        link?: string | null;
      };
      return {
        referralCode: payload.referralCode ?? payload.code ?? null,
        referralLink: payload.referralLink ?? payload.link ?? null,
      };
    },
  });

  if (!enabled) return EMPTY_PREVIEW;
  if (isError) return { status: "error", referralCode: null, referralLink: null };
  if (!data) {
    // nessun dato in cache: loading se il pannello è aperto, altrimenti idle
    return open ? { status: "loading", referralCode: null, referralLink: null } : EMPTY_PREVIEW;
  }
  return data.referralLink
    ? { status: "ready", referralCode: data.referralCode, referralLink: data.referralLink }
    : { status: "unavailable", referralCode: null, referralLink: null };
}
