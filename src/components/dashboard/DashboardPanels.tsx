import type { ReactNode } from "react";
import { Info } from "lucide-react";
import type { DataQuality, MenuTotals, OverallTotals } from "@/lib/menu-totals";
import { formatCHF, formatNumber, formatPercentPoints } from "@/lib/format";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const ASSUMPTION_NOTICE = "Diese Auswertung enthält Annahmen und dient noch nicht als Ist-Auswertung.";

function Kpi({ label, value, hint, emphasis }: { label: string; value: ReactNode; hint?: string; emphasis?: boolean }) {
  return (
    <div className={cn("surface px-5 py-4", emphasis && "border-primary/40")}>
      <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        {label}
        {hint && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help"><Info className="size-3.5" /></span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">{hint}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="mt-1.5 text-xl font-semibold tabular">{value}</div>
    </div>
  );
}

export function KpiCards({ overall }: { overall: OverallTotals | null }) {
  const chf = (v: number | undefined | null) => (v === null || v === undefined ? <span className="text-sm italic text-muted-foreground">Unvollständig</span> : formatCHF(v));
  const pct = (v: number | undefined | null) => (v === null || v === undefined ? <span className="text-sm italic text-muted-foreground">Unvollständig</span> : formatPercentPoints(v));
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Kpi label="Bruttoumsatz" value={chf(overall?.grossRevenue)} hint="Summe Brutto-VK × erwartete Verkäufe aller einbezogenen Positionen." />
      <Kpi label="Nettoumsatz" value={chf(overall?.netRevenue)} hint="Bruttoumsatz ohne 8.1 % MWST (Restaurant, kein Take-away)." />
      <Kpi label="Wareneinsatz" value={chf(overall?.foodCost)} hint="Zutatenkosten inkl. Kleinmaterial × erwartete Verkäufe." />
      <Kpi label="Gesamt-DB I" value={chf(overall?.contributionMargin1)} emphasis hint="Nettoumsatz minus Wareneinsatz. DB I ist kein Gewinn – Personal, Miete und weitere Kosten sind nicht enthalten." />
      <Kpi label="Wareneinsatzquote" value={pct(overall?.foodCostRatio)} hint="Gesamter Wareneinsatz ÷ gesamter Nettoumsatz. Aus Geldsummen berechnet, nicht als Durchschnitt der Einzelquoten." />
      <Kpi label="DB-I-Marge" value={pct(overall?.contributionMarginRatio)} hint="Gesamt-DB I ÷ gesamter Nettoumsatz. Aus Geldsummen berechnet." />
    </div>
  );
}

export function SecondaryCounts({ counts }: { counts: MenuTotals["counts"] }) {
  const items: { label: string; value: number; tone?: string | undefined }[] = [
    { label: "Gerichte", value: counts.dishes },
    { label: "Varianten", value: counts.variants },
    { label: "Add-ons", value: counts.addOns },
    { label: "Geschätzt", value: counts.estimated, tone: "text-warning-foreground" },
    { label: "Teilweise geprüft", value: counts.partiallyReviewed },
    { label: "Geprüft", value: counts.reviewed, tone: "text-accent-foreground" },
    { label: "Unvollständig", value: counts.incomplete, tone: counts.incomplete > 0 ? "text-destructive" : undefined },
  ];
  return (
    <dl className="surface grid grid-cols-2 gap-x-6 gap-y-3 px-5 py-4 sm:grid-cols-4 lg:grid-cols-7">
      {items.map((i) => (
        <div key={i.label}>
          <dt className="text-xs text-muted-foreground">{i.label}</dt>
          <dd className={cn("text-lg font-semibold tabular", i.tone)}>{formatNumber(i.value, 0)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DataQualityPanel({ quality }: { quality: DataQuality }) {
  const rows: { label: string; a: [string, number]; b: [string, number] }[] = [
    { label: "Einkaufspreise (verwendete Zutaten)", a: ["bestätigt", quality.confirmedPrices], b: ["geschätzt", quality.estimatedPrices] },
    { label: "Rezeptmengen", a: ["bestätigt", quality.confirmedQuantities], b: ["geschätzt / offen", quality.estimatedQuantities] },
    { label: "Kalkulationen", a: ["vollständig", quality.completeCalculations], b: ["unvollständig", quality.incompleteCalculations] },
  ];
  return (
    <section className="surface">
      <header className="border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold">Datenqualität</h2>
      </header>
      <ul className="divide-y divide-border">
        {rows.map((r) => {
          const total = r.a[1] + r.b[1];
          const pct = total > 0 ? (r.a[1] / total) * 100 : 0;
          return (
            <li key={r.label} className="px-5 py-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="tabular">
                  <span className="font-medium">{r.a[1]}</span> {r.a[0]} · <span className="font-medium">{r.b[1]}</span> {r.b[0]}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`${formatNumber(pct, 0)} % ${r.a[0]}`}>
                <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
