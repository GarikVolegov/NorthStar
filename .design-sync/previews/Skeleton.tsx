import { Skeleton } from "@northstar/web";

export const Lines = () => (
  <div className="grid w-[320px] gap-2">
    <Skeleton className="h-4 w-[80%]" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-[60%]" />
  </div>
);

export const Card = () => (
  <div className="flex w-[340px] items-center gap-4">
    <Skeleton className="size-12 rounded-full" />
    <div className="grid flex-1 gap-2">
      <Skeleton className="h-4 w-[60%]" />
      <Skeleton className="h-4 w-[40%]" />
    </div>
  </div>
);
