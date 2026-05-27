/**
 * useDashboardLayout — fetch and persist the user's dashboard widget layout.
 *
 * GET /api/dashboard/layout returns the saved order + visibility.
 * PUT /api/dashboard/layout persists changes, debounced at 800ms.
 */
import { useAuth } from "@/contexts/AuthContext";
import { getJson, putJson } from "@/lib/apiClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";

export interface WidgetLayout {
  id: string;
  position: number;
  visible: boolean;
  size: "sm" | "md" | "lg";
}

interface LayoutResponse {
  layout: WidgetLayout[];
}

const LAYOUT_ENDPOINT = "/api/dashboard/layout";
const QUERY_KEY = ["dashboard-layout"] as const;

const DEFAULT_LAYOUT: WidgetLayout[] = [
  { id: "progress_objectives", position: 0, visible: true,  size: "lg" },
  { id: "next_routine",        position: 1, visible: true,  size: "md" },
  { id: "job_feed",            position: 2, visible: true,  size: "md" },
  { id: "insights",            position: 3, visible: true,  size: "md" },
  { id: "mindset_streak",      position: 4, visible: false, size: "sm" },
];

async function fetchLayout(): Promise<LayoutResponse> {
  try {
    return await getJson<LayoutResponse>(LAYOUT_ENDPOINT);
  } catch {
    return { layout: DEFAULT_LAYOUT };
  }
}

async function saveLayout(layout: WidgetLayout[]): Promise<LayoutResponse> {
  return putJson<LayoutResponse>(LAYOUT_ENDPOINT, { layout });
}

export function useDashboardLayout() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const hasUser = user !== null && user !== undefined;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading } = useQuery<LayoutResponse>({
    queryKey: QUERY_KEY,
    queryFn: fetchLayout,
    enabled: hasUser,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: saveLayout,
    onSuccess: (result) => {
      queryClient.setQueryData(QUERY_KEY, result);
    },
  });

  const updateLayout = useCallback(
    (newLayout: WidgetLayout[]) => {
      // Optimistically update the cache immediately
      queryClient.setQueryData<LayoutResponse>(QUERY_KEY, { layout: newLayout });

      // Debounce the actual PUT request
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        mutation.mutate(newLayout);
      }, 800);
    },
    [mutation, queryClient],
  );

  return {
    layout: data?.layout ?? DEFAULT_LAYOUT,
    isLoading,
    isSaving: mutation.isPending,
    updateLayout,
  };
}
