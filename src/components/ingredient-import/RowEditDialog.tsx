import { useState, type FormEvent } from "react";
import type { ParsedValues } from "@/lib/ingredient-import-schema";
import { validateValues, rowUnitPrice } from "@/lib/ingredient-import-schema";
import { PACKAGE_TO_BASE, type BaseUnit, type PackageUnit } from "@/lib/costing";
import { parseDecimal, formatUnitPrice } from "@/lib/format";
import { baseUnitLabels, packageUnitLabels } from "@/lib/labels";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Props = {
  row: number;
  values: ParsedValues;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (v: ParsedValues) => void;
};

export function RowEditDialog({ row, values, open, onOpenChange, onSave }: Props) {
  const [name, setName] = useState(values.name);
  const [category, setCategory] = useState(values.category);
  const [supplier, setSupplier] = useState(values.supplier ?? "");
  const [qty, setQty] = useState(values.package_quantity?.toString() ?? "");
  const [pu, setPu] = useState<PackageUnit | "">(values.package_unit ?? "");
  const [label, setLabel] = useState(values.package_label ?? "");
  const [price, setPrice] = useState(values.package_price?.toString() ?? "");
  const [bu, setBu] = useState<BaseUnit | "">(values.base_unit ?? "");
  const [date, setDate] = useState(values.price_date ?? "");
  const [own, setOwn] = useState(values.is_own_production ?? false);
  const [notes, setNotes] = useState(values.notes ?? "");
  const [errors, setErrors] = useState<string[]>([]);

  const build = (): ParsedValues => ({
    name: name.trim().replace(/\s+/g, " "),
    category: category.trim(),
    supplier: supplier.trim() || null,
    package_quantity: qty.trim() ? parseDecimal(qty) : null,
    package_unit: pu || null,
    package_label: label.trim() || null,
    package_price: price.trim() ? parseDecimal(price) : null,
    base_unit: bu || null,
    price_date: date.trim() || null,
    is_own_production: own,
    notes: notes.trim() || null,
  });
  const preview = rowUnitPrice(build());

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = build();
    const errs = validateValues(v).filter((i) => i.level === "error").map((i) => i.message);
    setErrors(errs);
    if (errs.length) return;
    onSave(v);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Zeile {row} korrigieren</DialogTitle>
            <DialogDescription>Änderungen gelten nur für diesen Import. Die Excel-Datei bleibt unverändert.</DialogDescription>
          </DialogHeader>
          {errors.length > 0 && (
            <Alert variant="destructive"><AlertDescription><ul className="list-disc pl-4">{errors.map((e) => <li key={e}>{e}</li>)}</ul></AlertDescription></Alert>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label>Zutatenname *</Label><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></div>
            <div><Label>Kategorie *</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} maxLength={80} /></div>
            <div><Label>Lieferant</Label><Input value={supplier} onChange={(e) => setSupplier(e.target.value)} maxLength={120} /></div>
            <div><Label>Gebindemenge *</Label><Input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
            <div>
              <Label>Gebindeeinheit *</Label>
              <Select value={pu} onValueChange={(v) => { setPu(v as PackageUnit); setBu(PACKAGE_TO_BASE[v as PackageUnit]); }}>
                <SelectTrigger><SelectValue placeholder="Wählen" /></SelectTrigger>
                <SelectContent>{(Object.keys(packageUnitLabels) as PackageUnit[]).map((u) => <SelectItem key={u} value={u}>{packageUnitLabels[u]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Gebindepreis (CHF) *</Label><Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
            <div>
              <Label>Basiseinheit *</Label>
              <Select value={bu} onValueChange={(v) => setBu(v as BaseUnit)}>
                <SelectTrigger><SelectValue placeholder="Wählen" /></SelectTrigger>
                <SelectContent>{(Object.keys(baseUnitLabels) as BaseUnit[]).map((u) => <SelectItem key={u} value={u}>{baseUnitLabels[u]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Gebindebezeichnung</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} /></div>
            <div><Label>Preisstand (JJJJ-MM-TT)</Label><Input value={date} onChange={(e) => setDate(e.target.value)} placeholder="2026-08-01" /></div>
            <div className="flex items-center gap-2 pt-5">
              <Checkbox id={`own-${row}`} checked={own} onCheckedChange={(c) => setOwn(c === true)} />
              <Label htmlFor={`own-${row}`}>Eigene Produktion</Label>
            </div>
            <div className="sm:col-span-2"><Label>Notiz</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} /></div>
          </div>
          <p className="text-xs text-muted-foreground">
            Berechneter EK je Basiseinheit: {preview !== null && bu ? formatUnitPrice(preview, baseUnitLabels[bu]) : "–"}
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button type="submit">Übernehmen</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
