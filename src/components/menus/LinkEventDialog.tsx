import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { buildMenuSnapshot, type MenuVariantResult } from "@/lib/menu-costing";
import type { Menu } from "@/lib/menus";
import { eventsQuery, isSnapshotLocked, linkMenuToEvent, setEventMenuVariant } from "@/lib/events";
import { eventStatusLabels } from "@/lib/event-labels";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
  menu: Menu;
  results: MenuVariantResult[];
  userId: string;
  onLinked?: (eventId: string) => void;
};

export function LinkEventDialog({ open, onOpenChange, menu, results, userId, onLinked }: Props) {
  const qc = useQueryClient();
  const { data: events } = useQuery(eventsQuery);
  const [eventId, setEventId] = useState("");
  const [saving, setSaving] = useState(false);

  const selectable = (events ?? []).filter((e) => !isSnapshotLocked(e.status));

  const submit = async () => {
    if (!eventId) {
      toast.error("Bitte einen Event wählen.");
      return;
    }
    setSaving(true);
    try {
      await linkMenuToEvent(eventId, menu.id, buildMenuSnapshot(menu, results), userId);
      for (const r of results) {
        await setEventMenuVariant(eventId, r.menuVariant.id, { planned_guests: r.menuVariant.expected_guests });
      }
      await qc.invalidateQueries({ queryKey: ["event_menu_links"] });
      await qc.invalidateQueries({ queryKey: ["event_menu_variants"] });
      toast.success("Menü mit dem Event verknüpft. Der Snapshot ist als Nachweis gespeichert.");
      onOpenChange(false);
      onLinked?.(eventId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verknüpfen fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mit Event verknüpfen</DialogTitle>
          <DialogDescription>
            Beim Verknüpfen wird der aktuelle Stand der Menükalkulation als unveränderlicher Snapshot beim Event
            abgelegt. Das Menü bleibt eigenständig nutzbar.
          </DialogDescription>
        </DialogHeader>
        {selectable.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Es gibt keinen offenen Event. Legen Sie zuerst unter «Events» einen Event an.
          </p>
        ) : (
          <div className="grid gap-1.5">
            <Label>Event</Label>
            <Select value={eventId} onValueChange={setEventId}>
              <SelectTrigger>
                <SelectValue placeholder="Event wählen …" />
              </SelectTrigger>
              <SelectContent>
                {selectable.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} · {e.event_date ? formatDate(e.event_date) : "ohne Datum"} · {eventStatusLabels[e.status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={saving || selectable.length === 0}>
            Verknüpfen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
