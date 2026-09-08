import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { updateMenuCard, type MenuCard } from "@/lib/menu-cards";
import { WEEKDAYS } from "@/lib/format";
import { smallMaterialModeLabels } from "@/lib/labels";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Mode = Database["public"]["Enums"]["small_material_mode"];

type Props = {
  card: MenuCard;
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MenuCardConfigDialog({ card, userId, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(card.name);
  const [validFrom, setValidFrom] = useState(card.valid_from);
  const [validTo, setValidTo] = useState(card.valid_to);
  const [vatPercent, setVatPercent] = useState(String(Number(card.vat_rate) * 100));
  const [mode, setMode] = useState<Mode>(card.small_material_mode);
  const [smallValue, setSmallValue] = useState(
    card.small_material_mode === "percent"
      ? String(Number(card.small_material_value) * 100)
      : String(Number(card.small_material_value)),
  );
  const [weekdays, setWeekdays] = useState<number[]>(card.opening_weekdays);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      const vat = Number(vatPercent.replace(",", ".")) / 100;
      const sm = Number(smallValue.replace(",", "."));
      return updateMenuCard(
        card.id,
        {
          name: name.trim(),
          valid_from: validFrom,
          valid_to: validTo,
          vat_rate: vat,
          small_material_mode: mode,
          small_material_value: mode === "percent" ? sm / 100 : sm,
          opening_weekdays: [...weekdays].sort((a, b) => a - b),
        },
        userId,
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["menu_cards"] });
      toast.success("Konfiguration gespeichert.");
      onOpenChange(false);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen."),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError("Bitte einen Namen eingeben.");
    if (validTo < validFrom) return setError("Das Enddatum muss nach dem Startdatum liegen.");
    const vat = Number(vatPercent.replace(",", "."));
    if (Number.isNaN(vat) || vat < 0 || vat >= 100) return setError("Ungültiger MWST-Satz.");
    const sm = Number(smallValue.replace(",", "."));
    if (Number.isNaN(sm) || sm < 0) return setError("Ungültiger Kleinmaterial-Wert.");
    if (weekdays.length === 0) return setError("Bitte mindestens einen Öffnungstag wählen.");
    mutation.mutate();
  }

  function toggleWeekday(day: number, checked: boolean) {
    setWeekdays((prev) => (checked ? [...prev, day] : prev.filter((d) => d !== day)));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Konfiguration bearbeiten</DialogTitle>
            <DialogDescription>
              Zentrale Annahmen der Speisekarte. Kalkulationen werden später daraus abgeleitet.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="mc-name">Name</Label>
              <Input id="mc-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="mc-from">Gültig ab</Label>
                <Input id="mc-from" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mc-to">Gültig bis</Label>
                <Input id="mc-to" type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mc-vat">MWST-Satz (%)</Label>
              <Input id="mc-vat" inputMode="decimal" value={vatPercent} onChange={(e) => setVatPercent(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Kleinmaterial-Modus</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(smallMaterialModeLabels) as Mode[]).map((m) => (
                      <SelectItem key={m} value={m}>
                        {smallMaterialModeLabels[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mc-sm">{mode === "percent" ? "Kleinmaterial (%)" : "Kleinmaterial (CHF)"}</Label>
                <Input id="mc-sm" inputMode="decimal" value={smallValue} onChange={(e) => setSmallValue(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reguläre Öffnungstage</Label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((w) => {
                  const checked = weekdays.includes(w.value);
                  return (
                    <label
                      key={w.value}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
                    >
                      <Checkbox checked={checked} onCheckedChange={(c) => toggleWeekday(w.value, c === true)} />
                      {w.short}
                    </label>
                  );
                })}
              </div>
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Wird gespeichert …" : "Speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
