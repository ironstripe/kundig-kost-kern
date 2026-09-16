import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createMenu, updateMenu, type Menu } from "@/lib/menus";
import { menuStatusLabels } from "@/lib/event-labels";
import { parseDecimal } from "@/lib/format";
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
  userId: string;
  menu?: Menu | undefined;
  onCreated?: (id: string) => void;
};

export function MenuDialog({ open, onOpenChange, userId, menu, onCreated }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState(menu?.name ?? "");
  const [notes, setNotes] = useState(menu?.notes ?? "");
  const [status, setStatus] = useState<Menu["status"]>(menu?.status ?? "draft");
  const [price, setPrice] = useState(
    menu?.gross_price_per_person === null || menu?.gross_price_per_person === undefined
      ? ""
      : String(menu.gross_price_per_person),
  );
  const [vat, setVat] = useState(menu ? String(Number(menu.vat_rate) * 100) : "8.1");
  const [validFrom, setValidFrom] = useState(menu?.valid_from ?? "");
  const [validTo, setValidTo] = useState(menu?.valid_to ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Bitte einen Menünamen erfassen.");
      return;
    }
    const grossValue = price.trim() === "" ? null : parseDecimal(price);
    if (grossValue !== null && (!Number.isFinite(grossValue) || grossValue < 0)) {
      toast.error("Der Brutto-Menüpreis ist ungültig.");
      return;
    }
    const vatValue = parseDecimal(vat);
    if (!Number.isFinite(vatValue) || vatValue < 0 || vatValue >= 100) {
      toast.error("Der MWST-Satz ist ungültig.");
      return;
    }
    setSaving(true);
    try {
      const values = {
        name: name.trim(),
        notes: notes.trim() || null,
        status,
        gross_price_per_person: grossValue,
        vat_rate: vatValue / 100,
        valid_from: validFrom || null,
        valid_to: validTo || null,
      };
      if (menu) {
        await updateMenu(menu.id, values, userId);
        toast.success("Menü gespeichert.");
      } else {
        const created = await createMenu(values, userId);
        toast.success("Menü angelegt.");
        onCreated?.(created.id);
      }
      await qc.invalidateQueries({ queryKey: ["menus"] });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{menu ? "Menü bearbeiten" : "Menü anlegen"}</DialogTitle>
          <DialogDescription>
            Ein Menü ist eine wiederverwendbare Kombination bestehender Gericht-Varianten. Es existiert unabhängig von
            einem Event.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="menu-name">Name</Label>
            <Input id="menu-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="menu-price">Brutto-Preis pro Person (CHF)</Label>
              <Input
                id="menu-price"
                inputMode="decimal"
                placeholder="leer = noch offen"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="menu-vat">MWST-Satz (%)</Label>
              <Input id="menu-vat" inputMode="decimal" value={vat} onChange={(e) => setVat(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="menu-from">Gültig ab (optional)</Label>
              <Input id="menu-from" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="menu-to">Gültig bis (optional)</Label>
              <Input id="menu-to" type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as Menu["status"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(menuStatusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="menu-notes">Notizen</Label>
            <Textarea id="menu-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
