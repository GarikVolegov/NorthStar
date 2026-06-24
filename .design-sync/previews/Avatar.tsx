import { Avatar, AvatarFallback } from "@northstar/web";

export const Fallbacks = () => (
  <div className="flex items-center gap-3">
    <Avatar><AvatarFallback>NS</AvatarFallback></Avatar>
    <Avatar><AvatarFallback>JD</AvatarFallback></Avatar>
    <Avatar><AvatarFallback className="bg-primary text-primary-foreground">AB</AvatarFallback></Avatar>
  </div>
);

export const Sizes = () => (
  <div className="flex items-center gap-3">
    <Avatar className="size-6"><AvatarFallback className="text-xs">S</AvatarFallback></Avatar>
    <Avatar><AvatarFallback>M</AvatarFallback></Avatar>
    <Avatar className="size-12"><AvatarFallback>L</AvatarFallback></Avatar>
    <Avatar className="size-16"><AvatarFallback className="text-lg">XL</AvatarFallback></Avatar>
  </div>
);

export const Stack = () => (
  <div className="flex -space-x-2">
    <Avatar className="ring-2 ring-background"><AvatarFallback>A</AvatarFallback></Avatar>
    <Avatar className="ring-2 ring-background"><AvatarFallback>B</AvatarFallback></Avatar>
    <Avatar className="ring-2 ring-background"><AvatarFallback>C</AvatarFallback></Avatar>
    <Avatar className="ring-2 ring-background"><AvatarFallback className="bg-muted">+5</AvatarFallback></Avatar>
  </div>
);
