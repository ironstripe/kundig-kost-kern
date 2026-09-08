import type { LinePair } from "@/lib/scenario-compare";
import { COMPLETED_IN_SCENARIO_LABEL } from "@/lib/scenario-compare";
import { baseUnitLabels } from "@/lib/labels";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { formatDiff, formatValue, type ValueKind } from "./ScenarioInput";
import { cn } from "@/lib/utils";

type Row = { label: string; base: number | null; scen: number | null; kind: ValueKind; unit?: string; section?: boolean; indent?: boolean };

const changed = (a: number | null, b: number | null) => !(a === b || (a !== null && b !== null && Math.abs(a - b) < 1e-9));

export function ScenarioDetailDialog({ pair, onClose }: { pair: LinePair | null; onClose: () => void }) {
  if (!pair) return null;
  const b = pair.base;
  const s = pair.scen;
  const rows: Row[] = [
    { label: "Verkaufspreis", base: null, scen: null, kind: "chf", section: true },
    { label: "Brutto-VK", base: b.result.grossPrice, scen: s.result.grossPrice, kind: "chf" },
    { label: "Netto-VK (ohne 8.1 % MWST)", base: b.result.netPrice, scen: s.result.netPrice, kind: "chf" },
    { label: "Rezeptmengen und Einkaufspreise", base: null, scen: null, kind: "chf", section: true },
  ];
  for (const r of b.result.items) {
    const sr = s.result.items.find((x) => x.item.id === r.item.id) ?? r;
    const name = r.ingredient?.name ?? "Zutat";
    const unit = baseUnitLabels[r.item.quantity_unit];
    rows.push({ label: `${name} – Menge`, base: Number(r.item.net_quantity), scen: Number(sr.item.net_quantity), kind: "quantity", unit, indent: true });
    rows.push({ label: `${name} – Ausbeute`, base: Number(r.item.yield_percent), scen: Number(sr.item.yield_percent), kind: "percent", indent: true });
    rows.push({ label: `${name} – Preis pro ${unit}`, base: r.unitPrice, scen: sr.unitPrice, kind: "chf", indent: true });
    rows.push({ label: `${name} – Kosten`, base: r.cost, scen: sr.cost, kind: "chf", indent: true });
  }
  rows.push(
    { label: "Ergebnis pro Verkauf", base: null, scen: null, kind: "chf", section: true },
    { label: "Zutatenkosten", base: b.result.ingredientCost, scen: s.result.ingredientCost, kind: "chf" },
    { label: "Kleinmaterial", base: b.result.smallMaterialCost, scen: s.result.smallMaterialCost, kind: "chf" },
    { label: "Wareneinsatz", base: b.result.foodCost, scen: s.result.foodCost, kind: "chf" },
    { label: "Wareneinsatzquote", base: b.result.foodCostRatio, scen: s.result.foodCostRatio, kind: "percent" },
    { label: "DB I", base: b.result.contributionMargin1, scen: s.result.contributionMargin1, kind: "chf" },
    { label: "DB-I-Marge", base: b.result.contributionMarginRatio, scen: s.result.contributionMarginRatio, kind: "percent" },
    { label: "Verkaufsmenge und Laufzeit", base: null, scen: null, kind: "chf", section: true },
    { label: "Verkäufe pro Öffnungstag", base: b.perDay, scen: s.perDay, kind: "count" },
    { label: "Verkäufe gesamt", base: b.total, scen: s.total, kind: "count" },
    { label: "Nettoumsatz gesamt", base: b.netRevenue, scen: s.netRevenue, kind: "chf" },
    { label: "Wareneinsatz gesamt", base: b.foodCost, scen: s.foodCost, kind: "chf" },
    { label: "Gesamt-DB I", base: b.contributionMargin1, scen: s.contributionMargin1, kind: "chf" },
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {pair.kind === "add_on" ? pair.name : `${pair.dishName} – ${pair.name}`}
            {pair.kind === "add_on" ? <StatusBadge tone="warning">Add-on</StatusBadge> : <StatusBadge tone="muted">Variante</StatusBadge>}
            <StatusBadge tone="neutral">Temporäres Szenario</StatusBadge>
          </DialogTitle>
          <DialogDescription>
            Basis und Szenario im Detail. Hervorgehoben sind nur geänderte Eingaben und daraus folgende Differenzen. Nichts davon wird gespeichert.
          </DialogDescription>
        </DialogHeader>
        {pair.completedInScenario && (
          <p className="rounded-md bg-secondary px-3 py-2 text-xs">{COMPLETED_IN_SCENARIO_LABEL}</p>
        )}
        {!s.result.complete && s.result.problems.length > 0 && (
          <p className="rounded-md bg-secondary px-3 py-2 text-xs text-muted-foreground">Unvollständig im Szenario: {s.result.problems.join("; ")}</p>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Grösse</TableHead>
              <TableHead className="text-right">Basis</TableHead>
              <TableHead className="text-right">Szenario</TableHead>
              <TableHead className="text-right">Differenz</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) =>
              r.section ? (
                <TableRow key={i} className="bg-secondary/40 hover:bg-secondary/40">
                  <TableCell colSpan={4} className="py-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {r.label}
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={i} className={cn(changed(r.base, r.scen) && "bg-primary/5")}>
                  <TableCell className={cn(r.indent && "pl-6 text-muted-foreground")}>{r.label}</TableCell>
                  <TableCell className="text-right tabular text-muted-foreground">{formatValue(r.base, r.kind, r.unit)}</TableCell>
                  <TableCell className={cn("text-right tabular", changed(r.base, r.scen) && "font-semibold")}>{formatValue(r.scen, r.kind, r.unit)}</TableCell>
                  <TableCell className="text-right tabular">{changed(r.base, r.scen) ? formatDiff(r.base, r.scen, r.kind, r.unit) : "–"}</TableCell>
                </TableRow>
              ),
            )}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}
