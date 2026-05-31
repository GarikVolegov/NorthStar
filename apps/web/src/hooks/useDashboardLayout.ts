/**
 * useDashboardLayout — fetch and persist the user's dashboard widget layout.
 *
 * GET /api/dashboard/layout returns the saved order + visibility.
 * PUT /api/dashboard/layout persists changes, debounced at 800ms.
 */
import { useAuth } from "@/contexts/AuthContext";
import {
  getDashboardSectionCatalog,
  getDefaultDashboardSectionLayout,
  resolveDashboardSectionLayout,
} from "@/components/dashboard/dashboard-layout-sections";
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

async function fetchLayout(): Promise<LayoutResponse> {
  try {
    return await getJson<LayoutResponse>(LAYOUT_ENDPOINT);
  } catch {
    return { layout: [] };
  }
}

async function saveLayout(layout: WidgetLayout[]): Promise<LayoutResponse> {
  return putJson<LayoutResponse>(LAYOUT_ENDPOINT, { layout });
}

export function useDashboardLayout() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const hasUser = user !== null && user !== undefined;
  const journeyType = user?.journeyType;
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
    layout: resolveDashboardSectionLayout(data?.layout, journeyType),
    availableSections: getDashboardSectionCatalog(journeyType),
    defaultLayout: getDefaultDashboardSectionLayout(journeyType),
    isLoading,
    isSaving: mutation.isPending,
    updateLayout,
  };
}
