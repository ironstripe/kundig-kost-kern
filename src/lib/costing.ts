/**
 * KundiCalc costing engine.
 *
 * All financial results are derived here from current source data
 * (ingredients, calculation items, variant, menu card). Nothing in this
 * module is persisted – results are recomputed on every render.
 *
 * Units: purchase units kg | g | l | ml | piece; base units g | ml | piece.
 * Weight is never converted to volume or vice versa.
 */
import type { Database } from "@/integrations/supabase/types";

type Enums = Database["public"]["Enums"];
export type PackageUnit = Enums["package_unit"];
export type BaseUnit = Enums["base_unit"];
export type SmallMaterialMode = Enums["small_material_mode"];
export type PriceStatus = Enums["price_status"];
export type QuantitySource = Enums["quantity_source"];
export type CalculationStatus = Enums["calculation_status"];

export const VAT_RATE_DEFAULT = 0.081;

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

/** Base unit a purchase unit resolves to. */
export const PACKAGE_TO_BASE: Record<PackageUnit, BaseUnit> = {
  kg: "g",
  g: "g",
  l: "ml",
  ml: "ml",
  piece: "piece",
};

/** Factor to convert one purchase unit into base units (kg → 1000 g). */
export const PACKAGE_FACTOR: Record<PackageUnit, number> = {
  kg: 1000,
  g: 1,
  l: 1000,
  ml: 1,
  piece: 1,
};

export function isCompatibleUnit(packageUnit: PackageUnit, baseUnit: BaseUnit): boolean {
  return PACKAGE_TO_BASE[packageUnit] === baseUnit;
}

/**
 * Price per base unit (CHF/g, CHF/ml or CHF/piece).
 * Returns null when the input cannot produce a valid price.
 */
export function unitPrice(input: {
  package_quantity: number | string;
  package_unit: PackageUnit;
  package_price: number | string;
  base_unit: BaseUnit;
}): number | null {
  const qty = Number(input.package_quantity);
  const price = Number(input.package_price);
  if (!Number.isFinite(qty) || !Number.isFinite(price) || qty <= 0 || price < 0) return null;
  if (!isCompatibleUnit(input.package_unit, input.base_unit)) return null;
  return price / (qty * PACKAGE_FACTOR[input.package_unit]);
}

// ---------------------------------------------------------------------------
// Types used by the engine (structural – DB rows satisfy them)
// ---------------------------------------------------------------------------

export type IngredientLike = {
  id: string;
  name: string;
  package_quantity: number | string;
  package_unit: PackageUnit;
  package_price: number | string;
  base_unit: BaseUnit;
  price_status: PriceStatus;
  is_active: boolean;
};

export type ItemLike = {
  id: string;
  ingredient_id: string;
  component_group: string;
  net_quantity: number | string;
  quantity_unit: BaseUnit;
  yield_percent: number | string;
  quantity_source: QuantitySource;
  quantity_confirmed: boolean;
  sort_order: number;
  notes?: string | null;
};

export type VariantLike = {
  id: string;
  name: string;
  gross_price: number | string;
  small_material_override_mode: SmallMaterialMode | null;
  small_material_override_value: number | string | null;
  calculation_status: CalculationStatus;
};

export type MenuCardLike = {
  vat_rate: number | string;
  small_material_mode: SmallMaterialMode;
  small_material_value: number | string;
};

// ---------------------------------------------------------------------------
// Item calculation
// ---------------------------------------------------------------------------

export type ItemResult = {
  item: ItemLike;
  ingredient: IngredientLike | null;
  /** Gross input quantity in base units (net / yield). */
  grossQuantity: number | null;
  unitPrice: number | null;
  cost: number | null;
  /** German reason why the item could not be calculated. */
  problem: string | null;
};

