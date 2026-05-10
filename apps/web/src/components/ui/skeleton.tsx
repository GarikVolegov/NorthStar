import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "card" | "avatar" | "badge";
  lines?: number;
}

function Skeleton({ className, variant, lines = 1, ...props }: SkeletonProps) {
  const base = "shimmer rounded-md bg-primary/10";

  if (variant === "card") {
    return (
      <div className={cn("rounded-xl border border-border p-5 space-y-3", className)} {...props}>
        <div className={cn(base, "h-5 w-2/3 rounded")} />
        <div className={cn(base, "h-3 w-full rounded")} />
        <div className={cn(base, "h-3 w-4/5 rounded")} />
      </div>
    );
  }

  if (variant === "avatar") {
    return <div className={cn(base, "h-10 w-10 rounded-full", className)} {...props} />;
  }

  if (variant === "badge") {
    return <div className={cn(base, "h-5 w-16 rounded-full", className)} {...props} />;
  }

  if (variant === "text") {
    return (
      <div className={cn("space-y-2", className)} {...props}>
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className={cn(base, "h-3", i === lines - 1 ? "w-3/5" : "w-full")} />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(base, className)}
      {...props}
    />
  );
}

export { Skeleton };
