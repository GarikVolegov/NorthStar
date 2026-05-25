import { useCallback, useEffect, useState } from "react";
import { getCatalog } from "./api";
import type { CatalogResource, CatalogTab } from "./types";

export function useAdminCatalog<T>(
  tab: CatalogTab,
  adminKey: string,
): CatalogResource<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true);
    try {
      setData(await getCatalog<T>(tab, adminKey));
    } finally {
      setLoading(false);
    }
  }, [tab, adminKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, refresh };
}