export function calculateItem(item: ItemLike, ingredient: IngredientLike | null | undefined): ItemResult {
  const base: ItemResult = { item, ingredient: ingredient ?? null, grossQuantity: null, unitPrice: null, cost: null, problem: null };
  if (!ingredient) return { ...base, problem: "Zutat fehlt" };
  const net = Number(item.net_quantity);
  const yieldPct = Number(item.yield_percent);
  if (!Number.isFinite(net) || net <= 0) return { ...base, problem: "Nettomenge fehlt" };
  if (!Number.isFinite(yieldPct) || yieldPct <= 0 || yieldPct > 100) return { ...base, problem: "Ausbeute ungültig" };
  if (item.quantity_unit !== ingredient.base_unit) return { ...base, problem: "Einheit passt nicht zur Zutat" };
  const price = unitPrice(ingredient);
  if (price === null) return { ...base, problem: "Einkaufspreis unvollständig" };
  const grossQuantity = net / (yieldPct / 100);
  const cost = grossQuantity * price;
  if (!Number.isFinite(cost)) return { ...base, grossQuantity, unitPrice: price, problem: "Berechnung ungültig" };
  return { ...base, grossQuantity, unitPrice: price, cost };
}

// ---------------------------------------------------------------------------
// Variant calculation
// ---------------------------------------------------------------------------

export type VariantResult = {
  variant: VariantLike;
  items: ItemResult[];
  grossPrice: number | null;
  netPrice: number | null;
  ingredientCost: number | null;
  smallMaterialCost: number | null;
  smallMaterial: { mode: SmallMaterialMode; value: number; source: "variant" | "menu_card" };
  foodCost: number | null;
  foodCostRatio: number | null;
  contributionMargin1: number | null;
  contributionMarginRatio: number | null;
  /** Reasons the result is incomplete (German, user facing). */
  problems: string[];
  complete: boolean;
  /** Any item uses an ingredient with estimated price. */
  hasEstimatedPrices: boolean;
  /** Any item quantity not confirmed. */
  hasUnconfirmedQuantities: boolean;
  hasEstimatedQuantities: boolean;
};

export function resolveSmallMaterial(variant: VariantLike, card: MenuCardLike | null): VariantResult["smallMaterial"] {
  if (variant.small_material_override_mode && variant.small_material_override_value !== null) {
    return {
      mode: variant.small_material_override_mode,
      value: Number(variant.small_material_override_value),
      source: "variant",
    };
  }
  return {
    mode: card?.small_material_mode ?? "percent",
    value: card ? Number(card.small_material_value) : 0.03,
    source: "menu_card",
  };
}

export function calculateVariant(
  variant: VariantLike,
  items: ItemLike[],
  ingredientsById: Map<string, IngredientLike>,
  card: MenuCardLike | null,
): VariantResult {
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  const itemResults = sorted.map((it) => calculateItem(it, ingredientsById.get(it.ingredient_id)));
  const problems: string[] = [];

  const vat = card ? Number(card.vat_rate) : VAT_RATE_DEFAULT;
  const gross = Number(variant.gross_price);
  let grossPrice: number | null = null;
  let netPrice: number | null = null;
  if (!Number.isFinite(gross) || gross <= 0) {
    problems.push("Brutto-Verkaufspreis fehlt");
  } else {
    grossPrice = gross;
    netPrice = gross / (1 + vat);
  }

  if (itemResults.length === 0) problems.push("Keine Kalkulationspositionen");
  const brokenItems = itemResults.filter((r) => r.cost === null);
  for (const r of brokenItems) {
    problems.push(`${r.ingredient?.name ?? "Position"}: ${r.problem}`);
  }

  let ingredientCost: number | null = null;
  if (itemResults.length > 0 && brokenItems.length === 0) {
    ingredientCost = itemResults.reduce((s, r) => s + (r.cost ?? 0), 0);
  }

  const smallMaterial = resolveSmallMaterial(variant, card);
  let smallMaterialCost: number | null = null;
  if (ingredientCost !== null) {
    smallMaterialCost =
      smallMaterial.mode === "percent" ? ingredientCost * smallMaterial.value : smallMaterial.value;
    if (!Number.isFinite(smallMaterialCost)) {
      smallMaterialCost = null;
      problems.push("Kleinmaterial ungültig");
    }
  }

  const foodCost = ingredientCost !== null && smallMaterialCost !== null ? ingredientCost + smallMaterialCost : null;
  const np: number | null = netPrice;
  const canRatio = foodCost !== null && np !== null && np > 0;
  const foodCostRatio = foodCost !== null && np !== null && np > 0 ? (foodCost / np) * 100 : null;
  const contributionMargin1 = foodCost !== null && np !== null ? np - foodCost : null;
  const contributionMarginRatio =
    canRatio && contributionMargin1 !== null && np !== null && np > 0 ? (contributionMargin1 / np) * 100 : null;

  const hasEstimatedPrices = itemResults.some((r) => r.ingredient?.price_status === "estimated");
  const hasUnconfirmedQuantities = itemResults.some((r) => !r.item.quantity_confirmed);
  const hasEstimatedQuantities = itemResults.some((r) => r.item.quantity_source === "ai_estimate");

  return {
    variant,
    items: itemResults,
    grossPrice,
    netPrice,
    ingredientCost,
    smallMaterialCost,
    smallMaterial,
    foodCost,
    foodCostRatio,
    contributionMargin1,
    contributionMarginRatio,
    problems,
    complete: problems.length === 0 && contributionMarginRatio !== null,
    hasEstimatedPrices,
    hasUnconfirmedQuantities,
    hasEstimatedQuantities,
  };
}

