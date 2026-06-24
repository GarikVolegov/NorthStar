import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@northstar/web";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

const data = [
  { month: "Jan", value: 186 },
  { month: "Feb", value: 305 },
  { month: "Mar", value: 237 },
  { month: "Apr", value: 273 },
  { month: "May", value: 320 },
  { month: "Jun", value: 290 },
];

const config = { value: { label: "Revenue", color: "hsl(43 44% 44%)" } };

export const Bars = () => (
  <ChartContainer config={config} style={{ height: 220, width: 420 }}>
    <BarChart data={data}>
      <CartesianGrid vertical={false} />
      <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
      <ChartTooltip content={<ChartTooltipContent />} />
      <Bar dataKey="value" fill="hsl(43 44% 44%)" radius={4} />
    </BarChart>
  </ChartContainer>
);
