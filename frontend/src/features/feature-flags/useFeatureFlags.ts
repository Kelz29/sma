import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "@/lib/axios";
import { useAuthStore } from "@/store/authStore";

export interface FeatureFlagItem {
  key: string;
  enabled: boolean;
  description?: string | null;
}

export function useFeatureFlags() {
  const accessToken = useAuthStore((s) => s.accessToken);

  const { data: list, isLoading, isError } = useQuery<FeatureFlagItem[]>({
    queryKey: ["feature-flags"],
    queryFn: async () => {
      const res = await api.get<FeatureFlagItem[]>("/feature-flags");
      return res.data;
    },
    enabled: !!accessToken,
    staleTime: 60_000,
  });

  const flags = useMemo(() => {
    const map: Record<string, boolean> = {};
    list?.forEach((f) => {
      map[f.key] = f.enabled;
    });
    return map;
  }, [list]);

  const isEnabled = (key: string): boolean => (flags[key] ?? true);

  return { flags, list, isLoading, isError, isEnabled };
}