// ---------------------------------------------------------------------------
// Review rules
// ---------------------------------------------------------------------------

/** Returns the German reasons why a variant cannot be marked as reviewed. */
export function reviewBlockers(result: VariantResult): string[] {
  const reasons: string[] = [];
  if (result.items.length === 0) reasons.push("Mindestens eine Kalkulationsposition ist erforderlich.");
  if (result.hasEstimatedPrices) {
    const names = result.items.filter((r) => r.ingredient?.price_status === "estimated").map((r) => r.ingredient!.name);
    reasons.push(`Geschätzte Einkaufspreise: ${uniq(names).join(", ")}. Preise unter «Zutaten & EK» bestätigen.`);
  }
  if (result.hasUnconfirmedQuantities) {
    const n = result.items.filter((r) => !r.item.quantity_confirmed).length;
    reasons.push(`${n} ${n === 1 ? "Menge ist" : "Mengen sind"} noch nicht bestätigt.`);
  }
  if (!result.complete && result.items.length > 0) reasons.push("Die Kalkulation ist unvollständig.");
  return reasons;
}

/** Status automatically suggested from the current data. */
export function suggestedStatus(result: VariantResult): CalculationStatus {
  if (result.items.length === 0) return "estimated";
  if (reviewBlockers(result).length === 0) return "reviewed";
  const confirmedQty = result.items.filter((r) => r.item.quantity_confirmed).length;
  const confirmedPrice = result.items.filter((r) => r.ingredient?.price_status === "confirmed").length;
  if (confirmedQty > 0 || confirmedPrice > 0) return "partially_reviewed";
  return "estimated";
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

export type ComparisonMetric = {
  key: string;
  label: string;
  kind: "chf" | "percent";
  values: (number | null)[];
  /** Difference of each variant versus the first (CHF or percentage points). */
  deltas: (number | null)[];
};

const METRICS: { key: keyof VariantResult; label: string; kind: "chf" | "percent" }[] = [
  { key: "grossPrice", label: "Brutto-VK", kind: "chf" },
  { key: "netPrice", label: "Netto-VK", kind: "chf" },
  { key: "ingredientCost", label: "Warenkosten (Zutaten)", kind: "chf" },
  { key: "smallMaterialCost", label: "Kleinmaterial", kind: "chf" },
  { key: "foodCost", label: "Wareneinsatz", kind: "chf" },
  { key: "foodCostRatio", label: "Wareneinsatzquote", kind: "percent" },
  { key: "contributionMargin1", label: "DB I", kind: "chf" },
  { key: "contributionMarginRatio", label: "DB-I-Marge", kind: "percent" },
];

export function compareVariants(results: VariantResult[]): ComparisonMetric[] {
  return METRICS.map((m) => {
    const values = results.map((r) => r[m.key] as number | null);
    const base = values[0] ?? null;
    const deltas = values.map((v, i) => (i === 0 || v === null || base === null ? null : v - base));
    return { key: m.key, label: m.label, kind: m.kind, values, deltas };
  });
}

export type QuantityComparisonKind = "shared_equal" | "shared_different" | "only_first" | "only_second" | "mixed";

export type QuantityComparisonRow = {
  ingredientId: string;
  ingredientName: string;
  unit: BaseUnit;
  /** Net quantity per variant (null when the variant does not use the ingredient). */
  quantities: (number | null)[];
  costs: (number | null)[];
  /** Classification (meaningful for two-way comparisons). */
  kind: QuantityComparisonKind;
};

function classifyRow(quantities: (number | null)[]): QuantityComparisonKind {
  if (quantities.length !== 2) return "mixed";
  const a = quantities[0] ?? null;
  const b = quantities[1] ?? null;
  if (a !== null && b === null) return "only_first";
  if (a === null && b !== null) return "only_second";
  if (a !== null && b !== null) return Math.abs(a - b) < 1e-9 ? "shared_equal" : "shared_different";
  return "mixed";
}

export function compareQuantities(results: VariantResult[]): QuantityComparisonRow[] {
  const rows = new Map<string, QuantityComparisonRow>();
  results.forEach((res, idx) => {
    for (const r of res.items) {
      if (!r.ingredient) continue;
      let row = rows.get(r.ingredient.id);
      if (!row) {
        row = {
          ingredientId: r.ingredient.id,
          ingredientName: r.ingredient.name,
          unit: r.ingredient.base_unit,
          quantities: results.map(() => null),
          costs: results.map(() => null),
          kind: "mixed",
        };
        rows.set(r.ingredient.id, row);
      }
      row.quantities[idx] = (row.quantities[idx] ?? 0) + Number(r.item.net_quantity);
      row.costs[idx] = (row.costs[idx] ?? 0) + (r.cost ?? 0);
    }
  });
  return Array.from(rows.values())
    .map((row) => ({ ...row, kind: classifyRow(row.quantities) }))
    .sort((a, b) => a.ingredientName.localeCompare(b.ingredientName, "de-CH"));
}

// ---------------------------------------------------------------------------
// Combined order (dish variant + add-ons) – informational only
// ---------------------------------------------------------------------------

export type CombinedResult = {
  parts: VariantResult[];
  grossPrice: number | null;
  netPrice: number | null;
  foodCost: number | null;
  contributionMargin1: number | null;
  contributionMarginRatio: number | null;
  foodCostRatio: number | null;
  complete: boolean;
  problems: string[];
};

/** Sums the results of one variant and any number of add-ons. Nothing is persisted. */
export function combineResults(parts: VariantResult[]): CombinedResult {
  const problems = parts.flatMap((p) => p.problems.map((m) => `${p.variant.name}: ${m}`));
  const sum = (key: "grossPrice" | "netPrice" | "foodCost") =>
    parts.some((p) => p[key] === null) ? null : parts.reduce((s, p) => s + (p[key] ?? 0), 0);
  const grossPrice = parts.length ? sum("grossPrice") : null;
  const netPrice = parts.length ? sum("netPrice") : null;
  const foodCost = parts.length ? sum("foodCost") : null;
  const contributionMargin1 = netPrice !== null && foodCost !== null ? netPrice - foodCost : null;
  const ratioOk = netPrice !== null && netPrice > 0;
  return {
    parts,
    grossPrice,
    netPrice,
    foodCost,
    contributionMargin1,
    contributionMarginRatio: ratioOk && contributionMargin1 !== null ? (contributionMargin1 / netPrice) * 100 : null,
    foodCostRatio: ratioOk && foodCost !== null ? (foodCost / netPrice) * 100 : null,
    complete: problems.length === 0 && contributionMargin1 !== null,
    problems,
  };
}
