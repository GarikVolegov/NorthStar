import { CheckCheck, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  content: string;
  isMine: boolean;
  timestamp: string;
  isRead?: boolean;
  isEncrypted?: boolean;
  senderName?: string;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function MessageBubble({
  content,
  isMine,
  timestamp,
  isRead,
  isEncrypted = true,
  senderName,
}: MessageBubbleProps) {
  return (
    <div className={cn("flex", isMine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
          isMine
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted text-foreground rounded-bl-md",
        )}
      >
        {!isMine && senderName && (
          <p className="text-[11px] font-semibold text-primary/70 mb-0.5">{senderName}</p>
        )}
        <p className="whitespace-pre-wrap break-words">{content}</p>
        <div className={cn(
          "flex items-center gap-1 mt-0.5",
          isMine ? "justify-end" : "justify-start",
        )}>
          {isEncrypted && (
            <Lock className={cn("w-2.5 h-2.5", isMine ? "text-primary-foreground/60" : "text-emerald-500")} />
          )}
          <span className={cn(
            "text-[10px] leading-none",
            isMine ? "text-primary-foreground/60" : "text-muted-foreground",
          )}>
            {formatTime(timestamp)}
          </span>
          {isMine && (
            <CheckCheck className={cn("w-3 h-3", isRead ? "text-emerald-400" : "text-primary-foreground/40")} />
          )}
        </div>
      </div>
    </div>
  );
}
