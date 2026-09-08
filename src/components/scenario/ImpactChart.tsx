import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, XAxis, YAxis } from "recharts";
import type { LinePair } from "@/lib/scenario-compare";
import { formatCHF } from "@/lib/format";
import { signed } from "@/lib/scenario-compare";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const config = {
  up: { label: "Zunahme", color: "var(--primary)" },
  down: { label: "Abnahme", color: "var(--warning)" },
} satisfies ChartConfig;

export function ImpactChart({ pairs }: { pairs: LinePair[] }) {
  const data = pairs
    .filter((p) => p.totalDiff !== null && Math.abs(p.totalDiff) > 0.005)
    .sort((a, b) => Math.abs(b.totalDiff ?? 0) - Math.abs(a.totalDiff ?? 0))
    .slice(0, 8)
    .map((p) => ({
      key: p.key,
      label: p.kind === "add_on" ? `${p.name} (Add-on)` : `${p.dishName.length > 22 ? p.dishName.slice(0, 21) + "…" : p.dishName} – ${p.name}`,
      value: Math.round((p.totalDiff ?? 0) * 100) / 100,
    }));
  const max = Math.max(1, ...data.map((d) => Math.abs(d.value)));

  return (
    <section className="surface">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold">Grösste Gesamt-DB-I-Differenzen</h2>
          <p className="text-xs text-muted-foreground">Bis zu 8 Positionen, nullzentriert. Exakte CHF-Werte über die Laufzeit.</p>
        </div>
        <ul className="flex gap-4 text-xs text-muted-foreground" aria-label="Legende">
          <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: "var(--primary)" }} />Zunahme</li>
          <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: "var(--warning)" }} />Abnahme</li>
        </ul>
      </header>
      {data.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Noch keine Gesamt-DB-I-Differenz im Szenario.</p>
      ) : (
        <div className="px-3 py-4">
          <ChartContainer config={config} className="aspect-auto w-full" style={{ height: Math.max(160, data.length * 40 + 24) }}>
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 110, top: 4, bottom: 4 }} barCategoryGap={8}>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <XAxis type="number" domain={[-max * 1.15, max * 1.15]} hide />
              <YAxis type="category" dataKey="label" width={250} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} tickFormatter={(v: string) => (v.length > 40 ? `${v.slice(0, 39)}…` : v)} />
              <ReferenceLine x={0} stroke="var(--border)" />
              <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(v) => signed(Number(v), (a) => formatCHF(a))} hideIndicator />} />
              <Bar dataKey="value" radius={3} isAnimationActive={false}>
                {data.map((d) => (
                  <Cell key={d.key} fill={d.value >= 0 ? "var(--primary)" : "var(--warning)"} />
                ))}
                <LabelList
                  dataKey="value"
                  content={(props) => {
                    const { x, y, width, height, value } = props as { x: number; y: number; width: number; height: number; value: number };
                    const positive = value >= 0;
                    const lx = positive ? x + width + 6 : x - 6;
                    return (
                      <text x={lx} y={y + height / 2} dy={4} fontSize={12} textAnchor={positive ? "start" : "end"} className="fill-foreground tabular">
                        {signed(value, (a) => formatCHF(a))}
                      </text>
                    );
                  }}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      )}
    </section>
  );
}
