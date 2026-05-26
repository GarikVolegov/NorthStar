import { UiToolRenderer } from "@/components/wendy/UiToolRenderer";
import { WendyActionCard } from "@/components/wendy/WendyActionCard";
import type { ChatMessage as WendyMessage } from "@/hooks/useWendyChat";
import { cn } from "@/lib/utils";
import { WendySources } from "./WendySources";

interface WendyMessageBubbleProps {
  message: WendyMessage;
  onConfirmAction: (messageId: string, actionId: string, confirmationText?: string) => void;
  onCancelAction: (messageId: string, actionId: string) => void;
}

export function WendyMessageBubble({
  message,
  onConfirmAction,
  onCancelAction,
}: WendyMessageBubbleProps) {
  if (message.role === "error") {
    return (
      <div className="flex justify-start">
        <div className="flex items-start gap-2.5 max-w-[90%]">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive text-xs font-bold mt-0.5">
            !
          </div>
          <div className="rounded-2xl rounded-tl-sm border border-destructive/20 bg-destructive/8 px-3.5 py-2.5 text-sm text-destructive">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  const isUser = message.role === "user";
  const hasBody = !!message.content || !!message.uiTool;

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("flex items-end gap-2", isUser ? "flex-row-reverse" : "flex-row", "max-w-[88%]")}>
        {/* Avatar — solo per Wendy */}
        {!isUser && (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-sm mb-0.5">
            <span className="text-[10px] font-bold text-white">✦</span>
          </div>
        )}

        <div className={cn("flex flex-col gap-1.5", isUser ? "items-end" : "items-start")}>
          {hasBody && (
            <div
              className={cn(
                "px-4 py-2.5 text-sm leading-relaxed",
                isUser
                  ? "rounded-[18px] rounded-br-md bg-primary text-primary-foreground shadow-sm"
                  : "rounded-[18px] rounded-bl-md bg-muted/60 text-foreground backdrop-blur-sm border border-white/6",
                message.uiTool && "px-3 py-2",
              )}
            >
              {message.uiTool ? (
                <UiToolRenderer name={message.uiTool.name} args={message.uiTool.args} />
              ) : (
                <span className="whitespace-pre-wrap">{message.content}</span>
              )}
            </div>
          )}

          {!isUser && (
            <>
              {message.actions?.map((action) => (
                <WendyActionCard
                  key={action.id}
                  action={action}
                  onConfirm={(confirmationText) => onConfirmAction(message.id, action.id, confirmationText)}
                  onCancel={() => onCancelAction(message.id, action.id)}
                />
              ))}
              <WendySources message={message} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
