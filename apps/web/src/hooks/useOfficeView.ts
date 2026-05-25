import { useEffect, useState } from "react";

type OfficeView = "office" | "grid";

const STORAGE_KEY = "northstar.admin.office.view";

function isOfficeView(value: unknown): value is OfficeView {
  return value === "office" || value === "grid";
}

export function useOfficeView(): [OfficeView, (next: OfficeView) => void] {
  const [view, setView] = useState<OfficeView>(() => {
    if (typeof window === "undefined") return "office";
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isOfficeView(stored) ? stored : "office";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, view);
  }, [view]);

  return [view, setView];
}
