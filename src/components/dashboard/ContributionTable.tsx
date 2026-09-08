import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpDown } from "lucide-react";
import type { MenuLine } from "@/lib/menu-totals";
import type { CalculationStatus } from "@/lib/costing";
import { calculationStatusLabels } from "@/lib/labels";
import { formatNumber } from "@/lib/format";
import { MetricValue } from "@/components/dishes/Metric";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type SortKey = "sales" | "gross" | "net" | "foodCost" | "db1PerSale" | "db1" | "ratio" | "margin";

const statusTone: Record<CalculationStatus, "warning" | "neutral" | "success"> = {
  estimated: "warning",
  partially_reviewed: "neutral",
  reviewed: "success",
};

export function ContributionTable({ lines }: { lines: MenuLine[] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "db1", dir: -1 });
  const [category, setCategory] = useState("all");
  const [type, setType] = useState<"all" | "variant" | "add_on">("all");
  const [status, setStatus] = useState<"all" | CalculationStatus>("all");

  const catKey = (l: MenuLine) => (l.kind === "add_on" ? "add_ons" : (l.categoryId ?? "none"));
  const categories = useMemo(() => {
    const m = new Map<string, string>();
    lines.forEach((l) => m.set(catKey(l), l.categoryName));
    return Array.from(m.entries());
  }, [lines]);

  const filtered = useMemo(() => {
    const list = lines.filter((l) => {
      if (category !== "all" && catKey(l) !== category) return false;
      if (type !== "all" && l.kind !== type) return false;
      if (status !== "all" && l.status !== status) return false;
      return true;
    });
    const num = (v: number | null) => (v === null ? Number.NEGATIVE_INFINITY : v);
    const val = (l: MenuLine): number => {
      switch (sort.key) {
        case "sales": return num(l.total);
        case "gross": return num(l.grossRevenue);
        case "net": return num(l.netRevenue);
        case "foodCost": return num(l.foodCost);
        case "db1PerSale": return num(l.result.contributionMargin1);
        case "db1": return num(l.contributionMargin1);
        case "ratio": return num(l.result.foodCostRatio);
        case "margin": return num(l.result.contributionMarginRatio);
      }
    };
    return [...list].sort((a, b) => (val(a) - val(b)) * sort.dir || a.dishName.localeCompare(b.dishName, "de-CH"));
  }, [lines, category, type, status, sort]);

  const toggle = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: -1 }));

  const SortHead = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <TableHead className="text-right">
      <button type="button" onClick={() => toggle(k)} className={cn("inline-flex items-center gap-1 hover:text-foreground", sort.key === k && "text-foreground")}>
        {children}
        <ArrowUpDown className="size-3 opacity-60" />
      </button>
    </TableHead>
  );

  const activeFilters = [
    category !== "all" ? `Kategorie: ${categories.find(([k]) => k === category)?.[1]}` : null,
    type !== "all" ? `Typ: ${type === "variant" ? "Variante" : "Add-on"}` : null,
    status !== "all" ? `Status: ${calculationStatusLabels[status]}` : null,
  ].filter(Boolean) as string[];

  return (
    <section className="surface">
      <header className="flex flex-col gap-3 border-b border-border px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-semibold">Beitrag zur Gesamtwirtschaftlichkeit</h2>
          <p className="text-xs text-muted-foreground">Einbezogene Positionen. Filter wirken nur auf diese Tabelle – die Gesamtsummen oben bleiben unverändert.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Kategorien</SelectItem>
              {categories.map(([k, n]) => <SelectItem key={k} value={k}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
            <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Varianten & Add-ons</SelectItem>
              <SelectItem value="variant">Nur Varianten</SelectItem>
              <SelectItem value="add_on">Nur Add-ons</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              {(Object.keys(calculationStatusLabels) as CalculationStatus[]).map((s) => <SelectItem key={s} value={s}>{calculationStatusLabels[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </header>
      {activeFilters.length > 0 && (
        <p className="border-b border-border bg-secondary/40 px-5 py-2 text-xs text-muted-foreground">
          Aktive Filter: {activeFilters.join(" · ")} – {filtered.length} von {lines.length} Positionen angezeigt.
        </p>
      )}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kategorie</TableHead>
              <TableHead>Gericht</TableHead>
              <TableHead>Variante/Add-on</TableHead>
              <SortHead k="sales">Erw. Verkäufe</SortHead>
              <SortHead k="gross">Bruttoumsatz</SortHead>
              <SortHead k="net">Nettoumsatz</SortHead>
              <SortHead k="foodCost">Wareneinsatz</SortHead>
              <SortHead k="ratio">WE-Quote</SortHead>
              <SortHead k="db1PerSale">DB I pro Verkauf</SortHead>
              <SortHead k="margin">DB-I-Marge</SortHead>
              <SortHead k="db1">Gesamt-DB I</SortHead>
              <TableHead className="text-right">Anteil am Gesamt-DB I</TableHead>
              <TableHead>Kalkulationsstatus</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={13} className="py-8 text-center text-sm text-muted-foreground">Keine Positionen für die gewählten Filter.</TableCell></TableRow>
            )}
            {filtered.map((l) => (
              <TableRow key={l.key} className={cn(l.kind === "add_on" && "bg-secondary/40")}>
                <TableCell className="text-muted-foreground">{l.categoryName}</TableCell>
                <TableCell className="max-w-56 truncate">
                  {l.dishId ? <Link to="/gerichte/$dishId" params={{ dishId: l.dishId }} className="hover:underline">{l.dishName}</Link> : <span className="text-muted-foreground">{l.dishName}</span>}
                </TableCell>
                <TableCell>
                  <span className="font-medium">{l.kind === "add_on" ? <Link to="/gerichte/add-ons/$addOnId" params={{ addOnId: l.id }} className="hover:underline">{l.name}</Link> : l.name}</span>
                  {l.kind === "add_on" && <StatusBadge tone="neutral" className="ml-2">Add-on</StatusBadge>}
                </TableCell>
                <TableCell className="tabular text-right">{l.total === null ? "–" : formatNumber(l.total, Number.isInteger(l.total) ? 0 : 1)}</TableCell>
                <TableCell className="text-right"><MetricValue value={l.grossRevenue} kind="chf" /></TableCell>
                <TableCell className="text-right"><MetricValue value={l.netRevenue} kind="chf" /></TableCell>
                <TableCell className="text-right"><MetricValue value={l.foodCost} kind="chf" /></TableCell>
                <TableCell className="text-right"><MetricValue value={l.result.foodCostRatio} kind="percent" /></TableCell>
                <TableCell className="text-right"><MetricValue value={l.result.contributionMargin1} kind="chf" /></TableCell>
                <TableCell className="text-right"><MetricValue value={l.result.contributionMarginRatio} kind="percent" /></TableCell>
                <TableCell className="text-right font-medium"><MetricValue value={l.contributionMargin1} kind="chf" /></TableCell>
                <TableCell className="text-right"><MetricValue value={l.share} kind="percent" /></TableCell>
                <TableCell><StatusBadge tone={statusTone[l.status]}>{calculationStatusLabels[l.status]}</StatusBadge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
