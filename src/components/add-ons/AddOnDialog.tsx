import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createAddOn, setAddOnDishes, updateAddOn, type AddOn, type AddOnLink } from "@/lib/add-ons";
import type { Dish } from "@/lib/dishes";
import type { SmallMaterialMode } from "@/lib/costing";
import type { Database } from "@/integrations/supabase/types";
import { parseDecimal } from "@/lib/format";
import { smallMaterialModeLabels } from "@/lib/labels";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type SalesInputMode = Database["public"]["Enums"]["sales_input_mode"];

type Props = {
  addOn?: AddOn | null;
  menuCardId: string;
  dishes: Dish[];
  links: AddOnLink[];
  /** Pre-selected dish when creating from a dish detail page. */
  presetDishId?: string;
  cardSmallMaterial: { mode: SmallMaterialMode; value: number };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (addOnId: string) => void;
};

export function AddOnDialog({ addOn, menuCardId, dishes, links, presetDishId, cardSmallMaterial, open, onOpenChange, onSaved }: Props) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(addOn);
  const [name, setName] = useState(addOn?.name ?? "");
  const [grossPrice, setGrossPrice] = useState(addOn ? String(Number(addOn.gross_price)) : "");
  const [notes, setNotes] = useState(addOn?.notes ?? "");
  const [isActive, setIsActive] = useState(addOn?.is_active ?? true);
  const [salesMode, setSalesMode] = useState<SalesInputMode>(addOn?.sales_input_mode ?? "per_open_day");
  const [perDay, setPerDay] = useState(addOn ? String(Number(addOn.expected_per_open_day)) : "1");
  const [total, setTotal] = useState(addOn?.expected_total !== null && addOn?.expected_total !== undefined ? String(Number(addOn.expected_total)) : "");
  const [dishIds, setDishIds] = useState<string[]>(() => {
    if (addOn) return links.filter((l) => l.add_on_id === addOn.id).map((l) => l.dish_id);
    return presetDishId ? [presetDishId] : [];
  });
  const [useOverride, setUseOverride] = useState(Boolean(addOn?.small_material_override_mode));
  const [overrideMode, setOverrideMode] = useState<SmallMaterialMode>(addOn?.small_material_override_mode ?? "percent");
  const [overrideValue, setOverrideValue] = useState(
    addOn?.small_material_override_value !== null && addOn?.small_material_override_value !== undefined
      ? String(addOn.small_material_override_mode === "percent" ? Number(addOn.small_material_override_value) * 100 : Number(addOn.small_material_override_value))
      : "",
  );
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      let ovMode: SmallMaterialMode | null = null;
      let ovValue: number | null = null;
      if (useOverride) {
        const raw = parseDecimal(overrideValue);
        ovMode = overrideMode;
        ovValue = overrideMode === "percent" ? raw / 100 : raw;
      }
      const patch = {
        name: name.trim(),
        gross_price: parseDecimal(grossPrice),
        notes: notes.trim() || null,
        is_active: isActive,
        sales_input_mode: salesMode,
        expected_per_open_day: salesMode === "per_open_day" ? parseDecimal(perDay) : Number(addOn?.expected_per_open_day ?? 0),
        expected_total: salesMode === "total" ? parseDecimal(total) : null,
        small_material_override_mode: ovMode,
        small_material_override_value: ovValue,
      };
      let id: string;
      if (addOn) {
        await updateAddOn(addOn.id, patch);
        id = addOn.id;
      } else {
        const created = await createAddOn({ ...patch, menu_card_id: menuCardId, calculation_status: "estimated" });
        id = created.id;
      }
      await setAddOnDishes(id, dishIds, links);
      return id;
    },
    onSuccess: async (id) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["add_ons"] }),
        queryClient.invalidateQueries({ queryKey: ["add_on_links"] }),
      ]);
      toast.success(isEdit ? "Add-on gespeichert." : `Add-on «${name.trim()}» angelegt.`);
      onOpenChange(false);
      onSaved?.(id);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen."),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 1) return setError("Bitte einen Namen für das Add-on eingeben.");
    const p = parseDecimal(grossPrice);
    if (!Number.isFinite(p) || p <= 0) return setError("Bitte einen Brutto-Aufpreis grösser als 0 eingeben.");
    if (salesMode === "per_open_day") {
      const v = parseDecimal(perDay);
      if (!Number.isFinite(v) || v < 0) return setError("Bitte einen gültigen erwarteten Absatz pro Öffnungstag eingeben.");
    } else {
      const v = parseDecimal(total);
      if (!Number.isFinite(v) || v < 0) return setError("Bitte einen gültigen erwarteten Gesamtabsatz eingeben.");
    }
    if (useOverride) {
      const v = parseDecimal(overrideValue);
      if (!Number.isFinite(v) || v < 0) return setError("Bitte einen gültigen Wert für das Kleinmaterial eingeben.");
      if (overrideMode === "percent" && v > 100) return setError("Kleinmaterial in Prozent darf 100 % nicht überschreiten.");
    }
    mutation.mutate();
  }

  const sortedDishes = [...dishes].sort((a, b) => a.name.localeCompare(b.name, "de-CH"));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Add-on bearbeiten" : "Add-on anlegen"}</DialogTitle>
            <DialogDescription>
              Ein Add-on wird zusätzlich zu einem Gericht verkauft (z. B. Pommes frites oder 2 cl Spirituose) und hat einen eigenen Aufpreis und eine eigene Kalkulation. Es ersetzt keine Variante.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ao-name">Add-on *</Label>
                <Input id="ao-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ao-price">Brutto-Aufpreis (CHF) *</Label>
                <Input id="ao-price" inputMode="decimal" value={grossPrice} onChange={(e) => setGrossPrice(e.target.value)} required />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Zugeordnete Gerichte</Label>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                {sortedDishes.length === 0 && <p className="text-xs text-muted-foreground">Noch keine Gerichte vorhanden.</p>}
                {sortedDishes.map((d) => (
                  <label key={d.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={dishIds.includes(d.id)}
                      onCheckedChange={(c) => setDishIds((prev) => (c === true ? [...prev, d.id] : prev.filter((x) => x !== d.id)))}
                    />
                    {d.name}
                    {!d.is_active && <span className="text-xs text-muted-foreground">(inaktiv)</span>}
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-md border p-3">
              <p className="mb-2 text-sm font-medium">Erwarteter Absatz <span className="text-xs font-normal text-muted-foreground">(Annahme, für spätere Gesamtkalkulation)</span></p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Eingabe</Label>
                  <Select value={salesMode} onValueChange={(v) => setSalesMode(v as SalesInputMode)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="per_open_day">pro Öffnungstag</SelectItem>
                      <SelectItem value="total">Gesamt im Zeitraum</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ao-sales">{salesMode === "per_open_day" ? "Stück pro Öffnungstag" : "Stück gesamt"}</Label>
                  {salesMode === "per_open_day" ? (
                    <Input id="ao-sales" inputMode="decimal" value={perDay} onChange={(e) => setPerDay(e.target.value)} />
                  ) : (
                    <Input id="ao-sales" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} />
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-md border p-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={useOverride} onCheckedChange={(c) => setUseOverride(c === true)} />
                Kleinmaterial für dieses Add-on abweichend festlegen
              </label>
              <p className="mt-1 text-xs text-muted-foreground">
                Standard aus der Speisekarte:{" "}
                {cardSmallMaterial.mode === "percent"
                  ? `${(cardSmallMaterial.value * 100).toLocaleString("de-CH")} % der Warenkosten`
                  : `CHF ${cardSmallMaterial.value.toLocaleString("de-CH", { minimumFractionDigits: 2 })} pro Portion`}
              </p>
              {useOverride && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Modus</Label>
                    <Select value={overrideMode} onValueChange={(v) => setOverrideMode(v as SmallMaterialMode)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(smallMaterialModeLabels) as SmallMaterialMode[]).map((m) => (
                          <SelectItem key={m} value={m}>{smallMaterialModeLabels[m]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ao-ov">{overrideMode === "percent" ? "Prozent" : "CHF pro Portion"}</Label>
                    <Input id="ao-ov" inputMode="decimal" value={overrideValue} onChange={(e) => setOverrideValue(e.target.value)} />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ao-notes">Notizen</Label>
              <Textarea id="ao-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={isActive} onCheckedChange={(c) => setIsActive(c === true)} />
              Aktiv
            </label>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Speichern …" : "Speichern"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
