import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { addExcludedDay, type ExcludedDay, type MenuCard } from "@/lib/menu-cards";
import { WEEKDAYS, formatDate } from "@/lib/format";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  card: MenuCard;
  existing: ExcludedDay[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function isoWeekday(date: string): number {
  const d = new Date(`${date}T00:00:00Z`);
  const js = d.getUTCDay();
  return js === 0 ? 7 : js;
}

export function ExcludedDayDialog({ card, existing, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(card.valid_from);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const outsidePeriod = validDate && (date < card.valid_from || date > card.valid_to);
  const duplicate = validDate && existing.some((e) => e.excluded_date === date);
  const regularClosed = validDate && !card.opening_weekdays.includes(isoWeekday(date));
  const weekdayLabel = validDate ? WEEKDAYS.find((w) => w.value === isoWeekday(date))?.label : undefined;

  const mutation = useMutation({
    mutationFn: () => addExcludedDay(card.id, date, reason.trim() || null),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["excluded_days"] }),
        queryClient.invalidateQueries({ queryKey: ["menu_card_data"] }),
      ]);
      toast.success(`Schliesstag ${formatDate(date)} erfasst.`);
      onOpenChange(false);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen."),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validDate) return setError("Bitte ein gültiges Datum wählen.");
    if (outsidePeriod) return setError("Das Datum liegt ausserhalb der Laufzeit der Speisekarte.");
    if (duplicate) return setError("Dieser Schliesstag ist bereits erfasst.");
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Schliesstag hinzufügen</DialogTitle>
            <DialogDescription>
              Ein Schliesstag reduziert die Verkaufstage und damit alle erwarteten Gesamtmengen. Feiertage werden nicht automatisch übernommen.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ex-date">Datum</Label>
              <Input
                id="ex-date"
                type="date"
                min={card.valid_from}
                max={card.valid_to}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
              {weekdayLabel && <p className="text-xs text-muted-foreground">{weekdayLabel}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ex-reason">Grund (optional)</Label>
              <Input id="ex-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="z. B. Betriebsferien, Privatanlass" />
            </div>
            {outsidePeriod && <p className="text-sm text-destructive">Das Datum liegt ausserhalb der Laufzeit ({formatDate(card.valid_from)} – {formatDate(card.valid_to)}).</p>}
            {duplicate && <p className="text-sm text-destructive">Dieser Tag ist bereits als Schliesstag erfasst.</p>}
            {regularClosed && !outsidePeriod && !duplicate && (
              <p className="rounded-md bg-warning/15 px-3 py-2 text-xs text-warning-foreground">
                Hinweis: Der {weekdayLabel} ist ohnehin kein regulärer Öffnungstag. Der Eintrag ändert die Verkaufstage nicht.
              </p>
            )}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button type="submit" disabled={mutation.isPending || outsidePeriod || duplicate}>
              {mutation.isPending ? "Wird gespeichert …" : "Hinzufügen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
