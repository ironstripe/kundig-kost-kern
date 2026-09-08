import { useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import type { LinePair } from "@/lib/scenario-compare";
import { COMPLETED_IN_SCENARIO_LABEL } from "@/lib/scenario-compare";
import { MetricValue } from "@/components/dishes/Metric";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDiff } from "./ScenarioInput";
import { cn } from "@/lib/utils";

type SortKey = "category" | "dish" | "name" | "dbBase" | "dbScen" | "perSale" | "totalBase" | "totalScen" | "total";

export function ImpactTable({ pairs, onOpen }: { pairs: LinePair[]; onOpen: (p: LinePair) => void }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "total", dir: -1 });
  const affected = useMemo(() => pairs.filter((p) => p.affected), [pairs]);

  const sorted = useMemo(() => {
    const val = (p: LinePair): number | string | null => {
      switch (sort.key) {
        case "category":
          return p.categoryName;
        case "dish":
          return p.dishName;
        case "name":
          return p.name;
        case "dbBase":
          return p.base.result.contributionMargin1;
        case "dbScen":
          return p.scen.result.contributionMargin1;
        case "perSale":
          return p.perSaleDiff === null ? null : Math.abs(p.perSaleDiff);
        case "totalBase":
          return p.base.contributionMargin1;
        case "totalScen":
          return p.scen.contributionMargin1;
        default:
          return p.totalDiff === null ? null : Math.abs(p.totalDiff);
      }
    };
    return [...affected].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      if (typeof va === "string" && typeof vb === "string") return va.localeCompare(vb, "de-CH") * sort.dir;
      return ((va as number) - (vb as number)) * sort.dir;
    });
  }, [affected, sort]);

  const Th = ({ k, children, right }: { k: SortKey; children: React.ReactNode; right?: boolean }) => (
    <TableHead className={cn(right && "text-right")}>
      <button
        type="button"
        onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? (s.dir === 1 ? -1 : 1) : -1 }))}
        className={cn("inline-flex items-center gap-1 hover:text-foreground", sort.key === k && "text-foreground")}
      >
        {children}
        <ArrowUpDown className="size-3 opacity-60" />
      </button>
    </TableHead>
  );

  return (
    <section className="surface">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold">Auswirkung je Variante und Add-on</h2>
          <p className="text-xs text-muted-foreground">Nur Positionen, deren Ergebnis sich im Szenario ändert. Standard: grösste Gesamtdifferenz zuerst.</p>
        </div>
        <StatusBadge tone={affected.length ? "neutral" : "muted"}>{affected.length} betroffen</StatusBadge>
      </header>
      {affected.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Keine Position ist von temporären Änderungen betroffen.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <Th k="category">Kategorie</Th>
                <Th k="dish">Gericht</Th>
                <Th k="name">Variante/Add-on</Th>
                <Th k="dbBase" right>DB I Basis</Th>
                <Th k="dbScen" right>DB I Szenario</Th>
                <Th k="perSale" right>Differenz pro Verkauf</Th>
                <Th k="totalBase" right>Gesamt-DB I Basis</Th>
                <Th k="totalScen" right>Gesamt-DB I Szenario</Th>
                <Th k="total" right>Gesamtdifferenz</Th>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((p) => (
                <TableRow key={p.key} className="cursor-pointer" onClick={() => onOpen(p)}>
                  <TableCell className="text-muted-foreground">{p.categoryName}</TableCell>
                  <TableCell>{p.dishName}</TableCell>
                  <TableCell>
                    <span className="flex flex-wrap items-center gap-2">
                      {p.name}
                      {p.kind === "add_on" ? <StatusBadge tone="warning">Add-on</StatusBadge> : <StatusBadge tone="muted">Variante</StatusBadge>}
                      {p.completedInScenario && <StatusBadge tone="neutral">{COMPLETED_IN_SCENARIO_LABEL}</StatusBadge>}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    <MetricValue value={p.base.result.contributionMargin1} kind="chf" problems={p.base.result.problems} />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <MetricValue value={p.scen.result.contributionMargin1} kind="chf" problems={p.scen.result.problems} />
                  </TableCell>
                  <TableCell className="text-right tabular">{formatDiff(p.base.result.contributionMargin1, p.scen.result.contributionMargin1, "chf")}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    <MetricValue value={p.base.contributionMargin1} kind="chf" problems={p.base.exclusionReasons} />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <MetricValue value={p.scen.contributionMargin1} kind="chf" problems={p.scen.exclusionReasons} />
                  </TableCell>
                  <TableCell className="text-right tabular font-medium">{formatDiff(p.base.contributionMargin1, p.scen.contributionMargin1, "chf")}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); onOpen(p); }}>
                      Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
