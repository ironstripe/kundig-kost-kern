import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createMenuPosition, updateMenuPosition, type MenuPosition } from "@/lib/menus";
import { MENU_COURSES } from "@/lib/event-labels";
import { parseDecimal } from "@/lib/format";
import type { Dish, Variant } from "@/lib/dishes";
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menuVariantId: string;
  dishes: Dish[];
  variants: Variant[];
  position?: MenuPosition | undefined;
};

export function MenuPositionDialog({ open, onOpenChange, menuVariantId, dishes, variants, position }: Props) {
  const qc = useQueryClient();
  const [course, setCourse] = useState(position?.course ?? "main");
  const [variantId, setVariantId] = useState(position?.variant_id ?? "");
  const [quantity, setQuantity] = useState(position ? String(position.quantity_per_guest) : "1");
  const [notes, setNotes] = useState(position?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const options = useMemo(() => {
    const dishById = new Map(dishes.map((d) => [d.id, d]));
    return variants
      .filter((v) => v.is_active)
      .map((v) => ({ id: v.id, label: `${dishById.get(v.dish_id)?.name ?? "Gericht"} – ${v.name}` }))
      .sort((a, b) => a.label.localeCompare(b.label, "de-CH"));
  }, [dishes, variants]);

  const submit = async () => {
    if (!variantId) {
      toast.error("Bitte eine bestehende Gericht-Variante wählen.");
      return;
    }
    const qty = parseDecimal(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Die Menge pro Gast muss grösser als 0 sein.");
      return;
    }
    setSaving(true);
    try {
      const values = { course, variant_id: variantId, quantity_per_guest: qty, notes: notes.trim() || null };
      if (position) await updateMenuPosition(position.id, values);
      else await createMenuPosition({ menu_variant_id: menuVariantId, sort_order: 100, ...values });
      await qc.invalidateQueries({ queryKey: ["menu_positions"] });
      toast.success("Menü-Position gespeichert.");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{position ? "Position bearbeiten" : "Gang hinzufügen"}</DialogTitle>
          <DialogDescription>
            Die Position verweist auf eine bestehende Gericht-Variante. Rezept und Mengen werden nicht kopiert.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Gang</Label>
            <Select value={course} onValueChange={setCourse}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MENU_COURSES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Gericht-Variante</Label>
            <Select value={variantId} onValueChange={setVariantId}>
              <SelectTrigger>
                <SelectValue placeholder="Gericht wählen …" />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="mp-qty">Menge pro Gast</Label>
            <Input id="mp-qty" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="mp-notes">Notiz (optional)</Label>
            <Textarea id="mp-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={saving}>
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
