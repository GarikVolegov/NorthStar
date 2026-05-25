import { Button } from "@/components/ui/button";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

const THEMES = ["system", "light", "dark"] as const;
type Theme = (typeof THEMES)[number];

const ICON: Record<Theme, typeof Monitor> = { system: Monitor, light: Sun, dark: Moon };
const LABEL: Record<Theme, string> = { system: "Sistema", light: "Chiaro", dark: "Scuro" };

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const current = (theme ?? "system") as Theme;

  return (
    <div className="flex items-center gap-1">
      {THEMES.map((t) => {
        const TIcon = ICON[t];
        return (
          <Button
            key={t}
            variant={current === t ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setTheme(t)}
            className="gap-1.5 text-xs"
            aria-pressed={current === t}
          >
            <TIcon className="h-3.5 w-3.5" />
            {LABEL[t]}
          </Button>
        );
      })}
    </div>
  );
}
