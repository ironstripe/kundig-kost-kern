import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { parseDecimal } from "@/lib/format";
import { assumptionUnitLabels, eventTypeLabels } from "@/lib/event-labels";
import {
  createEventAssumption,
  deleteEventAssumption,
  eventAssumptionsQuery,
  updateEventAssumption,
  type EventType,
} from "@/lib/event-assumptions";
import { BEER_DINE_KEY, demoSeedQuery, ensureBeerDineDemo, removeBeerDineDemo } from "@/lib/demo-events";
import type { Database } from "@/integrations/supabase/types";

type Unit = Database["public"]["Enums"]["assumption_unit"];

export function GlobalAssumptionsPanel({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const { data: assumptions } = useQuery(eventAssumptionsQuery);
  const { data: seed } = useQuery(demoSeedQuery(BEER_DINE_KEY));
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState<Unit>("chf_per_hour");
  const [type, setType] = useState<EventType | "all">("all");
  const [busy, setBusy] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["event_assumptions"] });

  const save = async (id: string, raw: string) => {
    const v = raw.trim() === "" ? null : parseDecimal(raw);
    if (v !== null && (!Number.isFinite(v) || v < 0)) {
      toast.error("Wert muss eine Zahl ab 0 sein.");
      return;
    }
    await updateEventAssumption(id, { value: v }, userId);
    await invalidate();
    toast.success("Standardwert gespeichert. Bestehende Events bleiben unverändert.");
  };

  const add = async () => {
    if (!key.trim() || !label.trim()) {
      toast.error("Schlüssel und Bezeichnung sind erforderlich.");
      return;
    }
    const v = value.trim() === "" ? null : parseDecimal(value);
    if (v !== null && (!Number.isFinite(v) || v < 0)) {
      toast.error("Wert muss eine Zahl ab 0 sein.");
      return;
    }
    setBusy(true);
    try {
      await createEventAssumption(
        { key: key.trim(), label: label.trim(), value: v, unit, event_type: type === "all" ? null : type },
        userId,
      );
      await invalidate();
      setOpen(false);
      setKey("");
      setLabel("");
      setValue("");
      toast.success("Standardannahme angelegt.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="surface mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold">Zentrale Eventannahmen</h2>
          <p className="text-xs text-muted-foreground">
            Diese Werte sind nur Standards. Beim Anlegen eines Events werden sie in den Event kopiert; spätere
            Änderungen wirken nie rückwirkend.
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Annahme
          </Button>
        )}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bezeichnung</TableHead>
              <TableHead>Eventtyp</TableHead>
              <TableHead>Einheit</TableHead>
              <TableHead className="w-36 text-right">Standardwert</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(assumptions ?? []).map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <div className="font-medium">{a.label}</div>
                  <div className="text-xs text-muted-foreground">{a.key}</div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {a.event_type ? eventTypeLabels[a.event_type] : "Alle Eventtypen"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{assumptionUnitLabels[a.unit]}</TableCell>
                <TableCell className="text-right">
                  {isAdmin ? (
                    <Input
                      className="h-8 text-right"
                      defaultValue={a.value === null ? "" : String(a.value)}
                      onBlur={(e) => save(a.id, e.target.value)}
                      aria-label={`Standardwert ${a.label}`}
                    />
                  ) : (
                    <span className="tabular">{a.value === null ? "–" : String(a.value)}</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await deleteEventAssumption(a.id);
                        await invalidate();
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {isAdmin && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4">
          <div>
            <h3 className="text-sm font-medium">Beer & Dine Demo</h3>
            <p className="text-xs text-muted-foreground">
              Klar gekennzeichneter Demo-Datensatz mit bewusst offenen Kosten.{" "}
              {seed?.removed_at && <StatusBadge tone="muted">bewusst entfernt</StatusBadge>}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await ensureBeerDineDemo(userId, true);
                  await qc.invalidateQueries({ queryKey: ["events"] });
                  await qc.invalidateQueries({ queryKey: ["demo_seeds", BEER_DINE_KEY] });
                  toast.success("Demo wiederhergestellt.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Demo wiederherstellen
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await removeBeerDineDemo();
                  await qc.invalidateQueries({ queryKey: ["events"] });
                  await qc.invalidateQueries({ queryKey: ["menus"] });
                  await qc.invalidateQueries({ queryKey: ["demo_seeds", BEER_DINE_KEY] });
                  toast.success("Demo entfernt. Sie wird nicht automatisch neu erstellt.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Demo entfernen
            </Button>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Standardannahme anlegen</DialogTitle>
            <DialogDescription>Der Wert wird beim Anlegen neuer Events kopiert.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="as-label">Bezeichnung</Label>
              <Input id="as-label" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="as-key">Schlüssel</Label>
              <Input id="as-key" value={key} onChange={(e) => setKey(e.target.value)} placeholder="z. B. service_hourly_rate" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="as-value">Wert</Label>
                <Input id="as-value" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Einheit</Label>
                <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(assumptionUnitLabels).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Gilt für</Label>
              <Select value={type} onValueChange={(v) => setType(v as EventType | "all")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Eventtypen</SelectItem>
                  {Object.entries(eventTypeLabels).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Abbrechen
            </Button>
            <Button onClick={add} disabled={busy}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
