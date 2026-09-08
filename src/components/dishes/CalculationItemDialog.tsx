import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createItem, updateItem, type CalculationItem } from "@/lib/dishes";
import type { Ingredient } from "@/lib/ingredients";
import { calculateItem, unitPrice, type BaseUnit } from "@/lib/costing";
import { formatCHF, formatQuantity, formatUnitPrice, parseDecimal } from "@/lib/format";
import { COMPONENT_GROUPS, baseUnitLabels, priceStatusLabels } from "@/lib/labels";
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
import { StatusBadge } from "@/components/layout/StatusBadge";

type Props = {
  variantId: string;
  item?: CalculationItem | null;
  ingredients: Ingredient[];
  nextSortOrder: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CalculationItemDialog({ variantId, item, ingredients, nextSortOrder, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(item);
  const [ingredientId, setIngredientId] = useState(item?.ingredient_id ?? "");
  const [group, setGroup] = useState<string>(item?.component_group ?? "main");
  const [netQty, setNetQty] = useState(item ? String(Number(item.net_quantity)) : "");
  const [yieldPct, setYieldPct] = useState(item ? String(Number(item.yield_percent)) : "100");
  const [confirmed, setConfirmed] = useState(item?.quantity_confirmed ?? false);
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const ingredient = ingredients.find((i) => i.id === ingredientId) ?? null;
  const unit: BaseUnit | null = ingredient?.base_unit ?? null;

  const options = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ingredients
      .filter((i) => i.is_active || i.id === ingredientId)
      .filter((i) => !q || i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, "de-CH"));
  }, [ingredients, search, ingredientId]);

  const preview = useMemo(() => {
    if (!ingredient) return null;
    const qty = parseDecimal(netQty);
    const y = parseDecimal(yieldPct);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(y) || y <= 0 || y > 100) return null;
    return calculateItem(
      {
        id: "preview",
        ingredient_id: ingredient.id,
        component_group: group,
        net_quantity: qty,
        quantity_unit: ingredient.base_unit,
        yield_percent: y,
        quantity_source: "manual",
        quantity_confirmed: confirmed,
        sort_order: 0,
      },
      ingredient,
    );
  }, [ingredient, netQty, yieldPct, group, confirmed]);

  const ingUnitPrice = ingredient
    ? unitPrice({
        package_quantity: ingredient.package_quantity,
        package_unit: ingredient.package_unit,
        package_price: ingredient.package_price,
        base_unit: ingredient.base_unit,
      })
    : null;

  const mutation = useMutation({
    mutationFn: async () => {
      const values = {
        ingredient_id: ingredientId,
        component_group: group,
        net_quantity: parseDecimal(netQty),
        quantity_unit: unit!,
        yield_percent: parseDecimal(yieldPct),
        quantity_confirmed: confirmed,
        notes: notes.trim() || null,
      };
      if (item) {
        // A manual edit of an AI-estimated quantity turns it into a manual quantity.
        const changedQty = Number(item.net_quantity) !== values.net_quantity || Number(item.yield_percent) !== values.yield_percent;
        await updateItem(item.id, {
          ...values,
          quantity_source: changedQty ? "manual" : item.quantity_source,
        });
      } else {
        await createItem({ ...values, variant_id: variantId, sort_order: nextSortOrder, quantity_source: "manual" });
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["calculation_items"] });
      toast.success(isEdit ? "Position gespeichert." : "Position hinzugefügt.");
      onOpenChange(false);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen."),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!ingredient) return setError("Bitte eine Zutat auswählen.");
    const qty = parseDecimal(netQty);
    if (!Number.isFinite(qty) || qty <= 0) return setError("Die Nettomenge muss grösser als 0 sein.");
    const y = parseDecimal(yieldPct);
    if (!Number.isFinite(y) || y <= 0 || y > 100) return setError("Die Ausbeute muss zwischen 0 und 100 % liegen.");
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Position bearbeiten" : "Position hinzufügen"}</DialogTitle>
            <DialogDescription>
              Nettomenge pro Portion in der Basiseinheit der Zutat. Bei Ausbeute unter 100 % wird die Bruttoeinsatzmenge (Netto ÷ Ausbeute) berechnet.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label>Zutat *</Label>
              {!isEdit && (
                <Input placeholder="Zutat suchen …" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-1" />
              )}
              <Select value={ingredientId} onValueChange={setIngredientId} disabled={isEdit}>
                <SelectTrigger><SelectValue placeholder="Zutat wählen" /></SelectTrigger>
                <SelectContent>
                  {options.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">Keine Zutat gefunden.</div>}
                  {options.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name} <span className="text-muted-foreground">· {i.category}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {ingredient && (
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                  <span>
                    EK: {ingUnitPrice !== null ? formatUnitPrice(ingUnitPrice, baseUnitLabels[ingredient.base_unit]) : "–"}
                  </span>
                  <StatusBadge tone={ingredient.price_status === "confirmed" ? "success" : "warning"}>
                    {priceStatusLabels[ingredient.price_status]}
                  </StatusBadge>
                  {!ingredient.is_active && <StatusBadge tone="neutral">Inaktiv</StatusBadge>}
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ci-qty">Nettomenge{unit ? ` (${baseUnitLabels[unit]})` : ""} *</Label>
                <Input id="ci-qty" inputMode="decimal" value={netQty} onChange={(e) => setNetQty(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ci-yield">Ausbeute (%) *</Label>
                <Input id="ci-yield" inputMode="decimal" value={yieldPct} onChange={(e) => setYieldPct(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Komponente</Label>
                <Select value={group} onValueChange={setGroup}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COMPONENT_GROUPS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
              {preview && preview.cost !== null && unit ? (
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-muted-foreground">
                    Bruttoeinsatz {formatQuantity(preview.grossQuantity!, baseUnitLabels[unit])}
                  </span>
                  <span className="font-medium tabular">Positionskosten {formatCHF(preview.cost)}</span>
                </div>
              ) : (
                <span className="text-muted-foreground">
                  {preview?.problem ?? "Vorschau erscheint, sobald Zutat, Menge und Ausbeute gültig sind."}
                </span>
              )}
            </div>

            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={confirmed} onCheckedChange={(c) => setConfirmed(c === true)} className="mt-0.5" />
              <span>
                Menge bestätigt
                <span className="block text-xs text-muted-foreground">Nur bestätigen, wenn die Menge in der Küche geprüft wurde. Unbestätigte Mengen gelten als Annahme.</span>
              </span>
            </label>

            <div className="space-y-1.5">
              <Label htmlFor="ci-notes">Notizen</Label>
              <Textarea id="ci-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
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
