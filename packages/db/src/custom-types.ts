import { customType } from "drizzle-orm/pg-core";

export const vector = customType<{
  data: number[];
  driverParam: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 1536})`;
  },
  fromDriver(value: unknown): number[] {
    if (typeof value === "string") {
      return value.slice(1, -1).split(",").map(Number);
    }
    if (Array.isArray(value)) return value;
    return [];
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
});
