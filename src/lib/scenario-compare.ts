/**
 * Baseline ↔ scenario comparison helpers (pure, no persistence).
 */
import type { MenuLine, MenuTotals } from "@/lib/menu-totals";
import type { MenuCardData } from "@/lib/menu-cards";
import { derivedSales } from "@/lib/sales-planning";
import { unitPrice } from "@/lib/costing";
import { formatCHF, formatNumber, formatPercentPoints, formatQuantity } from "@/lib/format";
import { baseUnitLabels, packageUnitLabels, smallMaterialModeLabels } from "@/lib/labels";
import { diff, ENTITY_LABELS, FIELD_LABELS, type Override, type Overrides } from "@/lib/scenario";

const EPS = 1e-9;
const changed = (a: number | null, b: number | null) => {
  if (a === null && b === null) return false;
  if (a === null || b === null) return true;
  return Math.abs(a - b) > EPS;
};

export type LinePair = {
  key: string;
  kind: MenuLine["kind"];
  id: string;
  name: string;
  dishId: string | null;
  dishName: string;
  categoryId: string | null;
  categoryName: string;
  base: MenuLine;
  scen: MenuLine;
  /** DB I per sale difference (CHF). */
  perSaleDiff: number | null;
  /** Total DB I difference over the validity period (CHF). */
  totalDiff: number | null;
  completedInScenario: boolean;
  affected: boolean;
};

export function compareLines(base: MenuTotals, scen: MenuTotals): LinePair[] {
  const scenByKey = new Map(scen.lines.map((l) => [l.key, l]));
  const pairs: LinePair[] = [];
  for (const b of base.lines) {
    const s = scenByKey.get(b.key);
    if (!s || !b.isActive) continue;
    const perSaleDiff = diff(b.result.contributionMargin1, s.result.contributionMargin1);
    const totalDiff = diff(b.contributionMargin1, s.contributionMargin1);
    const completedInScenario = !b.result.complete && s.result.complete;
    const affected =
      changed(b.result.contributionMargin1, s.result.contributionMargin1) ||
      changed(b.contributionMargin1, s.contributionMargin1) ||
      changed(b.result.netPrice, s.result.netPrice) ||
      changed(b.result.foodCost, s.result.foodCost) ||
      changed(b.total, s.total) ||
      b.result.complete !== s.result.complete;
    pairs.push({
      key: b.key,
      kind: b.kind,
      id: b.id,
      name: b.name,
      dishId: b.dishId,
      dishName: b.dishName,
      categoryId: b.categoryId,
      categoryName: b.categoryName,
      base: b,
      scen: s,
      perSaleDiff,
      totalDiff,
      completedInScenario,
      affected,
    });
  }
  return pairs;
}

export const COMPLETED_IN_SCENARIO_LABEL = "Im Szenario vollständig – Basis weiterhin unvollständig";

// ---------------------------------------------------------------------------
// Human readable override rows for «Geänderte Annahmen»
// ---------------------------------------------------------------------------

export type OverrideRow = {
  key: string;
  override: Override;
  group: "Verkaufspreise" | "Verkaufsmengen" | "Einkaufspreise" | "Rezeptmengen" | "Kleinmaterial";
  entityLabel: string;
  /** Dish or ingredient name. */
  subject: string;
  /** Variant / add-on name (or "–"). */
  target: string;
  fieldLabel: string;
  baseText: string;
  scenText: string;
  diffText: string;
};

