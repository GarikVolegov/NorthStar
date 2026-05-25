import { cn } from "@/lib/utils";
import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { CareerStep, ChartEntry } from "./sectorTypes";

export const GrowthChart = React.memo(function GrowthChart({
  data,
}: {
  data: ChartEntry[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          dy={10}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          tickFormatter={(v) => `+${v}%`}
        />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
          contentStyle={{
            borderRadius: "12px",
            border: "1px solid hsl(var(--border))",
            boxShadow: "var(--shadow-md)",
          }}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});

type CareerStepListProps = {
  steps: CareerStep[];
  stepGroup: string;
  pathKey: "dipendente" | "freelance";
  activeColor: "blue" | "violet";
  t: (key: string, opts?: Record<string, unknown>) => string;
};

export const CareerStepList = React.memo(function CareerStepList({
  steps,
  stepGroup,
  pathKey,
  activeColor,
  t,
}: CareerStepListProps) {
  const ring =
    activeColor === "blue"
      ? "bg-blue-100 border-blue-300 text-blue-700"
      : "bg-violet-100 border-violet-300 text-violet-700";
  const line = activeColor === "blue" ? "bg-blue-100" : "bg-violet-100";

  return (
    <div className="space-y-0">
      {steps.map((step, index) => (
        <div key={step.step} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className={cn("w-9 h-9 rounded-full border-2 flex items-center justify-center shrink-0 font-bold text-sm", ring)}>
              {step.step}
            </div>
            {index < steps.length - 1 && <div className={cn("w-0.5 h-full mt-1", line)} />}
          </div>
          <div className="pb-8">
            <h4 className="font-semibold text-foreground mb-1">
              {t(`careerSteps.${pathKey}.${stepGroup}.${step.step}.title`, {
                defaultValue: step.title,
              })}
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t(`careerSteps.${pathKey}.${stepGroup}.${step.step}.desc`, {
                defaultValue: step.description,
              })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
});
