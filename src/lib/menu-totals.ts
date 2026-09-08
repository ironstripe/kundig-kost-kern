/**
 * Total-menu calculation. Derives every figure from current source data via
 * the shared costing engine (`calculateVariant`) – nothing is persisted.
 *
 * Overall ratios are always computed from monetary totals, never by
 * averaging individual percentages.
 */
import { calculateVariant, type CalculationStatus, type VariantResult } from "@/lib/costing";
import { openDaysCount, addOnSalesWarning } from "@/lib/sales";
import { derivedSales, type SalesInputMode } from "@/lib/sales-planning";
import type { MenuCardData } from "@/lib/menu-cards";

export type LineKind = "variant" | "add_on";

export type MenuLine = {
  key: string;
  kind: LineKind;
  id: string;
  name: string;
  dishId: string | null;
  dishName: string;
  categoryId: string | null;
  categoryName: string;
  status: CalculationStatus;
  result: VariantResult;
  salesMode: SalesInputMode;
  perDay: number | null;
  total: number | null;
  grossRevenue: number | null;
  netRevenue: number | null;
  foodCost: number | null;
  contributionMargin1: number | null;
  /** Share of the overall DB I (0–100). */
  share: number | null;
  included: boolean;
  exclusionReasons: string[];
  /** Non-blocking add-on plausibility warning. */
  salesWarning: string | null;
  isActive: boolean;
};

export type OverallTotals = {
  grossRevenue: number;
  netRevenue: number;
  foodCost: number;
  contributionMargin1: number;
  foodCostRatio: number | null;
  contributionMarginRatio: number | null;
  expectedSales: number;
};

export type CategorySummary = {
  categoryId: string | null;
  categoryName: string;
  lines: number;
  expectedSales: number;
  netRevenue: number;
  foodCost: number;
  contributionMargin1: number;
  share: number | null;
  foodCostRatio: number | null;
  contributionMarginRatio: number | null;
};

export type DataQuality = {
  confirmedPrices: number;
  estimatedPrices: number;
  confirmedQuantities: number;
  estimatedQuantities: number;
  completeCalculations: number;
  incompleteCalculations: number;
};

export type MenuTotals = {
  sellingDays: number;
  lines: MenuLine[];
  includedLines: MenuLine[];
  excludedLines: MenuLine[];
  overall: OverallTotals | null;
  categories: CategorySummary[];
  quality: DataQuality;
  counts: {
    dishes: number;
    variants: number;
    addOns: number;
    estimated: number;
    partiallyReviewed: number;
    reviewed: number;
    incomplete: number;
  };
  /** Every active line is included in the totals. */
  complete: boolean;
  /** At least one included line is based on estimates or unconfirmed data. */
  hasAssumptions: boolean;
  hasSalesQuantities: boolean;
};

const UNCATEGORISED = "Ohne Kategorie";