export function describeOverrides(data: MenuCardData, overrides: Overrides, sellingDays: number): OverrideRow[] {
  const dishById = new Map(data.dishes.map((d) => [d.id, d]));
  const variantById = new Map(data.variants.map((v) => [v.id, v]));
  const addOnById = new Map(data.addOns.map((a) => [a.id, a]));
  const ingById = new Map(data.ingredients.map((i) => [i.id, i]));
  const itemById = new Map(data.items.map((i) => [i.id, i]));

  const chfDiff = (b: number, s: number) => signed(s - b, (v) => formatCHF(v));
  const numDiff = (b: number, s: number, unit?: string) => signed(s - b, (v) => formatQuantity(v, unit));

  const rows: OverrideRow[] = [];
  for (const [key, o] of Object.entries(overrides)) {
    const value = o.value;
    if (o.entity === "variant" || o.entity === "add_on") {
      const row = o.entity === "variant" ? variantById.get(o.id) : addOnById.get(o.id);
      if (!row) continue;
      const subject = o.entity === "variant" ? (dishById.get((row as { dish_id: string }).dish_id)?.name ?? "–") : "Add-on";
      if (o.field === "gross_price" && typeof value === "number") {
        const b = Number(row.gross_price);
        rows.push(mk(key, o, "Verkaufspreise", subject, row.name, formatCHF(b), formatCHF(value), chfDiff(b, value)));
      } else if ((o.field === "per_day" || o.field === "total") && typeof value === "number") {
        const bs = derivedSales(row, sellingDays);
        const b = o.field === "per_day" ? bs.perDay : bs.total;
        const unit = o.field === "per_day" ? "pro Tag" : "gesamt";
        rows.push(
          mk(key, o, "Verkaufsmengen", subject, row.name, b === null ? "–" : formatQuantity(b, unit), formatQuantity(value, unit), b === null ? "–" : numDiff(b, value)),
        );
      }
    } else if (o.entity === "ingredient" && typeof value === "number") {
      const ing = ingById.get(o.id);
      if (!ing) continue;
      const b = Number(ing.package_price);
      const pkg = `${formatQuantity(Number(ing.package_quantity))} ${packageUnitLabels[ing.package_unit]}`;
      rows.push(mk(key, o, "Einkaufspreise", ing.name, `Gebinde ${pkg}`, formatCHF(b), formatCHF(value), chfDiff(b, value)));
    } else if (o.entity === "item" && typeof value === "number") {
      const it = itemById.get(o.id);
      if (!it) continue;
      const ing = ingById.get(it.ingredient_id);
      const owner = it.variant_id ? variantById.get(it.variant_id) : it.add_on_id ? addOnById.get(it.add_on_id) : undefined;
      const dishName = it.variant_id && owner ? (dishById.get((owner as { dish_id: string }).dish_id)?.name ?? "–") : "Add-on";
      const target = owner ? owner.name : "–";
      const subject = `${dishName} · ${ing?.name ?? "Zutat"}`;
      if (o.field === "net_quantity") {
        const unit = baseUnitLabels[it.quantity_unit];
        const b = Number(it.net_quantity);
        rows.push(mk(key, o, "Rezeptmengen", subject, target, formatQuantity(b, unit), formatQuantity(value, unit), numDiff(b, value, unit)));
      } else if (o.field === "yield_percent") {
        const b = Number(it.yield_percent);
        rows.push(mk(key, o, "Rezeptmengen", subject, target, formatPercentPoints(b), formatPercentPoints(value), signed(value - b, (v) => `${formatNumber(v, 1)} %-Pkt.`)));
      }
    } else if (o.entity === "card") {
      const card = data.card;
      if (o.field === "small_material_mode" && typeof value === "string") {
        rows.push(
          mk(key, o, "Kleinmaterial", card.name, "–", smallMaterialModeLabels[card.small_material_mode], smallMaterialModeLabels[value as keyof typeof smallMaterialModeLabels] ?? value, "–"),
        );
      } else if (o.field === "small_material_value" && typeof value === "number") {
        const mode = (overrides[`card:${card.id}:small_material_mode`]?.value as string | undefined) ?? card.small_material_mode;
        const b = Number(card.small_material_value);
        if (mode === "percent") {
          rows.push(mk(key, o, "Kleinmaterial", card.name, "–", formatPercentPoints(b * 100), formatPercentPoints(value * 100), signed((value - b) * 100, (v) => `${formatNumber(v, 1)} %-Pkt.`)));
        } else {
          rows.push(mk(key, o, "Kleinmaterial", card.name, "–", formatCHF(b), formatCHF(value), chfDiff(b, value)));
        }
      }
    }
  }
  const order = { Verkaufspreise: 0, Verkaufsmengen: 1, Einkaufspreise: 2, Rezeptmengen: 3, Kleinmaterial: 4 };
  return rows.sort((a, b) => order[a.group] - order[b.group] || a.subject.localeCompare(b.subject, "de-CH"));
}

function mk(
  key: string,
  override: Override,
  group: OverrideRow["group"],
  subject: string,
  target: string,
  baseText: string,
  scenText: string,
  diffText: string,
): OverrideRow {
  return {
    key,
    override,
    group,
    entityLabel: ENTITY_LABELS[override.entity],
    subject,
    target,
    fieldLabel: FIELD_LABELS[override.field],
    baseText,
    scenText,
    diffText,
  };
}

export function signed(v: number, fmt: (abs: number) => string): string {
  if (Math.abs(v) < EPS) return `± ${fmt(0)}`;
  return `${v > 0 ? "+" : "−"} ${fmt(Math.abs(v))}`;
}

/** Ingredient unit price for display (CHF per base unit), null when invalid. */
export function ingredientUnitPrice(ing: MenuCardData["ingredients"][number], packagePrice?: number): number | null {
  return unitPrice({ ...ing, package_price: packagePrice ?? ing.package_price });
}
