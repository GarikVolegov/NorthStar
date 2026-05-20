import { Loader2, Lock, Send } from "lucide-react";
import { useCallback, useRef, useState } from "react";

interface ChatInputProps {
  onSend: (text: string) => void;
  onTyping?: () => void;
  disabled?: boolean;
  isEncrypted?: boolean;
}

export function ChatInput({ onSend, onTyping, disabled, isEncrypted = true }: ChatInputProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || disabled || sending) return;

    setSending(true);
    try {
      await onSend(trimmed);
      setText("");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [text, disabled, sending, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    clearTimeout(typingTimer.current);
    onTyping?.();
    typingTimer.current = setTimeout(() => {}, 2000);
  };

  return (
    <div className="flex items-center gap-2 p-3 border-t bg-background">
      {isEncrypted && (
        <Lock className="w-3.5 h-3.5 text-emerald-500 shrink-0" aria-label="Crittografato end-to-end" />
      )}
      <input
        ref={inputRef}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Scrivi un messaggio..."
        disabled={disabled}
        className="flex-1 text-sm bg-muted/50 rounded-full px-4 py-2 outline-none focus:ring-2 focus:ring-primary/30 border border-border disabled:opacity-50"
      />
      <button
        onClick={handleSend}
        disabled={!text.trim() || disabled || sending}
        className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
      </button>
    </div>
  );
}
