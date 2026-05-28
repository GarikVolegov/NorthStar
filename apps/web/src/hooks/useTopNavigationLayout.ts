import { useAuth } from "@/contexts/AuthContext";
import { useLogoPreset } from "@/hooks/useLogoPreset";
import { getJson, postJson, putJson } from "@/lib/apiClient";
import {
  availableTopNavigationItems,
  defaultTopNavigationLayout,
  navPhaseFromJourney,
  resolveTopNavigationItems,
  type TopNavigationCatalogItem,
  type TopNavigationDisplayItem,
  type TopNavigationLayoutItem,
} from "@/lib/top-navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";

interface NavigationLayoutResponse {
  layout: TopNavigationLayoutItem[];
  availableItems: TopNavigationCatalogItem[];
  isDefault: boolean;
  updatedAt: string | null;
}

const ENDPOINT = "/api/profile/navigation-layout";
const QUERY_KEY = ["profile-navigation-layout"] as const;
export const TOP_NAV_MAX_VISIBLE = 6;

async function fetchNavigationLayout() {
  return getJson<NavigationLayoutResponse>(ENDPOINT);
}

async function saveNavigationLayout(layout: TopNavigationLayoutItem[]) {
  return putJson<NavigationLayoutResponse>(ENDPOINT, { layout });
}

async function resetNavigationLayout() {
  return postJson<NavigationLayoutResponse>(`${ENDPOINT}/reset`);
}

export function useTopNavigationLayout(): {
  items: TopNavigationDisplayItem[];
  layout: TopNavigationLayoutItem[];
  availableItems: TopNavigationCatalogItem[];
  isLoading: boolean;
  isSaving: boolean;
  errorMessage: string | null;
  updateLayout: (layout: TopNavigationLayoutItem[]) => boolean;
  resetLayout: () => void;
} {
  const queryClient = useQueryClient();
  const { isLoggedIn, user } = useAuth();
  const { activePreset } = useLogoPreset();
  const phase = navPhaseFromJourney(isLoggedIn, user?.journeyType);
  const fallbackAvailable = useMemo(() => availableTopNavigationItems(phase), [phase]);
  const fallbackLayout = useMemo(() => defaultTopNavigationLayout(phase), [phase]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data, isLoading } = useQuery<NavigationLayoutResponse>({
    queryKey: QUERY_KEY,
    queryFn: fetchNavigationLayout,
    enabled: isLoggedIn,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: saveNavigationLayout,
    onSuccess: (result) => {
      queryClient.setQueryData(QUERY_KEY, result);
      setErrorMessage(null);
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : "Salvataggio non riuscito");
    },
  });

  const resetMutation = useMutation({
    mutationFn: resetNavigationLayout,
    onSuccess: (result) => {
      queryClient.setQueryData(QUERY_KEY, result);
      setErrorMessage(null);
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : "Reset non riuscito");
    },
  });

  const availableItems = data?.availableItems ?? fallbackAvailable;
  const layout = data?.layout ?? fallbackLayout;
  const items = useMemo(
    () =>
      resolveTopNavigationItems(layout, availableItems).map((item) =>
        item.brand ? { ...item, logoUrl: activePreset.assetUrl } : item,
      ),
    [activePreset.assetUrl, availableItems, layout],
  );

  const updateLayout = useCallback(
    (newLayout: TopNavigationLayoutItem[]) => {
      const visibleCount = newLayout.filter((item) => item.visible).length;
      if (visibleCount > TOP_NAV_MAX_VISIBLE) {
        setErrorMessage(`Puoi mostrare al massimo ${TOP_NAV_MAX_VISIBLE} sezioni nella barra alta.`);
        return false;
      }

      setErrorMessage(null);
      queryClient.setQueryData<NavigationLayoutResponse>(QUERY_KEY, {
        layout: newLayout,
        availableItems,
        isDefault: false,
        updatedAt: new Date().toISOString(),
      });

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        mutation.mutate(newLayout);
      }, 500);
      return true;
    },
    [availableItems, mutation, queryClient],
  );

  const resetLayout = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    resetMutation.mutate();
  }, [resetMutation]);

  return {
    items,
    layout,
    availableItems,
    isLoading,
    isSaving: mutation.isPending || resetMutation.isPending,
    errorMessage,
    updateLayout,
    resetLayout,
  };
}
