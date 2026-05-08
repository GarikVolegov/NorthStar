/**
 * usePageContextSnapshot
 *
 * Fire-and-forget hook that persists a PageContextSnapshot to the DB
 * via POST /api/growth-agent/page-context.
 *
 * Called by WendyContextButton on every "Chiedi a Wendy" click for
 * analytics: which pages generate the most contextual questions.
 *
 * Usage:
 *   const { save } = usePageContextSnapshot(token);
 *   save({ pageId: 'riasec-results', pageData: {...}, promptUsed: '...' });
 */
import { useCallback } from "react";

export interface PageContextSnapshotPayload {
  pageId: string;
  pageData: Record<string, unknown>;
  promptUsed?: string;
}

export function usePageContextSnapshot(token: string, apiBase = "/api") {
  const save = useCallback((payload: PageContextSnapshotPayload) => {
    // Fire-and-forget: we don't await or surface errors to the user
    fetch(`${apiBase}/growth-agent/page-context`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    }).catch((err) => {
      console.warn("[usePageContextSnapshot] failed to save snapshot:", err);
    });
  }, [apiBase, token]);

  return { save };
}
