import { useLogoPreset } from "@/hooks/useLogoPreset";
import { useEffect } from "react";

function setHeadIcon(selector: string, href: string) {
  const link = document.querySelector<HTMLLinkElement>(selector);
  if (link) link.href = href;
}

export function AppLogoHeadSync() {
  const { activePreset } = useLogoPreset();
  const iconUrl = activePreset.badgeUrl || activePreset.assetUrl;

  useEffect(() => {
    setHeadIcon('link[rel="icon"]', iconUrl);
    setHeadIcon('link[rel="apple-touch-icon"]', iconUrl);
  }, [iconUrl]);

  return null;
}
