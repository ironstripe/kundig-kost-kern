import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createEvent, updateEvent, type Event } from "@/lib/events";
import { copyDefaultsToEvent, eventAssumptionsQuery } from "@/lib/event-assumptions";
import { eventStatusLabels, eventTypeLabels } from "@/lib/event-labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  event?: Event | undefined;
  onCreated?: (id: string) => void;
};

function intOrNull(value: string): number | null | "invalid" {
  if (value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) return "invalid";
  return n;
}

export function EventDialog({ open, onOpenChange, userId, event, onCreated }: Props) {
  const qc = useQueryClient();
  const { data: assumptions } = useQuery(eventAssumptionsQuery);
  const [name, setName] = useState(event?.name ?? "");
  const [date, setDate] = useState(event?.event_date ?? "");
  const [type, setType] = useState<Event["event_type"]>(event?.event_type ?? "other");
  const [status, setStatus] = useState<Event["status"]>(event?.status ?? "draft");
  const [paying, setPaying] = useState(event?.planned_paying_guests === null || event === undefined ? "" : String(event.planned_paying_guests));
  const [free, setFree] = useState(event?.planned_free_guests === null || event === undefined ? "" : String(event.planned_free_guests));
  const [actualPaying, setActualPaying] = useState(
    event?.actual_paying_guests === null || event === undefined ? "" : String(event.actual_paying_guests),
  );
  const [actualFree, setActualFree] = useState(
    event?.actual_free_guests === null || event === undefined ? "" : String(event.actual_free_guests),
  );
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Bitte einen Eventnamen erfassen.");
      return;
    }
    const values = {
      planned_paying_guests: intOrNull(paying),
      planned_free_guests: intOrNull(free),
      actual_paying_guests: intOrNull(actualPaying),
      actual_free_guests: intOrNull(actualFree),
    };
    if (Object.values(values).includes("invalid")) {
      toast.error("Gästezahlen müssen ganze Zahlen ab 0 sein.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        event_date: date || null,
        event_type: type,
        status,
        notes: notes.trim() || null,
        planned_paying_guests: values.planned_paying_guests as number | null,
        planned_free_guests: values.planned_free_guests as number | null,
        actual_paying_guests: values.actual_paying_guests as number | null,
        actual_free_guests: values.actual_free_guests as number | null,
      };
      if (event) {
        await updateEvent(event.id, payload, userId);
        toast.success("Event gespeichert.");
      } else {
        const created = await createEvent(payload, userId);
        // Food-Catch-Prinzip: aktuelle Standards werden in den Event kopiert.
        await copyDefaultsToEvent(created.id, assumptions ?? [], type);
        toast.success("Event angelegt. Die aktuellen Standardannahmen wurden übernommen.");
        onCreated?.(created.id);
      }
      await qc.invalidateQueries({ queryKey: ["events"] });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{event ? "Event bearbeiten" : "Event anlegen"}</DialogTitle>
          <DialogDescription>
            Ein Event bündelt Gäste, Erlöse, Menü, Personal, Partner und weitere direkte Kosten.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="ev-name">Name</Label>
            <Input id="ev-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="ev-date">Datum</Label>
              <Input id="ev-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Eventtyp</Label>
              <Select value={type} onValueChange={(v) => setType(v as Event["event_type"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(eventTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as Event["status"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(eventStatusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="ev-paying">Geplante zahlende Gäste</Label>
              <Input id="ev-paying" inputMode="numeric" placeholder="leer = offen" value={paying} onChange={(e) => setPaying(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ev-free">Geplante Gratisgäste</Label>
              <Input id="ev-free" inputMode="numeric" placeholder="leer = offen" value={free} onChange={(e) => setFree(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ev-apaying">Effektive zahlende Gäste</Label>
              <Input id="ev-apaying" inputMode="numeric" placeholder="leer = offen" value={actualPaying} onChange={(e) => setActualPaying(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ev-afree">Effektive Gratisgäste</Label>
              <Input id="ev-afree" inputMode="numeric" placeholder="leer = offen" value={actualFree} onChange={(e) => setActualFree(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ev-notes">Notizen</Label>
            <Textarea id="ev-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
