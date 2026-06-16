import { USER_BACKGROUND_PRESETS, findUserBackgroundPreset } from "@/features/user-background/backgroundPresets";
import { createUserBackgroundVariants } from "@/features/user-background/imageVariants";
import type {
  ActiveUserBackground,
  UserBackgroundAppearance,
  UploadBackgroundInput,
  UserBackgroundEntry,
  UserBackgroundState,
} from "@/features/user-background/types";
import { normalizeBackgroundAppearance } from "@/features/user-background/types";
import { ApiClientError, deleteJson, getJson, patchJson, postJson } from "@/lib/apiClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

const BASE = import.meta.env.BASE_URL || "/";
const MAX_LIBRARY = 5;

interface UploadResponse {
  entry: UserBackgroundEntry;
  library: UserBackgroundEntry[];
}

interface DeleteResponse {
  activeBackgroundId: string | null;
  library: UserBackgroundEntry[];
}

interface AppearanceResponse {
  appearance: UserBackgroundAppearance;
}

function backgroundEndpoint(userId: number) {
  return `${BASE}api/profile/${userId > 0 ? "me" : userId}/backgrounds`;
}

function errorToMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Operazione sfondo non riuscita.";
}

function resolveActiveBackground(
  activeBackgroundId: string | null | undefined,
  library: UserBackgroundEntry[],
): ActiveUserBackground | null {
  const preset = findUserBackgroundPreset(activeBackgroundId);
  if (preset) return { kind: "preset", id: preset.id, preset };
  if (activeBackgroundId?.startsWith("user:")) {
    const entryId = activeBackgroundId.slice(5);
    const entry = library.find((item) => item.id === entryId);
    if (entry) return { kind: "user", id: `user:${entry.id}`, entry };
  }
  return null;
}

export function useUserBackground(userId: number | null | undefined) {
  const queryClient = useQueryClient();
  const [localError, setLocalError] = useState<string | null>(null);
  const [previewBackgroundId, setPreviewBackgroundId] = useState<string | null>(null);
  const queryKey = ["user-background", userId] as const;
  const enabled = typeof userId === "number" && userId > 0;

  const query = useQuery<UserBackgroundState>({
    queryKey,
    queryFn: () => getJson<UserBackgroundState>(backgroundEndpoint(userId ?? 0)),
    enabled,
    retry: false,
  });

  const state = query.data ?? { activeBackgroundId: null, library: [] };
  const appearance = useMemo(
    () => normalizeBackgroundAppearance(state.appearance),
    [state.appearance],
  );

  const setActiveMutation = useMutation({
    mutationFn: (id: string | null) =>
      patchJson<{ activeBackgroundId: string | null }>(
        `${backgroundEndpoint(userId ?? 0)}/active`,
        { id },
      ),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<UserBackgroundState>(queryKey);
      queryClient.setQueryData<UserBackgroundState>(queryKey, (current) => ({
        activeBackgroundId: id,
        library: current?.library ?? state.library,
        appearance: current?.appearance ?? appearance,
      }));
      return { previous };
    },
    onSuccess: (data) => {
      setLocalError(null);
      setPreviewBackgroundId(null);
      queryClient.setQueryData<UserBackgroundState>(queryKey, (current) => ({
        activeBackgroundId: data.activeBackgroundId,
        library: current?.library ?? state.library,
        appearance: current?.appearance ?? appearance,
      }));
    },
    onError: (error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      setLocalError(errorToMessage(error));
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, label }: UploadBackgroundInput) => {
      const variants = await createUserBackgroundVariants(file);
      return postJson<UploadResponse>(backgroundEndpoint(userId ?? 0), {
        ...variants,
        ...(label?.trim() ? { label: label.trim() } : {}),
      });
    },
    onSuccess: (data) => {
      setLocalError(null);
      queryClient.setQueryData<UserBackgroundState>(queryKey, (current) => ({
        activeBackgroundId: current?.activeBackgroundId ?? null,
        library: data.library.length > 0 ? data.library : [...(current?.library ?? []), data.entry],
        appearance: current?.appearance ?? appearance,
      }));
    },
    onError: (error) => setLocalError(errorToMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (entryId: string) =>
      deleteJson<DeleteResponse>(`${backgroundEndpoint(userId ?? 0)}/${entryId}`),
    onSuccess: (data) => {
      setLocalError(null);
      queryClient.setQueryData<UserBackgroundState>(queryKey, {
        activeBackgroundId: data.activeBackgroundId,
        library: data.library,
        appearance,
      });
    },
    onError: (error) => setLocalError(errorToMessage(error)),
  });

  const appearanceMutation = useMutation({
    mutationFn: (next: Partial<UserBackgroundAppearance>) =>
      patchJson<AppearanceResponse>(`${backgroundEndpoint(userId ?? 0)}/appearance`, next),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<UserBackgroundState>(queryKey);
      queryClient.setQueryData<UserBackgroundState>(queryKey, (current) => ({
        activeBackgroundId: current?.activeBackgroundId ?? state.activeBackgroundId,
        library: current?.library ?? state.library,
        appearance: normalizeBackgroundAppearance({
          ...appearance,
          ...next,
        }),
      }));
      return { previous };
    },
    onSuccess: (data) => {
      setLocalError(null);
      queryClient.setQueryData<UserBackgroundState>(queryKey, (current) => ({
        activeBackgroundId: current?.activeBackgroundId ?? state.activeBackgroundId,
        library: current?.library ?? state.library,
        appearance: data.appearance,
      }));
    },
    onError: (error, _next, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      setLocalError(errorToMessage(error));
    },
  });

  const activeBackground = useMemo(
    () => resolveActiveBackground(state.activeBackgroundId, state.library),
    [state.activeBackgroundId, state.library],
  );
  const previewBackground = useMemo(
    () => resolveActiveBackground(previewBackgroundId, state.library),
    [previewBackgroundId, state.library],
  );
  const serverError = localError ?? (query.error ? errorToMessage(query.error) : null);

  return {
    activeBackground,
    activeBackgroundId: state.activeBackgroundId,
    previewBackground,
    previewBackgroundId,
    appearance,
    library: state.library,
    presets: USER_BACKGROUND_PRESETS,
    loading: query.isLoading,
    saving: setActiveMutation.isPending || deleteMutation.isPending || appearanceMutation.isPending,
    uploading: uploadMutation.isPending,
    error: serverError,
    serverError,
    persistenceUnavailable: serverError?.toLowerCase().includes("persistenza") ?? false,
    imageTooLarge: serverError?.toLowerCase().includes("troppo grande") ?? false,
    libraryFull: state.library.length >= MAX_LIBRARY,
    setPreviewBackground: setPreviewBackgroundId,
    refresh: () => query.refetch(),
    setActiveBackground: (id: string | null) => setActiveMutation.mutateAsync(id),
    updateAppearance: (next: Partial<UserBackgroundAppearance>) => appearanceMutation.mutateAsync(next),
    uploadBackground: (input: UploadBackgroundInput) => uploadMutation.mutateAsync(input),
    deleteBackground: (entryId: string) => deleteMutation.mutateAsync(entryId),
  };
}
