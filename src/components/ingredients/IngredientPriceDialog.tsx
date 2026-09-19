/**
 * Focused editor for the central purchase price of one ingredient.
 * Opened from calculation contexts (dish variants and add-ons) so the price
 * can be corrected without leaving the calculation. Writes the same central
 * ingredient record as "Zutaten & EK" – no dish-specific prices.
 */
import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { updateIngredient, type Ingredient } from "@/lib/ingredients";
import { PACKAGE_TO_BASE, unitPrice, type PackageUnit } from "@/lib/costing";
import { invalidateMenuResults } from "@/lib/menu-cards";
import { formatUnitPrice, parseDecimal } from "@/lib/format";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Enums = Database["public"]["Enums"];

const PACKAGE_UNITS: PackageUnit[] = ["kg", "g", "l", "ml", "piece"];

type Props = {
  ingredient: Ingredient;
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function IngredientPriceDialog({ ingredient, userId, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const baseUnit = ingredient.base_unit;

  const [packageQuantity, setPackageQuantity] = useState(String(Number(ingredient.package_quantity)));
  const [packageUnit, setPackageUnit] = useState<PackageUnit>(ingredient.package_unit);
  const [packagePrice, setPackagePrice] = useState(String(Number(ingredient.package_price)));
  const [priceDate, setPriceDate] = useState(ingredient.price_date ?? "");
  const [priceStatus, setPriceStatus] = useState<Enums["price_status"]>(ingredient.price_status);
  const [sourceType, setSourceType] = useState<Enums["ingredient_source_type"]>(ingredient.source_type);
  const [error, setError] = useState<string | null>(null);

  // The base unit stays fixed here – only compatible package units are offered.
  const allowedUnits = PACKAGE_UNITS.filter((u) => PACKAGE_TO_BASE[u] === baseUnit);

  const preview = unitPrice({
    package_quantity: parseDecimal(packageQuantity),
    package_unit: packageUnit,
    package_price: parseDecimal(packagePrice),
    base_unit: baseUnit,
  });

  const mutation = useMutation({
    mutationFn: async () =>
      updateIngredient(ingredient.id, {
        package_quantity: parseDecimal(packageQuantity),
        package_unit: packageUnit,
        package_price: parseDecimal(packagePrice),
        price_date: priceDate || null,
        price_status: priceStatus,
        source_type: sourceType,
        updated_by: userId,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ingredients"] });
      await invalidateMenuResults(queryClient);
      toast.success("Einkaufspreis zentral gespeichert.");
      onOpenChange(false);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen."),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    const qty = parseDecimal(packageQuantity);
    if (!Number.isFinite(qty) || qty <= 0) return setError("Die Gebindemenge muss grösser als 0 sein.");
    const price = parseDecimal(packagePrice);
    if (!Number.isFinite(price) || price < 0) return setError("Bitte einen gültigen Gebindepreis eingeben (0 oder grösser).");
    if (PACKAGE_TO_BASE[packageUnit] !== baseUnit)
      return setError(
        `Gebindeeinheit ${packageUnitLabels[packageUnit]} passt nicht zur Basiseinheit ${baseUnitLabels[baseUnit]} dieser Zutat.`,
      );
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Einkaufspreis bearbeiten</DialogTitle>
            <DialogDescription>{ingredient.name}</DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-4">
            <Alert>
              <AlertDescription>
                Dieser Einkaufspreis gilt zentral für alle Gerichte, Varianten und Add-ons, die diese Zutat verwenden.
              </AlertDescription>
            </Alert>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="ip-qty">Gebindemenge *</Label>
                <Input id="ip-qty" inputMode="decimal" value={packageQuantity} onChange={(e) => setPackageQuantity(e.target.value)} required autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label>Gebindeeinheit *</Label>
                <Select value={packageUnit} onValueChange={(v) => setPackageUnit(v as PackageUnit)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allowedUnits.map((u) => (
                      <SelectItem key={u} value={u}>{packageUnitLabels[u]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ip-price">Gebindepreis (CHF) *</Label>
                <Input id="ip-price" inputMode="decimal" value={packagePrice} onChange={(e) => setPackagePrice(e.target.value)} required />
              </div>
            </div>

            <p className="rounded-md bg-muted/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">EK je Basiseinheit ({baseUnitLabels[baseUnit]}): </span>
              <span className="tabular font-medium">
                {preview !== null ? formatUnitPrice(preview, baseUnitLabels[baseUnit]) : "Unvollständig"}
              </span>
            </p>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="ip-date">Preisstand</Label>
                <Input id="ip-date" type="date" value={priceDate} onChange={(e) => setPriceDate(e.target.value)} />
              </div>
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

            <p className="text-xs text-muted-foreground">
              Der Preisstatus bleibt unverändert, solange er hier nicht bewusst geändert wird. Mengen und Prüfstatus der
              Kalkulation werden dadurch nicht angepasst.
            </p>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Speichern …" : "Einkaufspreis zentral speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
