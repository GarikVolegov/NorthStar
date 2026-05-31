import { useLogoPreset } from "@/hooks/useLogoPreset";
import { cn } from "@/lib/utils";
import { resolveLogoPreset } from "@workspace/api-zod/logo-presets";

interface AppLogoProps {
  alt?: string;
  className?: string;
  decorative?: boolean;
}

export function AppLogo({ alt = "NorthStar", className, decorative = false }: AppLogoProps) {
  const { activePreset } = useLogoPreset();
  const preset = resolveLogoPreset(activePreset?.id);

  return (
    <img
      src={preset.assetUrl}
      alt={decorative ? "" : alt}
      aria-hidden={decorative ? true : undefined}
      className={cn("rounded-full object-cover", className)}
    />
  );
}
