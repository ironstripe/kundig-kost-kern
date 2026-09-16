import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parseDecimal } from "@/lib/format";
import { assumptionOriginLabels, assumptionUnitLabels } from "@/lib/event-labels";
import {
  adoptCurrentDefault,
  copyDefaultsToEvent,
  defaultsForType,
  eventAssumptionsQuery,
  overrideEventAssumption,
} from "@/lib/event-assumptions";
import { eventAssumptionValuesQuery, type Event } from "@/lib/events";

export function EventAssumptionsPanel({ event }: { event: Event }) {
  const qc = useQueryClient();
  const { data: globals } = useQuery(eventAssumptionsQuery);
  const { data: values } = useQuery(eventAssumptionValuesQuery(event.id));
  const defaults = defaultsForType(globals ?? [], event.event_type);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["event_assumption_values", event.id] });

  const save = async (id: string, raw: string) => {
    const v = raw.trim() === "" ? null : parseDecimal(raw);
    if (v !== null && (!Number.isFinite(v) || v < 0)) {
      toast.error("Wert muss eine Zahl ab 0 sein. Leer bedeutet «offen».");
      return;
    }
    await overrideEventAssumption(id, v);
    await invalidate();
    toast.success("Annahme für diesen Event angepasst.");
  };

  return (
    <section className="surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold">Annahmen dieses Events</h2>
          <p className="text-xs text-muted-foreground">
            Die zentralen Standardwerte wurden beim Anlegen kopiert. Spätere Änderungen am Standard verändern diesen
            Event nicht automatisch.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await copyDefaultsToEvent(event.id, globals ?? [], event.event_type);
            await invalidate();
            toast.success("Fehlende Standardannahmen ergänzt.");
          }}
        >
          Fehlende Standards ergänzen
        </Button>
      </div>

      {(values ?? []).length === 0 ? (
        <p className="px-5 py-5 text-sm text-muted-foreground">Für diesen Event sind keine Annahmen hinterlegt.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Annahme</TableHead>
                <TableHead>Einheit</TableHead>
                <TableHead className="w-36 text-right">Wert im Event</TableHead>
                <TableHead className="text-right">Aktueller Standard</TableHead>
                <TableHead>Herkunft</TableHead>
                <TableHead className="w-52" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(values ?? []).map((v) => {
                const current = defaults.find((d) => d.key === v.key) ?? null;
                const differs = current !== null && Number(current.value) !== Number(v.value);
                return (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.label}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{assumptionUnitLabels[v.unit]}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        className="h-8 text-right"
                        defaultValue={v.value === null ? "" : String(v.value)}
                        onBlur={(e) => save(v.id, e.target.value)}
                        aria-label={`Wert ${v.label}`}
                      />
                    </TableCell>
                    <TableCell className="text-right tabular">{current ? String(current.value) : "–"}</TableCell>
                    <TableCell>
                      <StatusBadge tone={v.origin === "manual_override" ? "warning" : "muted"}>
                        {assumptionOriginLabels[v.origin]}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-right">
                      {current && differs && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            await adoptCurrentDefault(v.id, current);
                            await invalidate();
                            toast.success("Aktueller Standard übernommen.");
                          }}
                        >
                          Aktuellen Standard übernehmen
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
