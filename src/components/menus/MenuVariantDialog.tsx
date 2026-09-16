import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createMenuVariant, updateMenuVariant, type MenuVariant } from "@/lib/menus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
};

export function MenuVariantDialog({ open, onOpenChange, menuId, variant }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState(variant?.name ?? "Standard");
  const [isDefault, setIsDefault] = useState(variant?.is_default ?? false);
  const [guests, setGuests] = useState(variant?.expected_guests === null || variant?.expected_guests === undefined ? "" : String(variant.expected_guests));
  const [notes, setNotes] = useState(variant?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
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
      if (variant) await updateMenuVariant(variant.id, values);
      else await createMenuVariant({ menu_id: menuId, sort_order: 100, ...values });
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
          <DialogTitle>{variant ? "Menüvariante bearbeiten" : "Menüvariante anlegen"}</DialogTitle>
          <DialogDescription>Zum Beispiel Standard, Vegetarisch, Kinder oder ein Allergie-/Sondermenü.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="mv-name">Name</Label>
            <Input id="mv-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="mv-guests">Erwartete Gäste (optional)</Label>
            <Input id="mv-guests" inputMode="numeric" value={guests} onChange={(e) => setGuests(e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <Label htmlFor="mv-default" className="font-normal">
              Standardvariante
            </Label>
            <Switch id="mv-default" checked={isDefault} onCheckedChange={setIsDefault} />
          </div>
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
