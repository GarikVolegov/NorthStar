import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent, Button } from "@northstar/web";

export const Default = () => (
  <TooltipProvider>
    <Tooltip open>
      <TooltipTrigger asChild><Button variant="outline">Hover me</Button></TooltipTrigger>
      <TooltipContent><p>Add to your watchlist</p></TooltipContent>
    </Tooltip>
  </TooltipProvider>
);
