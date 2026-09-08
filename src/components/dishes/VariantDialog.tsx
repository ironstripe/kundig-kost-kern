import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createVariant,
  duplicateVariant,
  updateVariant,
  type CalculationItem,
  type Variant,
} from "@/lib/dishes";
import type { SmallMaterialMode } from "@/lib/costing";
import { parseDecimal } from "@/lib/format";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  mode: "create" | "edit" | "duplicate";
  dishId: string;
  userId: string;
  variant?: Variant | null;
  /** Items of the source variant (duplicate mode). */
  sourceItems?: CalculationItem[];
  cardSmallMaterial: { mode: SmallMaterialMode; value: number };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (variantId: string) => void;
};

export function VariantDialog({ mode, dishId, userId, variant, sourceItems = [], cardSmallMaterial, open, onOpenChange, onSaved }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(mode === "duplicate" ? `${variant?.name ?? ""} (Kopie)` : (variant?.name ?? ""));
  const [grossPrice, setGrossPrice] = useState(variant ? String(Number(variant.gross_price)) : "");
  const [notes, setNotes] = useState(mode === "edit" ? (variant?.notes ?? "") : "");
  const [isActive, setIsActive] = useState(variant?.is_active ?? true);
  const [salesMode, setSalesMode] = useState<"per_open_day" | "total">(variant?.sales_input_mode ?? "per_open_day");
  const [perDay, setPerDay] = useState(variant ? String(Number(variant.expected_per_open_day)) : "1");
  const [total, setTotal] = useState(variant?.expected_total !== null && variant?.expected_total !== undefined ? String(Number(variant.expected_total)) : "");
  const [useOverride, setUseOverride] = useState(Boolean(variant?.small_material_override_mode));
  const [overrideMode, setOverrideMode] = useState<SmallMaterialMode>(variant?.small_material_override_mode ?? "percent");
  const [overrideValue, setOverrideValue] = useState(
    variant?.small_material_override_value !== null && variant?.small_material_override_value !== undefined
      ? String(
          variant.small_material_override_mode === "percent"
            ? Number(variant.small_material_override_value) * 100
            : Number(variant.small_material_override_value),
        )
      : "",
  );
  const [error, setError] = useState<string | null>(null);

  const titles = {
    create: "Variante hinzufügen",
    edit: "Variante bearbeiten",
    duplicate: "Variante duplizieren",
  } as const;

  const mutation = useMutation({
    mutationFn: async () => {
      const price = parseDecimal(grossPrice);
      let ovMode: SmallMaterialMode | null = null;
      let ovValue: number | null = null;
      if (useOverride) {
        const raw = parseDecimal(overrideValue);
        ovMode = overrideMode;
        ovValue = overrideMode === "percent" ? raw / 100 : raw;
      }
      if (mode === "duplicate" && variant) {
        const created = await duplicateVariant(variant, sourceItems, { name: name.trim(), gross_price: price }, userId);
        if (useOverride !== Boolean(variant.small_material_override_mode) || ovValue !== variant.small_material_override_value) {
          await updateVariant(created.id, { small_material_override_mode: ovMode, small_material_override_value: ovValue });
        }
        return created.id;
      }
      const patch = {
        name: name.trim(),
        gross_price: price,
        notes: notes.trim() || null,
        is_active: isActive,
        sales_input_mode: salesMode,
        expected_per_open_day: salesMode === "per_open_day" ? parseDecimal(perDay) : Number(variant?.expected_per_open_day ?? 0),
        expected_total: salesMode === "total" ? parseDecimal(total) : null,
        small_material_override_mode: ovMode,
        small_material_override_value: ovValue,
        updated_by: userId,
      };
      if (mode === "edit" && variant) {
        await updateVariant(variant.id, patch);
        return variant.id;
      }
      const created = await createVariant({ ...patch, dish_id: dishId, is_default: false, calculation_status: "estimated" });
      return created.id;
    },
    onSuccess: async (id) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["variants"] }),
        queryClient.invalidateQueries({ queryKey: ["calculation_items"] }),
      ]);
      toast.success(
        mode === "duplicate"
          ? `Variante «${name.trim()}» als unabhängige Kopie angelegt (${sourceItems.length} Positionen übernommen).`
          : mode === "edit"
            ? "Variante gespeichert."
            : `Variante «${name.trim()}» angelegt.`,
      );
      onOpenChange(false);
      onSaved?.(id);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen."),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 1) return setError("Bitte einen Namen für die Variante eingeben.");
    const p = parseDecimal(grossPrice);
    if (!Number.isFinite(p) || p <= 0) return setError("Bitte einen Brutto-Verkaufspreis grösser als 0 eingeben.");
    if (mode !== "duplicate") {
      const s = parseDecimal(salesMode === "per_open_day" ? perDay : total);
      if (!Number.isFinite(s) || s < 0) return setError("Bitte einen gültigen erwarteten Absatz eingeben.");
    }
    if (useOverride) {
      const v = parseDecimal(overrideValue);
      if (!Number.isFinite(v) || v < 0) return setError("Bitte einen gültigen Wert für das Kleinmaterial eingeben.");
      if (overrideMode === "percent" && v > 100) return setError("Kleinmaterial in Prozent darf 100 % nicht überschreiten.");
    }
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{titles[mode]}</DialogTitle>
            <DialogDescription>
              {mode === "duplicate"
                ? `Alle ${sourceItems.length} Kalkulationspositionen von «${variant?.name}» werden kopiert. Die Kopie ist unabhängig – spätere Änderungen wirken sich nicht auf das Original aus.`
                : "Jede Variante hat einen eigenen Brutto-Verkaufspreis (inkl. 8.1 % MWST) und eine eigene Kalkulation."}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="var-name">Variante *</Label>
                <Input id="var-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="var-price">Brutto-VK (CHF) *</Label>
                <Input id="var-price" inputMode="decimal" value={grossPrice} onChange={(e) => setGrossPrice(e.target.value)} required />
              </div>
            </div>

            <div className="rounded-md border p-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={useOverride} onCheckedChange={(c) => setUseOverride(c === true)} />
                Kleinmaterial für diese Variante abweichend festlegen
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
                    <Label htmlFor="var-ov">{overrideMode === "percent" ? "Prozent" : "CHF pro Portion"}</Label>
                    <Input id="var-ov" inputMode="decimal" value={overrideValue} onChange={(e) => setOverrideValue(e.target.value)} />
                  </div>
                </div>
              )}
            </div>

            {mode !== "duplicate" && (
              <>
                <div className="rounded-md border p-3">
                  <p className="mb-2 text-sm font-medium">Erwarteter Absatz <span className="text-xs font-normal text-muted-foreground">(Annahme, für spätere Gesamtkalkulation)</span></p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Eingabe</Label>
                      <Select value={salesMode} onValueChange={(v) => setSalesMode(v as "per_open_day" | "total")}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="per_open_day">pro Öffnungstag</SelectItem>
                          <SelectItem value="total">Gesamt im Zeitraum</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="var-sales">{salesMode === "per_open_day" ? "Portionen pro Öffnungstag" : "Portionen gesamt"}</Label>
                      {salesMode === "per_open_day" ? (
                        <Input id="var-sales" inputMode="decimal" value={perDay} onChange={(e) => setPerDay(e.target.value)} />
                      ) : (
                        <Input id="var-sales" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} />
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="var-notes">Notizen</Label>
                  <Textarea id="var-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={isActive} onCheckedChange={(c) => setIsActive(c === true)} />
                  Aktiv
                </label>
              </>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Speichern …" : mode === "duplicate" ? "Kopie anlegen" : "Speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