export function calculateMenuTotals(data: MenuCardData): MenuTotals {
  const { card, excludedDays, categories, dishes, variants, addOns, links, items, ingredients } = data;
  const sellingDays = openDaysCount(card, excludedDays.map((d) => d.excluded_date));
  const ingById = new Map(ingredients.map((i) => [i.id, i]));
  const catById = new Map(categories.map((c) => [c.id, c]));
  const dishById = new Map(dishes.map((d) => [d.id, d]));

  const lines: MenuLine[] = [];

  // Variants (only of active dishes; inactive variants are listed but excluded)
  for (const v of variants) {
    const dish = dishById.get(v.dish_id);
    if (!dish) continue;
    const cat = dish.category_id ? catById.get(dish.category_id) : undefined;
    const result = calculateVariant(v, items.filter((it) => it.variant_id === v.id), ingById, card);
    lines.push(
      buildLine({
        key: `v:${v.id}`,
        kind: "variant",
        id: v.id,
        name: v.name,
        dishId: dish.id,
        dishName: dish.name,
        categoryId: cat?.id ?? null,
        categoryName: cat?.name ?? UNCATEGORISED,
        status: v.calculation_status,
        result,
        sales: v,
        sellingDays,
        isActive: v.is_active && dish.is_active,
        salesWarning: null,
      }),
    );
  }

  // Add-ons
  const activeVariantsByDish = new Map<string, typeof variants>();
  for (const v of variants) {
    const dish = dishById.get(v.dish_id);
    if (!dish || !dish.is_active || !v.is_active) continue;
    activeVariantsByDish.set(v.dish_id, [...(activeVariantsByDish.get(v.dish_id) ?? []), v]);
  }
  for (const a of addOns) {
    const result = calculateVariant(a, items.filter((it) => it.add_on_id === a.id), ingById, card);
    const assignedDishes = links.filter((l) => l.add_on_id === a.id).map((l) => dishById.get(l.dish_id)).filter(Boolean);
    const assignedVariants = assignedDishes.flatMap((d) => activeVariantsByDish.get(d!.id) ?? []);
    lines.push(
      buildLine({
        key: `a:${a.id}`,
        kind: "add_on",
        id: a.id,
        name: a.name,
        dishId: null,
        dishName: assignedDishes.length ? assignedDishes.map((d) => d!.name).join(", ") : "–",
        categoryId: null,
        categoryName: "Add-ons",
        status: a.calculation_status,
        result,
        sales: a,
        sellingDays,
        isActive: a.is_active,
        salesWarning: a.is_active ? addOnSalesWarning(a, assignedVariants, sellingDays) : null,
      }),
    );
  }

  const activeLines = lines.filter((l) => l.isActive);
  const includedLines = activeLines.filter((l) => l.included);
  const excludedLines = activeLines.filter((l) => !l.included);

  let overall: OverallTotals | null = null;
  if (includedLines.length > 0) {
    const sum = (k: "grossRevenue" | "netRevenue" | "foodCost" | "contributionMargin1" | "total") =>
      includedLines.reduce((s, l) => s + (l[k] ?? 0), 0);
    const net = sum("netRevenue");
    overall = {
      grossRevenue: sum("grossRevenue"),
      netRevenue: net,
      foodCost: sum("foodCost"),
      contributionMargin1: sum("contributionMargin1"),
      foodCostRatio: net > 0 ? (sum("foodCost") / net) * 100 : null,
      contributionMarginRatio: net > 0 ? (sum("contributionMargin1") / net) * 100 : null,
      expectedSales: sum("total"),
    };
    const cm = overall.contributionMargin1;
    for (const l of includedLines) {
      l.share = cm > 0 && l.contributionMargin1 !== null ? (l.contributionMargin1 / cm) * 100 : null;
    }
  }

  // Category summary (weighted by monetary totals)
  const catMap = new Map<string, CategorySummary>();
  for (const l of includedLines) {
    const key = l.kind === "add_on" ? "add_ons" : (l.categoryId ?? "none");
    let c = catMap.get(key);
    if (!c) {
      c = {
        categoryId: l.categoryId,
        categoryName: l.categoryName,
        lines: 0,
        expectedSales: 0,
        netRevenue: 0,
        foodCost: 0,
        contributionMargin1: 0,
        share: null,
        foodCostRatio: null,
        contributionMarginRatio: null,
      };
      catMap.set(key, c);
    }
    c.lines++;
    c.expectedSales += l.total ?? 0;
    c.netRevenue += l.netRevenue ?? 0;
    c.foodCost += l.foodCost ?? 0;
    c.contributionMargin1 += l.contributionMargin1 ?? 0;
  }
  const categorySummaries = Array.from(catMap.values()).map((c) => ({
    ...c,
    share: overall && overall.contributionMargin1 > 0 ? (c.contributionMargin1 / overall.contributionMargin1) * 100 : null,
    foodCostRatio: c.netRevenue > 0 ? (c.foodCost / c.netRevenue) * 100 : null,
    contributionMarginRatio: c.netRevenue > 0 ? (c.contributionMargin1 / c.netRevenue) * 100 : null,
  }));
  categorySummaries.sort((a, b) => b.contributionMargin1 - a.contributionMargin1);

  // Data quality across active lines
  const usedIngredientIds = new Set<string>();
  let confirmedQuantities = 0;
  let estimatedQuantities = 0;
  for (const l of activeLines) {
    for (const r of l.result.items) {
      usedIngredientIds.add(r.item.ingredient_id);
      if (r.item.quantity_confirmed) confirmedQuantities++;
      else estimatedQuantities++;
    }
  }
  let confirmedPrices = 0;
  let estimatedPrices = 0;
  for (const id of usedIngredientIds) {
    const ing = ingById.get(id);
    if (!ing) continue;
    if (ing.price_status === "confirmed") confirmedPrices++;
    else estimatedPrices++;
  }
  const completeCalculations = activeLines.filter((l) => l.result.complete).length;
  const incompleteCalculations = activeLines.length - completeCalculations;

  const activeDishes = dishes.filter((d) => d.is_active);
  const counts = {
    dishes: activeDishes.length,
    variants: activeLines.filter((l) => l.kind === "variant").length,
    addOns: activeLines.filter((l) => l.kind === "add_on").length,
    estimated: activeLines.filter((l) => l.status === "estimated").length,
    partiallyReviewed: activeLines.filter((l) => l.status === "partially_reviewed").length,
    reviewed: activeLines.filter((l) => l.status === "reviewed").length,
    incomplete: incompleteCalculations,
  };

  const hasAssumptions = includedLines.some(
    (l) => l.status !== "reviewed" || l.result.hasEstimatedPrices || l.result.hasUnconfirmedQuantities,
  );

  return {
    sellingDays,
    lines,
    includedLines,
    excludedLines,
    overall,
    categories: categorySummaries,
    quality: { confirmedPrices, estimatedPrices, confirmedQuantities, estimatedQuantities, completeCalculations, incompleteCalculations },
    counts,
    complete: excludedLines.length === 0,
    hasAssumptions,
    hasSalesQuantities: activeLines.some((l) => (l.total ?? 0) > 0),
  };
}

