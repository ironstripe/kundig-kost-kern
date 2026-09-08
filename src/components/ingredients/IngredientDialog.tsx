import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import {
  createIngredient,
  updateIngredient,
  normaliseName,
  type Ingredient,
} from "@/lib/ingredients";
import { PACKAGE_TO_BASE, unitPrice, type BaseUnit, type PackageUnit } from "@/lib/costing";
import { parseDecimal, formatUnitPrice } from "@/lib/format";
import { baseUnitLabels, ingredientSourceLabels, packageUnitLabels, priceStatusLabels } from "@/lib/labels";
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
import { Alert, AlertDescription } from "@/components/ui/alert";

type Enums = Database["public"]["Enums"];

type Props = {
  ingredient?: Ingredient | null;
  existing: Ingredient[];
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the new id after creation (e.g. to preselect it). */
  onCreated?: (id: string) => void;
};

const PACKAGE_UNITS: PackageUnit[] = ["kg", "g", "l", "ml", "piece"];

export function IngredientDialog({ ingredient, existing, userId, open, onOpenChange, onCreated }: Props) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(ingredient);

  const [name, setName] = useState(ingredient?.name ?? "");
  const [category, setCategory] = useState(ingredient?.category ?? "");
  const [supplier, setSupplier] = useState(ingredient?.supplier ?? "");
  const [packageQuantity, setPackageQuantity] = useState(ingredient ? String(Number(ingredient.package_quantity)) : "1");
  const [packageUnit, setPackageUnit] = useState<PackageUnit>(ingredient?.package_unit ?? "kg");
  const [packageLabel, setPackageLabel] = useState(ingredient?.package_label ?? "");
  const [packagePrice, setPackagePrice] = useState(ingredient ? String(Number(ingredient.package_price)) : "");
  const [baseUnit, setBaseUnit] = useState<BaseUnit>(ingredient?.base_unit ?? "g");
  const [priceDate, setPriceDate] = useState(ingredient?.price_date ?? "");
  const [ownProduction, setOwnProduction] = useState(ingredient?.is_own_production ?? false);
  const [priceStatus, setPriceStatus] = useState<Enums["price_status"]>(ingredient?.price_status ?? "estimated");
  const [sourceType, setSourceType] = useState<Enums["ingredient_source_type"]>(ingredient?.source_type ?? "manual");
  const [notes, setNotes] = useState(ingredient?.notes ?? "");
  const [isActive, setIsActive] = useState(ingredient?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);

  const categories = useMemo(
    () => Array.from(new Set(existing.map((i) => i.category))).sort((a, b) => a.localeCompare(b, "de-CH")),
    [existing],
  );

  const duplicate = useMemo(() => {
    const n = normaliseName(name);
    if (!n) return null;
    return existing.find((i) => i.id !== ingredient?.id && normaliseName(i.name) === n) ?? null;
  }, [name, existing, ingredient?.id]);

  const compatibleBase = PACKAGE_TO_BASE[packageUnit];
  const unitsCompatible = compatibleBase === baseUnit;

  const preview = unitPrice({
    package_quantity: parseDecimal(packageQuantity),
    package_unit: packageUnit,
    package_price: parseDecimal(packagePrice),
    base_unit: baseUnit,
  });

  function handlePackageUnitChange(u: PackageUnit) {
    setPackageUnit(u);
    setBaseUnit(PACKAGE_TO_BASE[u]);
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const values = {
        name: name.trim(),
        category: category.trim(),
        supplier: supplier.trim() || null,
        package_quantity: parseDecimal(packageQuantity),
        package_unit: packageUnit,
        package_label: packageLabel.trim() || null,
        package_price: parseDecimal(packagePrice),
        base_unit: baseUnit,
        price_date: priceDate || null,
        is_own_production: ownProduction,
        price_status: priceStatus,
        source_type: sourceType,
        notes: notes.trim() || null,
        is_active: isActive,
        updated_by: userId,
      };
      if (ingredient) {
        await updateIngredient(ingredient.id, values);
        return ingredient.id;
      }
      const created = await createIngredient(values);
      return created.id;
    },
    onSuccess: async (id) => {
      await queryClient.invalidateQueries({ queryKey: ["ingredients"] });
      await queryClient.invalidateQueries({ queryKey: ["calculation_items"] });
      toast.success(isEdit ? "Zutat gespeichert." : `Zutat «${name.trim()}» angelegt.`);
      onOpenChange(false);
      if (!isEdit) onCreated?.(id);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen."),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError("Bitte einen Namen eingeben.");
    if (category.trim().length < 2) return setError("Bitte eine Kategorie eingeben.");
    const qty = parseDecimal(packageQuantity);
    if (!Number.isFinite(qty) || qty <= 0) return setError("Die Gebindemenge muss grösser als 0 sein.");
    const price = parseDecimal(packagePrice);
    if (!Number.isFinite(price) || price < 0) return setError("Der Gebindepreis muss 0 oder grösser sein.");
    if (!unitsCompatible)
      return setError(
        `Gebindeeinheit ${packageUnitLabels[packageUnit]} und Basiseinheit ${baseUnitLabels[baseUnit]} sind nicht kompatibel. Gewicht und Volumen werden nie umgerechnet.`,
      );
    if (duplicate && !duplicateAcknowledged)
      return setError(`Es existiert bereits eine Zutat «${duplicate.name}». Bitte bestätigen, dass trotzdem eine neue Zutat angelegt werden soll.`);
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Zutat bearbeiten" : "Zutat hinzufügen"}</DialogTitle>
            <DialogDescription>
              Der Einkaufspreis je Basiseinheit wird automatisch aus Gebindemenge und Gebindepreis berechnet und in allen Kalkulationen zentral verwendet.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ing-name">Zutat *</Label>
                <Input id="ing-name" value={name} onChange={(e) => { setName(e.target.value); setDuplicateAcknowledged(false); }} required autoFocus />
                {duplicate && (
                  <Alert className="mt-2">
                    <AlertDescription className="flex flex-col gap-2">
                      <span>
                        Mögliches Duplikat: «{duplicate.name}» ({duplicate.category}) existiert bereits.
                      </span>
                      <label className="flex items-center gap-2 text-xs">
                        <Checkbox checked={duplicateAcknowledged} onCheckedChange={(c) => setDuplicateAcknowledged(c === true)} />
                        Trotzdem als eigene Zutat speichern
                      </label>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ing-cat">Kategorie *</Label>
                <Input id="ing-cat" list="ing-cat-list" value={category} onChange={(e) => setCategory(e.target.value)} required />
                <datalist id="ing-cat-list">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ing-sup">Lieferant</Label>
                <Input id="ing-sup" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
              </div>
            </div>

            <fieldset className="rounded-md border p-3">
              <legend className="px-1 text-xs font-medium text-muted-foreground">Gebinde & Einkaufspreis</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ing-qty">Gebindemenge *</Label>
                  <Input id="ing-qty" inputMode="decimal" value={packageQuantity} onChange={(e) => setPackageQuantity(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Gebindeeinheit *</Label>
                  <Select value={packageUnit} onValueChange={(v) => handlePackageUnitChange(v as PackageUnit)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PACKAGE_UNITS.map((u) => (
                        <SelectItem key={u} value={u}>{packageUnitLabels[u]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ing-price">Gebindepreis (CHF) *</Label>
                  <Input id="ing-price" inputMode="decimal" value={packagePrice} onChange={(e) => setPackagePrice(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ing-label">Gebindebezeichnung</Label>
                  <Input id="ing-label" placeholder="z. B. Karton à 10 kg" value={packageLabel} onChange={(e) => setPackageLabel(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Basiseinheit *</Label>
                  <Select value={baseUnit} onValueChange={(v) => setBaseUnit(v as BaseUnit)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["g", "ml", "piece"] as BaseUnit[]).map((u) => (
                        <SelectItem key={u} value={u} disabled={u !== compatibleBase}>
                          {baseUnitLabels[u]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ing-date">Preisstand (Datum)</Label>
                  <Input id="ing-date" type="date" value={priceDate} onChange={(e) => setPriceDate(e.target.value)} />
                </div>
              </div>
              <p className="mt-3 text-sm">
                <span className="text-muted-foreground">EK je Basiseinheit: </span>
                <span className="tabular font-medium">
                  {preview !== null ? formatUnitPrice(preview, baseUnitLabels[baseUnit]) : "Unvollständig"}
                </span>
              </p>
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Preisstatus</Label>
                <Select value={priceStatus} onValueChange={(v) => setPriceStatus(v as Enums["price_status"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="estimated">{priceStatusLabels.estimated}</SelectItem>
                    <SelectItem value="confirmed">{priceStatusLabels.confirmed}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Quelle</Label>
                <Select value={sourceType} onValueChange={(v) => setSourceType(v as Enums["ingredient_source_type"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ingredientSourceLabels) as Enums["ingredient_source_type"][]).map((k) => (
                      <SelectItem key={k} value={k}>{ingredientSourceLabels[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ing-notes">Notizen</Label>
              <Textarea id="ing-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={ownProduction} onCheckedChange={(c) => setOwnProduction(c === true)} />
                Eigene Produktion
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={isActive} onCheckedChange={(c) => setIsActive(c === true)} />
                Aktiv
              </label>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Speichern …" : isEdit ? "Speichern" : "Zutat anlegen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
