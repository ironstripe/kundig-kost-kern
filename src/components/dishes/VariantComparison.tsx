import { compareQuantities, compareVariants, type VariantResult } from "@/lib/costing";
import { formatCHF, formatQuantity } from "@/lib/format";
import { baseUnitLabels, metricExplanations } from "@/lib/labels";
import { DeltaValue, MetricValue } from "./Metric";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Props = {
  results: VariantResult[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function VariantComparisonDialog({ results, open, onOpenChange }: Props) {
  const metrics = compareVariants(results);
  const quantities = compareQuantities(results);
  const base = results[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Variantenvergleich</DialogTitle>
          <DialogDescription>
            Differenzen beziehen sich auf «{base?.variant.name}». {metricExplanations.margin}
          </DialogDescription>
        </DialogHeader>

        <div className="surface overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kennzahl</TableHead>
                {results.map((r, i) => (
                  <TableHead key={r.variant.id} className="text-right">
                    {r.variant.name}
                    {i === 0 && <span className="ml-1 text-xs font-normal text-muted-foreground">(Basis)</span>}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.map((m) => (
                <TableRow key={m.key} className={m.key === "contributionMargin1" ? "font-medium" : undefined}>
                  <TableCell>{m.label}</TableCell>
                  {m.values.map((v, i) => (
                    <TableCell key={i} className="text-right">
                      <div className="flex flex-col items-end">
                        <MetricValue value={v} kind={m.kind} problems={results[i].problems} />
                        {i > 0 && <span className="text-xs"><DeltaValue value={m.deltas[i]} kind={m.kind} /></span>}
                      </div>
                    </TableCell>
                  ))}
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
                {results.map((r) => (
                  <TableHead key={r.variant.id} className="text-right">{r.variant.name}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {quantities.map((row) => (
                <TableRow key={row.ingredientId}>
                  <TableCell>{row.ingredientName}</TableCell>
                  {row.quantities.map((q, i) => (
                    <TableCell key={i} className="text-right">
                      {q === null ? (
                        <span className="text-muted-foreground">nicht enthalten</span>
                      ) : (
                        <div className="flex flex-col items-end">
                          <span className="tabular">{formatQuantity(q, baseUnitLabels[row.unit])}</span>
                          <span className="text-xs text-muted-foreground tabular">
                            {row.costs[i] !== null ? formatCHF(row.costs[i]!) : "–"}
                          </span>
                        </div>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">
          Ein höherer DB I in CHF ist nicht dasselbe wie eine höhere DB-I-Marge. Alle Werte sind DB I nach Wareneinsatz, kein Gewinn.
        </p>
      </DialogContent>
    </Dialog>
  );
}
