import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createCategory, createDish, createVariant, updateDish, type Category, type Dish } from "@/lib/dishes";
import { parseDecimal } from "@/lib/format";
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

const NEW_CATEGORY = "__new__";
const NO_CATEGORY = "__none__";

type Props = {
  dish?: Dish | null;
  categories: Category[];
  menuCardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (dishId: string) => void;
};

export function DishDialog({ dish, categories, menuCardId, open, onOpenChange, onCreated }: Props) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(dish);
  const [name, setName] = useState(dish?.name ?? "");
  const [description, setDescription] = useState(dish?.description ?? "");
  const [categoryId, setCategoryId] = useState<string>(dish?.category_id ?? NO_CATEGORY);
  const [newCategory, setNewCategory] = useState("");
  const [notes, setNotes] = useState(dish?.notes ?? "");
  const [isActive, setIsActive] = useState(dish?.is_active ?? true);
  // First variant (only on create)
  const [variantName, setVariantName] = useState("Normal");
  const [grossPrice, setGrossPrice] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      let catId: string | null = categoryId === NO_CATEGORY ? null : categoryId;
      if (categoryId === NEW_CATEGORY) {
        const cat = await createCategory(menuCardId, newCategory);
        catId = cat.id;
      }
      const values = {
        name: name.trim(),
        description: description.trim() || null,
        category_id: catId,
        notes: notes.trim() || null,
        is_active: isActive,
      };
      if (dish) {
        await updateDish(dish.id, values);
        return dish.id;
      }
      const created = await createDish({ ...values, menu_card_id: menuCardId, source_type: "manual" });
      await createVariant({
        dish_id: created.id,
        name: variantName.trim() || "Normal",
        gross_price: parseDecimal(grossPrice),
        is_default: true,
        calculation_status: "estimated",
      });
      return created.id;
    },
    onSuccess: async (id) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dishes"] }),
        queryClient.invalidateQueries({ queryKey: ["variants"] }),
        queryClient.invalidateQueries({ queryKey: ["categories"] }),
      ]);
      toast.success(isEdit ? "Gericht gespeichert." : `Gericht «${name.trim()}» angelegt.`);
      onOpenChange(false);
      if (!isEdit) onCreated?.(id);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen."),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError("Bitte einen Namen eingeben.");
    if (categoryId === NEW_CATEGORY && newCategory.trim().length < 2) return setError("Bitte eine neue Kategorie benennen.");
    if (!isEdit) {
      const p = parseDecimal(grossPrice);
      if (!Number.isFinite(p) || p <= 0) return setError("Bitte einen Brutto-Verkaufspreis grösser als 0 eingeben.");
    }
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Gericht bearbeiten" : "Gericht hinzufügen"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Stammdaten des Gerichts. Varianten und Kalkulation werden in der Detailansicht gepflegt."
                : "Jedes Gericht startet mit einer Standardvariante. Weitere Varianten können danach ergänzt werden."}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="d-name">Gericht *</Label>
              <Input id="d-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Kategorie</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CATEGORY}>Ohne Kategorie</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                  <SelectItem value={NEW_CATEGORY}>Neue Kategorie …</SelectItem>
                </SelectContent>
              </Select>
              {categoryId === NEW_CATEGORY && (
                <Input placeholder="Name der neuen Kategorie" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-desc">Beschreibung</Label>
              <Textarea id="d-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            {!isEdit && (
              <fieldset className="rounded-md border p-3">
                <legend className="px-1 text-xs font-medium text-muted-foreground">Erste Variante</legend>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="v-name">Variante</Label>
                    <Input id="v-name" value={variantName} onChange={(e) => setVariantName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="v-price">Brutto-VK (CHF) *</Label>
                    <Input id="v-price" inputMode="decimal" value={grossPrice} onChange={(e) => setGrossPrice(e.target.value)} required />
                  </div>
                </div>
              </fieldset>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="d-notes">Notizen</Label>
              <Textarea id="d-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={isActive} onCheckedChange={(c) => setIsActive(c === true)} />
              Aktiv
            </label>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Speichern …" : isEdit ? "Speichern" : "Gericht anlegen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
