import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createEventLine, updateEventLine, type EventLineRow } from "@/lib/events";
import {
  EVENT_LINE_CATEGORIES,
  calcModeLabels,
  eventCategoryLabels,
  eventLineKindLabels,
  valueStatusLabels,
} from "@/lib/event-labels";
import { parseDecimal } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Enums = Database["public"]["Enums"];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  line?: EventLineRow | undefined;
  /** Pre-selected section when adding a new line. */
  defaultKind?: Enums["event_line_kind"] | undefined;
  /** Post-calculation mode focuses the actual values. */
  actualMode?: boolean | undefined;
};

function numOrNull(value: string): number | null | "invalid" {
  if (value.trim() === "") return null;
  const n = parseDecimal(value);
  if (!Number.isFinite(n) || n < 0) return "invalid";
  return n;
}

export function EventLineDialog({ open, onOpenChange, eventId, line, defaultKind, actualMode }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState(line?.name ?? "");
  const [category, setCategory] = useState(
    line?.category ?? EVENT_LINE_CATEGORIES.find((c) => c.kind === (defaultKind ?? "revenue"))?.value ?? "other_revenue",
  );
  const [calcMode, setCalcMode] = useState<Enums["event_line_calc_mode"]>(line?.calc_mode ?? "fixed");
  const [status, setStatus] = useState<Enums["event_value_status"]>(line?.value_status ?? "open");
  const [required, setRequired] = useState(line?.is_required ?? true);
  const [pu, setPu] = useState(line?.planned_unit_amount === null || line === undefined ? "" : String(line.planned_unit_amount));
  const [pq, setPq] = useState(line?.planned_quantity === null || line === undefined ? "" : String(line.planned_quantity));
  const [au, setAu] = useState(line?.actual_unit_amount === null || line === undefined ? "" : String(line.actual_unit_amount));
  const [aq, setAq] = useState(line?.actual_quantity === null || line === undefined ? "" : String(line.actual_quantity));
  const [notes, setNotes] = useState(line?.notes ?? "");
  const [varianceNote, setVarianceNote] = useState(line?.variance_note ?? "");
  const [saving, setSaving] = useState(false);

  const kind = EVENT_LINE_CATEGORIES.find((c) => c.value === category)?.kind ?? "revenue";

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Bitte eine Bezeichnung erfassen.");
      return;
    }
    const values = { pu: numOrNull(pu), pq: numOrNull(pq), au: numOrNull(au), aq: numOrNull(aq) };
    if (Object.values(values).includes("invalid")) {
      toast.error("Beträge und Mengen müssen Zahlen ab 0 sein. Leer bedeutet «offen».");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        category,
        kind,
        calc_mode: calcMode,
        value_status: status,
        is_required: kind === "informational" ? false : required,
        planned_unit_amount: values.pu as number | null,
        planned_quantity: values.pq as number | null,
        actual_unit_amount: values.au as number | null,
        actual_quantity: values.aq as number | null,
        notes: notes.trim() || null,
        variance_note: varianceNote.trim() || null,
      };
      if (line) await updateEventLine(line.id, payload);
      else await createEventLine({ event_id: eventId, sort_order: 500, ...payload });
      await qc.invalidateQueries({ queryKey: ["event_lines"] });
      toast.success("Position gespeichert.");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{line ? "Position bearbeiten" : "Position hinzufügen"}</DialogTitle>
          <DialogDescription>
            Leere Felder bedeuten «offen» und werden nie als Null gerechnet. Eine bewusste Null erfassen Sie als 0 mit
            Status «Bestätigt».
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="el-name">Bezeichnung</Label>
            <Input id="el-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Kategorie</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_LINE_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {eventLineKindLabels[c.kind]} · {eventCategoryLabels[c.value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Berechnung</Label>
              <Select value={calcMode} onValueChange={(v) => setCalcMode(v as Enums["event_line_calc_mode"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(calcModeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <fieldset className="grid gap-3 rounded-md border px-3 py-3">
            <legend className="px-1 text-xs text-muted-foreground">Plan</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="el-pu">Betrag pro Einheit (CHF)</Label>
                <Input id="el-pu" inputMode="decimal" placeholder="offen" value={pu} onChange={(e) => setPu(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="el-pq">Menge</Label>
                <Input id="el-pq" inputMode="decimal" placeholder="offen" value={pq} onChange={(e) => setPq(e.target.value)} />
              </div>
            </div>
          </fieldset>

          <fieldset className="grid gap-3 rounded-md border px-3 py-3">
            <legend className="px-1 text-xs text-muted-foreground">Ist</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="el-au">Betrag pro Einheit (CHF)</Label>
                <Input id="el-au" inputMode="decimal" placeholder="offen" value={au} onChange={(e) => setAu(e.target.value)} autoFocus={actualMode} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="el-aq">Menge</Label>
                <Input id="el-aq" inputMode="decimal" placeholder="offen" value={aq} onChange={(e) => setAq(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="el-var">Abweichungsnotiz</Label>
              <Input id="el-var" value={varianceNote} onChange={(e) => setVarianceNote(e.target.value)} />
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Wertstatus</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as Enums["event_value_status"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(valueStatusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <Label htmlFor="el-req" className="font-normal">
                Pflichtposition
              </Label>
              <Switch id="el-req" checked={kind === "informational" ? false : required} disabled={kind === "informational"} onCheckedChange={setRequired} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="el-notes">Notiz</Label>
            <Textarea id="el-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={saving}>
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