function buildLine(input: {
  key: string;
  kind: LineKind;
  id: string;
  name: string;
  dishId: string | null;
  dishName: string;
  categoryId: string | null;
  categoryName: string;
  status: CalculationStatus;
  result: VariantResult;
  sales: { sales_input_mode: SalesInputMode; expected_per_open_day: number | string; expected_total: number | string | null };
  sellingDays: number;
  isActive: boolean;
  salesWarning: string | null;
}): MenuLine {
  const { result, sales, sellingDays } = input;
  const { perDay, total } = derivedSales(sales, sellingDays);
  const reasons: string[] = [];
  if (sellingDays <= 0) reasons.push("Keine Verkaufstage in der Laufzeit");
  if (total === null && sellingDays > 0) reasons.push("Verkaufsmenge fehlt");
  if (!result.complete) reasons.push(...(result.problems.length ? result.problems : ["Kalkulation unvollständig"]));

  const included = reasons.length === 0 && total !== null;
  const mul = (v: number | null) => (included && v !== null && total !== null ? v * total : null);

  return {
    key: input.key,
    kind: input.kind,
    id: input.id,
    name: input.name,
    dishId: input.dishId,
    dishName: input.dishName,
    categoryId: input.categoryId,
    categoryName: input.categoryName,
    status: input.status,
    result,
    salesMode: sales.sales_input_mode,
    perDay,
    total,
    grossRevenue: mul(result.grossPrice),
    netRevenue: mul(result.netPrice),
    foodCost: mul(result.foodCost),
    contributionMargin1: mul(result.contributionMargin1),
    share: null,
    included,
    exclusionReasons: reasons,
    salesWarning: input.salesWarning,
    isActive: input.isActive,
  };
}
