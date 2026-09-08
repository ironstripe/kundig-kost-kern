import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts";
import type { MenuLine } from "@/lib/menu-totals";
import { formatCHF, formatNumber } from "@/lib/format";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const config = {
  variant: { label: "Variante", color: "var(--primary)" },
  add_on: { label: "Add-on", color: "var(--warning)" },
} satisfies ChartConfig;

export function TopContributorsChart({ lines }: { lines: MenuLine[] }) {
  const data = [...lines]
    .filter((l) => l.contributionMargin1 !== null && l.contributionMargin1 > 0)
    .sort((a, b) => (b.contributionMargin1 ?? 0) - (a.contributionMargin1 ?? 0))
    .slice(0, 8)
    .map((l) => ({
      key: l.key,
      label: l.kind === "add_on" ? `${l.name} (Add-on)` : `${l.dishName.length > 22 ? l.dishName.slice(0, 21) + "…" : l.dishName} – ${l.name}`,
      value: Math.round((l.contributionMargin1 ?? 0) * 100) / 100,
      kind: l.kind,
    }));

  return (
    <section className="surface">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold">Grösste Beiträge zum Gesamt-DB I</h2>
          <p className="text-xs text-muted-foreground">Bis zu 8 Positionen, absteigend. Exakte CHF-Werte über die Laufzeit.</p>
        </div>
        <ul className="flex gap-4 text-xs text-muted-foreground" aria-label="Legende">
          <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: "var(--primary)" }} />Variante</li>
          <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: "var(--warning)" }} />Add-on</li>
        </ul>
      </header>
      {data.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Noch keine positiven DB-I-Beiträge berechenbar.</p>
      ) : (
        <div className="px-3 py-4">
          <ChartContainer config={config} className="aspect-auto w-full" style={{ height: Math.max(160, data.length * 40 + 24) }}>
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 96, top: 4, bottom: 4 }} barCategoryGap={8}>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="label"
                width={250}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12 }}
                tickFormatter={(v: string) => (v.length > 40 ? `${v.slice(0, 39)}…` : v)}
              />
              <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(v) => formatCHF(Number(v))} nameKey="kind" />} />
              <Bar dataKey="value" radius={3} isAnimationActive={false}>
                {data.map((d) => (
                  <Cell key={d.key} fill={d.kind === "add_on" ? "var(--warning)" : "var(--primary)"} />
                ))}
                <LabelList dataKey="value" position="right" formatter={(v: number) => `CHF ${formatNumber(v, 2)}`} className="fill-foreground" fontSize={12} />
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      )}
    </section>
  );
}
