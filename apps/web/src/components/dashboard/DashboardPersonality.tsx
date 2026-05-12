import { Radar, Bar } from "recharts";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, BarChart, Bar as BarChartBar, XAxis, YAxis, Tooltip } from "recharts";

const RIASEC_LABELS: Record<string, string> = {
  realistic: "Realistico",
  investigative: "Investigativo",
  artistic: "Artistico",
  social: "Sociale",
  enterprising: "Imprenditivo",
  conventional: "Convenzionale",
};

const SPIRIT_LABELS: Record<string, string> = {
  shen: "Presenza",
  hun: "Visione",
  po: "Istinto",
  yi: "Concentrazione",
  zhi: "Tenacia",
};

const SPIRIT_COLORS: Record<string, string> = {
  shen: "hsl(var(--chart-1))",
  hun: "hsl(var(--chart-2))",
  po: "hsl(var(--chart-3))",
  yi: "hsl(var(--chart-4))",
  zhi: "hsl(var(--chart-5))",
};

export function DashboardPersonality({
  riasecScores,
  spiritScores,
  primaryTypes,
}: {
  riasecScores?: Record<string, number>;
  spiritScores?: Record<string, number>;
  primaryTypes?: string[];
}) {
  const riasecData = riasecScores
    ? Object.entries(riasecScores).map(([k, v]) => ({
        area: RIASEC_LABELS[k] ?? k,
        valore: Math.round((v ?? 0) * 100),
      }))
    : [];

  const spiritData = spiritScores
    ? Object.entries(spiritScores).map(([k, v]) => ({
        name: SPIRIT_LABELS[k] ?? k,
        valore: Math.round((v ?? 0) * 100),
        fill: SPIRIT_COLORS[k] ?? "hsl(var(--chart-1))",
      }))
    : [];

  if (!riasecScores && !spiritScores) {
    return (
      <div className="rounded-2xl border bg-card p-5 text-center">
        <p className="text-sm text-muted-foreground">Completa il test di personalità per vedere il tuo profilo.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {riasecData.length > 0 && (
        <div className="rounded-2xl border bg-card p-5">
          <h3 className="font-semibold text-foreground text-sm mb-3">Profilo RIASEC</h3>
          {primaryTypes && primaryTypes.length > 0 && (
            <div className="flex gap-1.5 mb-3">
              {primaryTypes.map((t) => (
                <span key={t} className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5 font-medium">
                  {t}
                </span>
              ))}
            </div>
          )}
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={riasecData} cx="50%" cy="50%" outerRadius="65%">
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="area" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Profilo" dataKey="valore" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {spiritData.length > 0 && (
        <div className="rounded-2xl border bg-card p-5">
          <h3 className="font-semibold text-foreground text-sm mb-3">Bussola Interiore</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={spiritData} layout="vertical" margin={{ left: 10, right: 10 }}>
                <XAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={80} />
                <Tooltip />
                <BarChartBar dataKey="valore" radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
