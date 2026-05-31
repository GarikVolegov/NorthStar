import {
  LOGO_PRESETS,
  resolveLogoPreset,
  type LogoPreset,
} from "@workspace/api-zod/logo-presets";
import { useAuth } from "@/contexts/AuthContext";
import { getJson, patchJson } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/lib/constants";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface LogoPresetResponse {
  activePreset: LogoPreset;
  presets: LogoPreset[];
}

const QUERY_KEY = ["profile-logo"] as const;

const DEFAULT_RESPONSE: LogoPresetResponse = {
  activePreset: resolveLogoPreset(null),
  presets: [...LOGO_PRESETS],
};

export function useLogoPreset() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const enabled = Boolean(user?.id);

  const query = useQuery<LogoPresetResponse>({
    queryKey: QUERY_KEY,
    queryFn: () => getJson<LogoPresetResponse>(API_ENDPOINTS.profileLogo.current),
    enabled,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: (presetId: string) =>
      patchJson<LogoPresetResponse>(API_ENDPOINTS.profileLogo.current, { presetId }),
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEY, data);
    },
  });

  const data = query.data ?? DEFAULT_RESPONSE;

  return {
    activePreset: data.activePreset,
    presets: data.presets,
    isLoading: enabled && query.isLoading,
    isSaving: mutation.isPending,
    error: query.error ?? mutation.error,
    setLogoPreset: (presetId: string) => mutation.mutateAsync(presetId),
  };
}
