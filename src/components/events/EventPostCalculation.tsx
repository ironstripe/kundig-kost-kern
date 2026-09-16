import { DeltaValue, MetricValue } from "@/components/dishes/Metric";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { eventCategoryLabels, eventLineKindLabels } from "@/lib/event-labels";
import { calculateEvent, type EventResult } from "@/lib/event-costing";
import type { Event, EventLineRow } from "@/lib/events";

/** Actual-value result: the same engine, applied to the effective values. */
function actualResult(lines: EventLineRow[], event: Event): EventResult {
  const asPlanned = lines.map((l) => ({
    ...l,
    planned_unit_amount: l.actual_unit_amount,
    planned_quantity: l.actual_quantity,
  }));
  return calculateEvent(asPlanned, {
    planned_paying_guests: event.actual_paying_guests ?? event.planned_paying_guests,
  });
}

export function EventPostCalculation({
  event,
  lines,
  planned,
  onEditLine,
}: {
  event: Event;
  lines: EventLineRow[];
  planned: EventResult;
  onEditLine: (line: EventLineRow) => void;
}) {
  const actual = actualResult(lines, event);

  const summary: { label: string; plan: number | null; ist: number | null }[] = [
    { label: "Brutto-Erlös", plan: planned.grossRevenue, ist: actual.grossRevenue },
    { label: "Variable Kosten", plan: planned.variableCosts, ist: actual.variableCosts },
    { label: "DB I", plan: planned.contributionMargin1, ist: actual.contributionMargin1 },
    { label: "Personal", plan: planned.personnelCosts, ist: actual.personnelCosts },
    { label: "Direkte Fixkosten", plan: planned.fixedCosts, ist: actual.fixedCosts },
    { label: "DB II", plan: planned.contributionMargin2, ist: actual.contributionMargin2 },
  ];

  return (
    <div className="space-y-6">
      <section className="surface px-5 py-4">
        <h2 className="section-title">Plan / Ist im Überblick</h2>
        <div className="mt-3 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kennzahl</TableHead>
                <TableHead className="text-right">Plan</TableHead>
                <TableHead className="text-right">Ist</TableHead>
                <TableHead className="text-right">Abweichung</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.map((r) => (
                <TableRow key={r.label}>
                  <TableCell>{r.label}</TableCell>
                  <TableCell className="text-right">
                    <MetricValue value={r.plan} kind="chf" problems={planned.openPositions} />
                  </TableCell>
                  <TableCell className="text-right">
                    <MetricValue value={r.ist} kind="chf" problems={actual.openPositions} />
                  </TableCell>
                  <TableCell className="text-right">
                    <DeltaValue value={r.plan !== null && r.ist !== null ? r.ist - r.plan : null} kind="chf" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Gäste: geplant {event.planned_paying_guests ?? "offen"} zahlend, effektiv {event.actual_paying_guests ?? "offen"} zahlend.
        </p>
      </section>

      <section className="surface">
        <div className="border-b px-5 py-3">
          <h2 className="text-sm font-semibold">Abweichungen pro Position</h2>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Position</TableHead>
                <TableHead>Abschnitt</TableHead>
                <TableHead className="text-right">Plan</TableHead>
                <TableHead className="text-right">Ist</TableHead>
                <TableHead className="text-right">Abweichung</TableHead>
                <TableHead className="text-right">in %</TableHead>
                <TableHead>Begründung</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {planned.lines.map((r) => (
                <TableRow key={r.line.id}>
                  <TableCell>
                    <div className="font-medium">{r.line.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {eventCategoryLabels[r.line.category] ?? r.line.category}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{eventLineKindLabels[r.line.kind]}</TableCell>
                  <TableCell className="text-right">
                    <MetricValue value={r.plannedTotal} kind="chf" />
                  </TableCell>
                  <TableCell className="text-right">
                    <MetricValue value={r.actualTotal} kind="chf" />
                  </TableCell>
                  <TableCell className="text-right">
                    <DeltaValue value={r.deltaAbsolute} kind="chf" />
                  </TableCell>
                  <TableCell className="text-right">
                    <DeltaValue value={r.deltaPercent} kind="percent" />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.line.variance_note ?? (r.deltaAbsolute !== null && r.deltaAbsolute !== 0 ? "–" : "")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => onEditLine(r.line)}>
                      Ist erfassen
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {actual.openPositions.length > 0 && (
        <StatusBadge tone="warning">
          Noch offene Ist-Werte: {actual.openPositions.join(", ")}
        </StatusBadge>
      )}
    </div>
  );
}
