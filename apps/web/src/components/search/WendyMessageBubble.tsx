import { UiToolRenderer } from "@/components/wendy/UiToolRenderer";
import { WendyActionCard } from "@/components/wendy/WendyActionCard";
import type { ChatMessage as WendyMessage } from "@/hooks/useWendyChat";
import { cn } from "@/lib/utils";
import { WendySources } from "./WendySources";

interface WendyMessageBubbleProps {
  message: WendyMessage;
  onConfirmAction: (messageId: string, actionId: string) => void;
  onCancelAction: (messageId: string, actionId: string) => void;
}

export function WendyMessageBubble({
  message,
  onConfirmAction,
  onCancelAction,
}: WendyMessageBubbleProps) {
  if (message.role === "error") {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {message.content}
      </div>
    );
  }

  const hasBody = !!message.content || !!message.uiTool;
  return (
    <div className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[92%]", message.role === "user" ? "text-right" : "text-left")}>
        {hasBody && (
          <div
            className={cn(
              "rounded-3xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
              message.role === "user"
                ? "rounded-tr-md bg-primary text-primary-foreground"
                : "rounded-tl-md bg-muted/65 text-foreground",
            )}
          >
            {message.uiTool ? (
              <UiToolRenderer name={message.uiTool.name} args={message.uiTool.args} />
            ) : (
              message.content
            )}
          </div>
        )}
        {message.role === "assistant" && (
          <>
            {message.actions?.map((action) => (
              <WendyActionCard
                key={action.id}
                action={action}
                onConfirm={() => onConfirmAction(message.id, action.id)}
                onCancel={() => onCancelAction(message.id, action.id)}
              />
            ))}
            <WendySources message={message} />
          </>
        )}
      </div>
    </div>
  );
}
