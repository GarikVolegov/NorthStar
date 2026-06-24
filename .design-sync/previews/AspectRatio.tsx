import { AspectRatio } from "@northstar/web";

export const Ratios = () => (
  <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
    <div style={{ width: 220 }}>
      <AspectRatio ratio={16 / 9}>
        <div className="flex h-full w-full items-center justify-center rounded-md bg-primary/10 text-sm font-medium text-primary">16 : 9</div>
      </AspectRatio>
    </div>
    <div style={{ width: 150 }}>
      <AspectRatio ratio={1}>
        <div className="flex h-full w-full items-center justify-center rounded-md bg-muted text-sm font-medium">1 : 1</div>
      </AspectRatio>
    </div>
  </div>
);
