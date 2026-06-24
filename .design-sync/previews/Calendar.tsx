import { Calendar } from "@northstar/web";

export const Default = () => (
  <Calendar
    mode="single"
    defaultMonth={new Date(2026, 5, 1)}
    selected={new Date(2026, 5, 12)}
    className="rounded-md border"
  />
);
