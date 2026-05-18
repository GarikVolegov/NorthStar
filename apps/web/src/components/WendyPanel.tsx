import { useEffect, useRef, useMemo } from "react";
import { useWendy } from "../contexts/WendyProvider";
import { WendyChat } from "./WendyChat";
import { WendyAvatar } from "./wendy-avatar";
import { X } from "lucide-react";

export function WendyPanel() {
  const { isOpen, isSpeaking, close, getPageHints } = useWendy();
  const hints = useMemo(() => getPageHints(), [getPageHints]);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-background/60 backdrop-blur-md"
        onClick={close}
      />
      <div
        ref={panelRef}
        data-testid="wendy-panel"
        className={`fixed z-50 flex flex-col overflow-hidden bg-background/80 shadow-2xl backdrop-blur-2xl transition-all duration-300
          md:right-4 md:top-4 md:bottom-4 md:w-[440px] md:max-w-[90vw] md:rounded-3xl md:border md:border-white/10
          inset-x-0 bottom-0 top-0 rounded-t-3xl md:rounded-t-3xl
        `}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/10 bg-background/55 px-4 py-3 shrink-0">
          <div className="relative">
            <WendyAvatar
              state={isSpeaking ? "speaking" : "curious"}
              phase={1}
              reduced={!isSpeaking}
              size={40}
            />
            {isSpeaking && (
              <span className="absolute -inset-0.5 rounded-full border border-violet-400/40 animate-ping" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-foreground">
              Wendy
            </div>
            <div className="text-xs text-muted-foreground">
              {isSpeaking ? "Sta parlando..." : "Online"}
            </div>
          </div>
          <button
            onClick={close}
            data-testid="wendy-close-btn"
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Chiudi"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Chat */}
        <div className="flex-1 overflow-hidden">
          <WendyChat
            className="h-full rounded-none border-0 bg-transparent shadow-none"
            welcomeMessage={hints.welcome}
            quickActions={hints.quickActions}
          />
        </div>

      </div>
    </>
  );
}
