/**
 * Searchable multi-selection of existing dish variants for a menu variant.
 * Positions reference the dish variant – recipes are never duplicated.
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { createMenuPositions, type MenuPosition } from "@/lib/menus";
import { menuCardsQuery } from "@/lib/menu-cards";
import { calculateVariant } from "@/lib/costing";
import type { MenuCostingContext } from "@/lib/menu-costing";
import { MENU_COURSES, courseLabels } from "@/lib/event-labels";
import { calculationStatusLabels } from "@/lib/labels";
import { formatCHF, parseDecimal } from "@/lib/format";
import type { Dish, Variant } from "@/lib/dishes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/layout/StatusBadge";
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
  /** Positions already assigned to this menu variant (duplicate detection). */
  existingPositions: MenuPosition[];
  ctx: MenuCostingContext;
  dishes: Dish[];
  variants: Variant[];
  /** Opens the edit dialog of an already present position instead of adding again. */
  onEditExisting?: (position: MenuPosition) => void;
};

type Selection = { course: string; quantity: string };

export function DishPickerDialog({
  open,
  onOpenChange,
  menuVariantId,
  existingPositions,
  ctx,
  dishes,
  variants,
  onEditExisting,
}: Props) {
  const qc = useQueryClient();
  const { data: cards } = useQuery(menuCardsQuery);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, Selection>>({});
  const [saving, setSaving] = useState(false);

  const cardName = useMemo(() => new Map((cards ?? []).map((c) => [c.id, c.name])), [cards]);

  const rows = useMemo(() => {
    const dishById = new Map(dishes.map((d) => [d.id, d]));
    return variants
      .map((v) => {
        const dish = dishById.get(v.dish_id);
        if (!dish) return null;
        const card = ctx.cardsById.get(dish.menu_card_id) ?? null;
        const result = calculateVariant(v, ctx.itemsByVariant.get(v.id) ?? [], ctx.ingredientsById, card);
        return {
          variantId: v.id,
          dishName: dish.name,
          variantName: v.name,
          cardName: cardName.get(dish.menu_card_id) ?? "–",
          foodCost: result.foodCost,
          problems: result.problems,
          status: v.calculation_status,
          inactive: !dish.is_active || !v.is_active,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => `${a.dishName} ${a.variantName}`.localeCompare(`${b.dishName} ${b.variantName}`, "de-CH"));
  }, [dishes, variants, ctx, cardName]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => `${r.dishName} ${r.variantName} ${r.cardName}`.toLowerCase().includes(q));
  }, [rows, search]);

  const count = Object.keys(selected).length;

  const toggle = (variantId: string, on: boolean) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (on) next[variantId] = prev[variantId] ?? { course: "main", quantity: "1" };
      else delete next[variantId];
      return next;
    });
  };

  const patch = (variantId: string, part: Partial<Selection>) =>
    setSelected((prev) => ({ ...prev, [variantId]: { ...(prev[variantId] ?? { course: "main", quantity: "1" }), ...part } }));

  const duplicateOf = (variantId: string, course: string) =>
    existingPositions.find((p) => p.variant_id === variantId && p.course === course) ?? null;

  const submit = async () => {
    if (saving) return;
    const entries = Object.entries(selected);
    if (entries.length === 0) {
      toast.error("Bitte mindestens eine Gericht-Variante wählen.");
      return;
    }
    const rowsToInsert = [];
    let base = existingPositions.reduce((m, p) => Math.max(m, p.sort_order), 0);
    for (const [variantId, sel] of entries) {
      if (duplicateOf(variantId, sel.course)) continue;
      const qty = parseDecimal(sel.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        toast.error("Die Menge pro Gast muss grösser als 0 sein.");
        return;
      }
      base += 10;
      rowsToInsert.push({
        menu_variant_id: menuVariantId,
        course: sel.course,
        variant_id: variantId,
        quantity_per_guest: qty,
        sort_order: base,
      });
    }
    if (rowsToInsert.length === 0) {
      toast.error("Alle gewählten Gerichte sind in diesem Gang bereits enthalten.");
      return;
    }
    setSaving(true);
    try {
      await createMenuPositions(rowsToInsert);
      await qc.invalidateQueries({ queryKey: ["menu_positions"] });
      toast.success(
        rowsToInsert.length === 1 ? "1 Gericht hinzugefügt." : `${rowsToInsert.length} Gerichte hinzugefügt.`,
      );
      setSelected({});
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Gerichte hinzufügen</DialogTitle>
          <DialogDescription>
            Wählen Sie bestehende Gericht-Varianten aus allen Speisekarten. 1 = eine Portion der gewählten
            Gericht-Variante pro Gast. Rezepte und Mengen werden nicht kopiert.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Gericht, Variante oder Speisekarte suchen …"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="max-h-[45vh] space-y-2 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Keine passende Gericht-Variante gefunden.</p>
          )}
          {filtered.map((r) => {
            const sel = selected[r.variantId];
            const dup = sel ? duplicateOf(r.variantId, sel.course) : null;
            return (
              <div key={r.variantId} className="rounded-md border px-3 py-2.5">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id={`pick-${r.variantId}`}
                    className="mt-1"
                    checked={Boolean(sel)}
                    onCheckedChange={(c) => toggle(r.variantId, c === true)}
                  />
                  <div className="min-w-0 flex-1">
                    <Label htmlFor={`pick-${r.variantId}`} className="cursor-pointer font-medium">
                      {r.dishName} – {r.variantName}
                    </Label>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{r.cardName}</span>
                      <span>
                        Wareneinsatz:{" "}
                        {r.foodCost === null ? "unvollständig" : `${formatCHF(r.foodCost)} pro Portion`}
                      </span>
                      <StatusBadge tone={r.status === "reviewed" ? "success" : "muted"}>
                        {calculationStatusLabels[r.status]}
                      </StatusBadge>
                      {r.foodCost === null && (
                        <StatusBadge tone="warning">
                          Kalkulation unvollständig{r.problems.length ? `: ${r.problems[0]}` : ""}
                        </StatusBadge>
                      )}
                      {r.inactive && <StatusBadge tone="muted">À la carte inaktiv</StatusBadge>}
                    </div>
                  </div>
                </div>
                {sel && (
                  <div className="mt-3 grid gap-3 pl-7 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Gang</Label>
                      <Select value={sel.course} onValueChange={(v) => patch(r.variantId, { course: v })}>
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
                      <Label className="text-xs">Menge pro Gast</Label>
                      <Input
                        inputMode="decimal"
                        value={sel.quantity}
                        onChange={(e) => patch(r.variantId, { quantity: e.target.value })}
                      />
                    </div>
                    {dup && (
                      <p className="sm:col-span-2 text-xs text-warning-foreground">
                        Bereits im Gang «{courseLabels[sel.course] ?? sel.course}» enthalten – diese Auswahl wird
                        nicht erneut hinzugefügt.{" "}
                        {onEditExisting && (
                          <button
                            type="button"
                            className="underline"
                            onClick={() => {
                              onOpenChange(false);
                              onEditExisting(dup);
                            }}
                          >
                            Menge bearbeiten
                          </button>
                        )}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={saving || count === 0}>
            {count === 1 ? "1 Gericht hinzufügen" : `${count} Gerichte hinzufügen`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
