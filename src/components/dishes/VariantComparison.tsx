import { useMemo, useState } from "react";
import { compareQuantities, compareVariants, type QuantityComparisonKind, type VariantResult } from "@/lib/costing";
import { formatCHF, formatQuantity } from "@/lib/format";
import { baseUnitLabels, metricExplanations } from "@/lib/labels";
import { DeltaValue, MetricValue } from "./Metric";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type Props = {
  /** All variant results of the dish; the first is pre-selected as A. */
  results: VariantResult[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const kindLabels: Record<QuantityComparisonKind, string> = {
  shared_equal: "gleiche Menge",
  shared_different: "abweichende Menge",
  only_first: "nur in A",
  only_second: "nur in B",
  mixed: "",
};

const kindOrder: Record<QuantityComparisonKind, number> = {
  shared_different: 0,
  only_first: 1,
  only_second: 2,
  shared_equal: 3,
  mixed: 4,
};

export function VariantComparisonDialog({ results, open, onOpenChange }: Props) {
  const [aId, setAId] = useState(results[0]?.variant.id ?? "");
  const [bId, setBId] = useState(results.find((r) => r.variant.id !== results[0]?.variant.id)?.variant.id ?? "");

  const pair = useMemo(() => {
    const a = results.find((r) => r.variant.id === aId);
    const b = results.find((r) => r.variant.id === bId);
    return a && b ? [a, b] : [];
  }, [results, aId, bId]);

  const metrics = compareVariants(pair);
  const quantities = useMemo(
    () => compareQuantities(pair).sort((x, y) => kindOrder[x.kind] - kindOrder[y.kind] || x.ingredientName.localeCompare(y.ingredientName, "de-CH")),
    [pair],
  );
  const [a, b] = pair;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Variantenvergleich</DialogTitle>
          <DialogDescription>
            Zwei Varianten desselben Gerichts nebeneinander. Differenzen sind B minus A (CHF bzw. Prozentpunkte). {metricExplanations.margin}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Variante A</Label>
            <Select value={aId} onValueChange={setAId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {results.map((r) => <SelectItem key={r.variant.id} value={r.variant.id}>{r.variant.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Variante B</Label>
            <Select value={bId} onValueChange={setBId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {results.map((r) => <SelectItem key={r.variant.id} value={r.variant.id}>{r.variant.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {pair.length === 2 && a && b && aId !== bId ? (
          <>
            <div className="surface overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kennzahl</TableHead>
                    <TableHead className="text-right">A · {a.variant.name}</TableHead>
                    <TableHead className="text-right">B · {b.variant.name}</TableHead>
                    <TableHead className="text-right">Differenz B − A</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.map((m) => (
                    <TableRow key={m.key} className={m.key === "contributionMargin1" ? "font-medium" : undefined}>
                      <TableCell>{m.label}</TableCell>
                      <TableCell className="text-right"><MetricValue value={m.values[0] ?? null} kind={m.kind} problems={a.problems} /></TableCell>
                      <TableCell className="text-right"><MetricValue value={m.values[1] ?? null} kind={m.kind} problems={b.problems} /></TableCell>
                      <TableCell className="text-right"><DeltaValue value={m.deltas[1] ?? null} kind={m.kind} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <h3 className="mt-4 text-sm font-semibold">Mengen und Kosten je Zutat</h3>
            <div className="surface overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zutat</TableHead>
                    <TableHead>Unterschied</TableHead>
                    <TableHead className="text-right">A · {a.variant.name}</TableHead>
                    <TableHead className="text-right">B · {b.variant.name}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quantities.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">Keine Kalkulationspositionen vorhanden.</TableCell></TableRow>
                  )}
                  {quantities.map((row) => (
                    <TableRow key={row.ingredientId} className={row.kind === "shared_equal" ? "text-muted-foreground" : undefined}>
                      <TableCell className="font-medium">{row.ingredientName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{kindLabels[row.kind]}</TableCell>
                      {row.quantities.map((q, i) => (
                        <TableCell key={i} className="text-right">
                          {q === null ? (
                            <span className="text-muted-foreground">nicht enthalten</span>
                          ) : (
                            <div className="flex flex-col items-end">
                              <span className="tabular">{formatQuantity(q, baseUnitLabels[row.unit])}</span>
                              <span className="text-xs text-muted-foreground tabular">{row.costs[i] !== null ? formatCHF(row.costs[i]!) : "–"}</span>
                            </div>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Bitte zwei unterschiedliche Varianten auswählen.</p>
        )}
        <p className="text-xs text-muted-foreground">
          Ein höherer DB I in CHF ist nicht dasselbe wie eine höhere DB-I-Marge. Alle Werte sind DB I nach Wareneinsatz, kein Gewinn.
        </p>
      </DialogContent>
    </Dialog>
  );
}
