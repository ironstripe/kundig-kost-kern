import { Pencil, Plus, Trash2 } from "lucide-react";
import { MetricValue } from "@/components/dishes/Metric";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatQuantity } from "@/lib/format";
import {
  calcModeLabels,
  eventCategoryLabels,
  eventSectionOrder,
  eventSectionTitles,
  valueStatusLabels,
} from "@/lib/event-labels";
import type { EventResult } from "@/lib/event-costing";
import type { EventLineRow } from "@/lib/events";

type Props = {
  result: EventResult;
  onAdd: (kind: EventResult["revenue"]["kind"]) => void;
  onEdit: (line: EventLineRow) => void;
  onDelete: (line: EventLineRow) => void;
};

export function EventSections({ result, onAdd, onEdit, onDelete }: Props) {
  return (
    <>
      {eventSectionOrder.map((kind) => {
        const lines = result.lines.filter((r) => r.line.kind === kind);
        return (
          <section key={kind} className="surface mb-6">
            <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
              <h2 className="text-sm font-semibold">{eventSectionTitles[kind]}</h2>
              <Button size="sm" variant="outline" onClick={() => onAdd(kind)}>
                <Plus className="size-4" /> Position
              </Button>
            </div>
            {lines.length === 0 ? (
              <p className="px-5 py-5 text-sm text-muted-foreground">Keine Positionen in diesem Abschnitt.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Position</TableHead>
                      <TableHead>Kategorie</TableHead>
                      <TableHead>Berechnung</TableHead>
                      <TableHead className="text-right">Plan Betrag</TableHead>
                      <TableHead className="text-right">Plan Menge</TableHead>
                      <TableHead className="text-right">Plan total</TableHead>
                      <TableHead className="text-right">Ist total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((r) => (
                      <TableRow key={r.line.id}>
                        <TableCell>
                          <div className="font-medium">{r.line.name}</div>
                          {r.line.notes && <div className="max-w-md text-xs text-muted-foreground">{r.line.notes}</div>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {eventCategoryLabels[r.line.category] ?? r.line.category}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{calcModeLabels[r.line.calc_mode]}</TableCell>
                        <TableCell className="text-right">
                          <MetricValue value={r.line.planned_unit_amount === null ? null : Number(r.line.planned_unit_amount)} kind="chf" />
                        </TableCell>
                        <TableCell className="text-right tabular">
                          {r.line.planned_quantity === null ? (
                            <span className="text-xs text-muted-foreground italic">offen</span>
                          ) : (
                            formatQuantity(Number(r.line.planned_quantity))
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <MetricValue
                            value={r.plannedTotal}
                            kind="chf"
                            problems={r.missing ? ["Pflichtwert offen – wird nicht als Null gerechnet."] : undefined}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <MetricValue value={r.actualTotal} kind="chf" />
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            tone={
                              r.line.value_status === "effective" || r.line.value_status === "confirmed"
                                ? "success"
                                : r.line.value_status === "open"
                                  ? "warning"
                                  : "muted"
                            }
                          >
                            {valueStatusLabels[r.line.value_status]}
                          </StatusBadge>
                          {r.line.kind === "informational" && (
                            <div className="mt-1 text-xs text-muted-foreground">ohne Wirkung auf DB</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => onEdit(r.line)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => onDelete(r.line)}>
                            <Trash2 className="size-4" />
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
      })}
    </>
  );
}
