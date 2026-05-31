import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { VitalSign } from "@workspace/api-client-react";
import { MessageCircle } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { STATUS_STYLES, VITAL_SIGN_META } from "./vital-signs-config";

interface VitalSignDetailProps {
  open: boolean;
  sign: VitalSign | null;
  sectorName: string;
  onOpenChange: (open: boolean) => void;
  onInterpret: (sign: VitalSign) => void;
}

export function VitalSignDetail({
  open,
  sign,
  sectorName,
  onOpenChange,
  onInterpret,
}: VitalSignDetailProps) {
  if (!sign) return null;
  const meta = VITAL_SIGN_META[sign.key]!;
  const status = STATUS_STYLES[sign.status]!;
  const Icon = meta.icon;
  const data = sign.sparkline.map((value: number, index: number) => ({ month: index + 1, value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            {meta.label} · {sectorName}
          </DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>

        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="value"
                stroke={status.stroke}
                fill={status.fill}
                fillOpacity={0.7}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Valore</p>
            <p className="font-mono text-lg font-bold">{Math.round(sign.value)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Delta trimestre</p>
            <p className="font-mono text-lg font-bold">{sign.delta > 0 ? "+" : ""}{sign.delta}%</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Fonte</p>
            <p className="text-xs text-foreground">{meta.sourceLabel}</p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => onInterpret(sign)}>
            <MessageCircle className="mr-2 h-4 w-4" />
            Interpreta con Wendy
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
