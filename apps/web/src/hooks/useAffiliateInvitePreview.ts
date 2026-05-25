import { apiFetch } from "@/lib/api-fetch";
import { useEffect, useState } from "react";

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

export function useAffiliateInvitePreview(open: boolean, enabled: boolean): AffiliateInvitePreview {
  const [preview, setPreview] = useState<AffiliateInvitePreview>(EMPTY_PREVIEW);

  useEffect(() => {
    if (!open || !enabled) {
      if (!enabled) setPreview(EMPTY_PREVIEW);
      return;
    }

    let cancelled = false;
    setPreview((current) => ({
      status: current.status === "ready" ? "ready" : "loading",
      referralCode: current.referralCode,
      referralLink: current.referralLink,
    }));

    apiFetch(`${BASE}api/affiliate/dashboard`)
      .then(async (response) => {
        if (response.status === 403) return { unavailable: true };
        if (!response.ok) return { error: true };
        const data = await response.json() as {
          referralCode?: string | null;
          code?: string | null;
          referralLink?: string | null;
          link?: string | null;
        };
        return {
          referralCode: data.referralCode ?? data.code ?? null,
          referralLink: data.referralLink ?? data.link ?? null,
        };
      })
      .then((data) => {
        if (cancelled) return;
        if ("unavailable" in data) {
          setPreview({ status: "unavailable", referralCode: null, referralLink: null });
          return;
        }
        if ("error" in data) {
          setPreview({ status: "error", referralCode: null, referralLink: null });
          return;
        }
        setPreview(
          data.referralLink
            ? { status: "ready", referralCode: data.referralCode, referralLink: data.referralLink }
            : { status: "unavailable", referralCode: null, referralLink: null },
        );
      })
      .catch(() => {
        if (!cancelled) {
          setPreview({ status: "error", referralCode: null, referralLink: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, open]);

  return preview;
}
