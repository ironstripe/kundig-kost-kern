import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createMenuVariant,
  createMenuPositions,
  updateMenuVariant,
  type MenuPosition,
  type MenuVariant,
} from "@/lib/menus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  menuId: string;
  variant?: MenuVariant | undefined;
  /** Existing variants of this menu – offered as a starting point for a new one. */
  sourceVariants?: MenuVariant[];
  /** All menu positions – used when copying a composition. */
  positions?: MenuPosition[];
  /** Hidden when the menu has only one variant. */
  showDefaultSwitch?: boolean;
};

const EMPTY = "__empty__";

export function MenuVariantDialog({
  open,
  onOpenChange,
  menuId,
  variant,
  sourceVariants = [],
  positions = [],
  showDefaultSwitch = true,
}: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState(variant?.name ?? "Standard");
  const [isDefault, setIsDefault] = useState(variant?.is_default ?? false);
  const [guests, setGuests] = useState(variant?.expected_guests === null || variant?.expected_guests === undefined ? "" : String(variant.expected_guests));
  const [notes, setNotes] = useState(variant?.notes ?? "");
  const [copyFrom, setCopyFrom] = useState<string>(sourceVariants[0]?.id ?? EMPTY);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (saving) return;
    if (!name.trim()) {
      toast.error("Bitte einen Variantennamen erfassen.");
      return;
    }
    let expected: number | null = null;
    if (guests.trim() !== "") {
      expected = Number(guests);
      if (!Number.isInteger(expected) || expected < 0) {
        toast.error("Die erwartete Gästezahl muss 0 oder grösser sein.");
        return;
      }
    }
    setSaving(true);
    try {
      const values = { name: name.trim(), is_default: isDefault, expected_guests: expected, notes: notes.trim() || null };
      if (variant) {
        await updateMenuVariant(variant.id, values);
      } else {
        const created = await createMenuVariant({ menu_id: menuId, sort_order: 100, ...values });
        if (copyFrom !== EMPTY) {
          const own = positions.filter((p) => p.menu_variant_id === copyFrom);
          await createMenuPositions(
            own.map((p) => ({
              menu_variant_id: created.id,
              course: p.course,
              variant_id: p.variant_id,
              quantity_per_guest: p.quantity_per_guest,
              sort_order: p.sort_order,
              notes: p.notes,
            })),
          );
          await qc.invalidateQueries({ queryKey: ["menu_positions"] });
        }
      }
      await qc.invalidateQueries({ queryKey: ["menu_variants"] });
      toast.success("Menüvariante gespeichert.");
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
          <DialogTitle>{variant ? "Menüvariante bearbeiten" : "Weitere Menüvariante"}</DialogTitle>
          <DialogDescription>Zum Beispiel Standard, Vegetarisch, Kinder oder ein Allergie-/Sondermenü.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="mv-name">Name</Label>
            <Input id="mv-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {!variant && sourceVariants.length > 0 && (
            <div className="grid gap-1.5">
              <Label>Zusammenstellung</Label>
              <Select value={copyFrom} onValueChange={setCopyFrom}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sourceVariants.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      Gänge von «{v.name}» übernehmen
                    </SelectItem>
                  ))}
                  <SelectItem value={EMPTY}>Leer starten</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Übernommen werden nur die Zuordnungen zu bestehenden Gericht-Varianten. Rezepte werden nicht
                dupliziert; einzelne Gänge können danach ersetzt werden.
              </p>
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="mv-guests">Erwartete Gäste (optional)</Label>
            <Input id="mv-guests" inputMode="numeric" value={guests} onChange={(e) => setGuests(e.target.value)} />
          </div>
          {showDefaultSwitch && (
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <Label htmlFor="mv-default" className="font-normal">
                Standardvariante
              </Label>
              <Switch id="mv-default" checked={isDefault} onCheckedChange={setIsDefault} />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="mv-notes">Notizen</Label>
            <Textarea id="mv-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
