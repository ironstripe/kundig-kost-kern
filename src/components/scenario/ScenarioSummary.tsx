import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { OverallTotals } from "@/lib/menu-totals";
import { formatCHF, formatNumber, formatPercentPoints } from "@/lib/format";
import { signed } from "@/lib/scenario-compare";
import { cn } from "@/lib/utils";

type Metric = { label: string; kind: "chf" | "percent"; base: number | null; scen: number | null };

function DirectionIcon({ d }: { d: number | null }) {
  if (d === null || Math.abs(d) < 1e-9) return <Minus className="size-3.5 text-muted-foreground" aria-label="unverändert" />;
  return d > 0 ? <ArrowUpRight className="size-3.5" aria-label="höher" /> : <ArrowDownRight className="size-3.5" aria-label="tiefer" />;
}

const missing = <span className="text-xs italic text-muted-foreground">Unvollständig</span>;

export function ScenarioSummary({
  base,
  scen,
  excludedBase,
  excludedScen,
  className,
}: {
  base: OverallTotals | null;
  scen: OverallTotals | null;
  excludedBase: number;
  excludedScen: number;
  className?: string;
}) {
  const metrics: Metric[] = [
    { label: "Nettoumsatz", kind: "chf", base: base?.netRevenue ?? null, scen: scen?.netRevenue ?? null },
    { label: "Wareneinsatz", kind: "chf", base: base?.foodCost ?? null, scen: scen?.foodCost ?? null },
    { label: "Gesamt-DB I", kind: "chf", base: base?.contributionMargin1 ?? null, scen: scen?.contributionMargin1 ?? null },
    { label: "Wareneinsatzquote", kind: "percent", base: base?.foodCostRatio ?? null, scen: scen?.foodCostRatio ?? null },
    { label: "DB-I-Marge", kind: "percent", base: base?.contributionMarginRatio ?? null, scen: scen?.contributionMarginRatio ?? null },
  ];
  const fmt = (v: number | null, kind: Metric["kind"]) => (v === null ? missing : kind === "chf" ? formatCHF(v) : formatPercentPoints(v));

  return (
    <section className={cn("surface", className)} aria-label="Vergleich Basis und Szenario">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-2.5">
        <h2 className="text-sm font-semibold">Gesamte Speisekarte: Basis vs. Szenario</h2>
        <p className="text-xs text-muted-foreground">
          {excludedBase > 0 || excludedScen > 0
            ? `Ausgeschlossen: ${excludedBase} (Basis) · ${excludedScen} (Szenario)`
            : "Alle aktiven Positionen einbezogen"}
        </p>
      </header>
      <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-5 lg:divide-x">
        {metrics.map((m) => {
          const d = m.base !== null && m.scen !== null ? m.scen - m.base : null;
          const changed = d !== null && Math.abs(d) > 1e-9;
          return (
            <div key={m.label} className="px-5 py-3">
              <div className="text-xs font-medium text-muted-foreground">{m.label}</div>
              <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
                <dt className="text-muted-foreground">Basis</dt>
                <dd className="text-right tabular">{fmt(m.base, m.kind)}</dd>
                <dt className="text-muted-foreground">Szenario</dt>
                <dd className={cn("text-right tabular", changed && "font-semibold")}>{fmt(m.scen, m.kind)}</dd>
                <dt className="text-muted-foreground">Differenz</dt>
                <dd className="flex items-center justify-end gap-1 text-right tabular">
                  <DirectionIcon d={d} />
                  {d === null
                    ? "–"
                    : m.kind === "chf"
                      ? signed(d, (a) => formatCHF(a))
                      : signed(d, (a) => `${formatNumber(a, 1)} %-Pkt.`)}
                </dd>
              </dl>
            </div>
          );
        })}
      </div>
    </section>
  );
}
