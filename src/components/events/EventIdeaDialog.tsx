import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createEventIdea,
  updateEventIdea,
  type EventIdea,
  type IdeaStage,
} from "@/lib/event-ideas";
import { eventTypeLabels } from "@/lib/event-labels";
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
import type { Database } from "@/integrations/supabase/types";

type EventType = Database["public"]["Enums"]["event_type"];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  idea?: EventIdea | undefined;
  onCreated?: (id: string) => void;
};

const NO_TYPE = "__none__";

export function EventIdeaDialog({ open, onOpenChange, userId, idea, onCreated }: Props) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(idea?.title ?? "");
  const [summary, setSummary] = useState(idea?.summary ?? "");
  const [type, setType] = useState<string>(idea?.event_type ?? NO_TYPE);
  const [audience, setAudience] = useState(idea?.target_audience ?? "");
  const [desiredDate, setDesiredDate] = useState(idea?.desired_date ?? "");
  const [period, setPeriod] = useState(idea?.desired_period ?? "");
  const [guests, setGuests] = useState(idea?.expected_guests === null || idea === undefined ? "" : String(idea.expected_guests));
  const [partner, setPartner] = useState(idea?.partner ?? "");
  const [owner, setOwner] = useState(idea?.owner_name ?? "");
  const [notes, setNotes] = useState(idea?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) {
      toast.error("Bitte einen Titel erfassen.");
      return;
    }
    if (!summary.trim()) {
      toast.error("Bitte eine Kurzbeschreibung erfassen.");
      return;
    }
    let expected: number | null = null;
    if (guests.trim() !== "") {
      const n = Number(guests);
      if (!Number.isInteger(n) || n < 0) {
        toast.error("Erwartete Gäste müssen eine ganze Zahl ab 0 sein.");
        return;
      }
      expected = n;
    }
    setSaving(true);
    try {
      const values = {
        title: title.trim(),
        summary: summary.trim(),
        event_type: type === NO_TYPE ? null : (type as EventType),
        target_audience: audience.trim() || null,
        desired_date: desiredDate || null,
        desired_period: period.trim() || null,
        expected_guests: expected,
        partner: partner.trim() || null,
        owner_name: owner.trim() || null,
        notes: notes.trim() || null,
      };
      if (idea) {
        await updateEventIdea(idea.id, values, userId);
        toast.success("Idee gespeichert. Eine bestehende Kalkulation bleibt unverändert.");
      } else {
        const created = await createEventIdea({ ...values, stage: "new" as IdeaStage }, userId);
        toast.success("Idee erfasst.");
        onCreated?.(created.id);
      }
      await qc.invalidateQueries({ queryKey: ["event_ideas"] });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{idea ? "Idee bearbeiten" : "Neue Eventidee"}</DialogTitle>
          <DialogDescription>
            Nur Titel und Kurzbeschreibung sind nötig. Datum, Gästezahl und Preis dürfen offen bleiben.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="idea-title">Titel</Label>
            <Input id="idea-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="idea-summary">Kurzbeschreibung</Label>
            <Textarea id="idea-summary" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Eventformat (optional)</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue placeholder="Noch offen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TYPE}>Noch offen</SelectItem>
                  {(Object.keys(eventTypeLabels) as EventType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {eventTypeLabels[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="idea-audience">Zielgruppe (optional)</Label>
              <Input id="idea-audience" value={audience} onChange={(e) => setAudience(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="idea-date">Wunschdatum (optional)</Label>
              <Input id="idea-date" type="date" value={desiredDate} onChange={(e) => setDesiredDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="idea-period">Zeitraum (optional)</Label>
              <Input
                id="idea-period"
                placeholder="z. B. Spätherbst 2026"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="idea-guests">Erwartete Gäste (optional)</Label>
              <Input id="idea-guests" inputMode="numeric" value={guests} onChange={(e) => setGuests(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="idea-partner">Partner (optional)</Label>
              <Input id="idea-partner" value={partner} onChange={(e) => setPartner(e.target.value)} />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="idea-owner">Verantwortliche Person (optional)</Label>
              <Input id="idea-owner" value={owner} onChange={(e) => setOwner(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="idea-notes">Diskussionsnotizen (optional)</Label>
            <Textarea id="idea-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={saving}>
            {idea ? "Speichern" : "Idee erfassen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
