interface StreamingIndicatorProps {
  isStreaming: boolean;
  label?: string;
}

export function StreamingIndicator({ isStreaming, label = "Sto elaborando..." }: StreamingIndicatorProps) {
  if (!isStreaming) return null;
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full animate-bounce"
            style={{
              backgroundColor: "var(--brand)",
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </span>
      <span>{label}</span>
    </div>
  );
}
