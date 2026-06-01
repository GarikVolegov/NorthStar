import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface CapsuleTriggerProps {
  Icon: LucideIcon;
  title: string;
  description: string;
  accessory?: ReactNode;
}

export function CapsuleTrigger({
  Icon,
  title,
  description,
  accessory,
}: CapsuleTriggerProps) {
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-1 text-left md:flex-row md:items-center md:justify-between md:gap-6">
      <span className="flex min-w-0 items-center gap-2.5">
        <Icon className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-sm font-semibold text-foreground">{title}</span>
        {accessory}
      </span>
      <span className="text-xs font-normal leading-relaxed text-muted-foreground md:max-w-md md:text-right">
        {description}
      </span>
    </span>
  );
}
