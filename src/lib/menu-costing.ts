/**
 * Menu costing. Builds on the existing dish-variant engine in
 * `src/lib/costing.ts` – no alternative formulas, no duplicated recipes.
 *
 * All values are derived from current source data. Missing values stay
 * `null`; they are never treated as zero and never produce NaN/Infinity.
 */
import {
  calculateVariant,
  VAT_RATE_DEFAULT,
  type ItemLike,
  type IngredientLike,
  type MenuCardLike,
  type VariantLike,
  type VariantResult,
} from "@/lib/costing";
import type { Menu, MenuPosition, MenuVariant } from "@/lib/menus";

export type DishLike = { id: string; name: string; menu_card_id: string; is_active?: boolean };

export type MenuCostingContext = {
  /** All dish variants by id. */
  variantsById: Map<string, VariantLike & { dish_id: string; is_active: boolean }>;
  dishesById: Map<string, DishLike>;
  /** Calculation items grouped by dish-variant id. */
  itemsByVariant: Map<string, ItemLike[]>;
  ingredientsById: Map<string, IngredientLike>;
  /** Menu cards by id – needed for the small-material rule of each dish. */
  cardsById: Map<string, MenuCardLike>;
};

export type MenuPositionResult = {
  position: MenuPosition;
  dishName: string | null;
  variantName: string | null;
  /** Dish-variant result (per portion). */
  dish: VariantResult | null;
  quantityPerGuest: number;
  /** Food cost per guest for this position. */
  foodCostPerGuest: number | null;
  problem: string | null;
  /**
   * Informational only: the source dish or variant is inactive for à-la-carte
   * use. The position stays fully costed and part of this menu.
   */
  aLaCarteInactive: boolean;
};

export type MenuVariantResult = {
  menuVariant: MenuVariant;
  positions: MenuPositionResult[];
  grossPrice: number | null;
  netPrice: number | null;
  foodCost: number | null;
  foodCostRatio: number | null;
  contributionMargin1: number | null;
  contributionMarginRatio: number | null;
  problems: string[];
  /** Problems of the food-cost calculation only (price independent). */
  costProblems: string[];
  /** The menu selling price is not set yet – food cost is still valid. */
  priceMissing: boolean;
  /** Food cost per person is fully calculable. */
  costComplete: boolean;
  /** Dishes that block a complete calculation. */
  blockingDishes: string[];
  complete: boolean;
  hasEstimatedPrices: boolean;
  hasUnconfirmedQuantities: boolean;
};

function buildItems(ctx: MenuCostingContext, variantId: string): ItemLike[] {
  return ctx.itemsByVariant.get(variantId) ?? [];
}

export function calculateMenuPosition(
  position: MenuPosition,
  ctx: MenuCostingContext,
): MenuPositionResult {
  const qty = Number(position.quantity_per_guest);
  const base: MenuPositionResult = {
    position,
    dishName: null,
    variantName: null,
    dish: null,
    quantityPerGuest: Number.isFinite(qty) && qty > 0 ? qty : 1,
    foodCostPerGuest: null,
    problem: null,
    aLaCarteInactive: false,
  };
  const variant = ctx.variantsById.get(position.variant_id);
  if (!variant) return { ...base, problem: "Gericht-Variante nicht gefunden" };
  const dish = ctx.dishesById.get(variant.dish_id) ?? null;
  const card = dish ? (ctx.cardsById.get(dish.menu_card_id) ?? null) : null;
  // Explicitly assigned positions stay fully costed even when inactive à la carte.
  const result = calculateVariant(variant, buildItems(ctx, variant.id), ctx.ingredientsById, card);
  const foodCost = result.foodCost;
  return {
    ...base,
    dishName: dish?.name ?? null,
    variantName: variant.name,
    dish: result,
    foodCostPerGuest: foodCost === null ? null : foodCost * base.quantityPerGuest,
    problem: foodCost === null ? "Gerichtskalkulation unvollständig" : null,
    aLaCarteInactive: dish?.is_active === false || variant.is_active === false,
  };
}

export function calculateMenuVariant(
  menu: Menu,
  menuVariant: MenuVariant,
  positions: MenuPosition[],
  ctx: MenuCostingContext,
): MenuVariantResult {
  const own = positions
    .filter((p) => p.menu_variant_id === menuVariant.id)
    .sort((a, b) => a.sort_order - b.sort_order);
  const results = own.map((p) => calculateMenuPosition(p, ctx));
  const problems: string[] = [];
  const blockingDishes: string[] = [];

  if (results.length === 0) problems.push("Keine Menü-Positionen erfasst");

  for (const r of results) {
    if (r.foodCostPerGuest === null) {
      const label = r.dishName ? `${r.dishName}${r.variantName ? ` – ${r.variantName}` : ""}` : "Position";
      blockingDishes.push(label);
      problems.push(`${label}: ${r.problem ?? "unvollständig"}`);
    }
  }

  const vat = Number(menu.vat_rate);
  const gross = menu.gross_price_per_person === null ? NaN : Number(menu.gross_price_per_person);
  let grossPrice: number | null = null;
  let netPrice: number | null = null;
  if (!Number.isFinite(gross) || gross <= 0) {
    problems.push("Brutto-Menüpreis pro Person fehlt");
  } else {
    grossPrice = gross;
    netPrice = gross / (1 + (Number.isFinite(vat) ? vat : VAT_RATE_DEFAULT));
  }

  const foodCost =
    results.length > 0 && blockingDishes.length === 0
      ? results.reduce((s, r) => s + (r.foodCostPerGuest ?? 0), 0)
      : null;

  const ratioOk = netPrice !== null && netPrice > 0;
  const foodCostRatio = foodCost !== null && ratioOk ? (foodCost / netPrice!) * 100 : null;
  const contributionMargin1 = foodCost !== null && netPrice !== null ? netPrice - foodCost : null;
  const contributionMarginRatio =
    contributionMargin1 !== null && ratioOk ? (contributionMargin1 / netPrice!) * 100 : null;

  return {
    menuVariant,
    positions: results,
    grossPrice,
    netPrice,
    foodCost,
    foodCostRatio,
    contributionMargin1,
    contributionMarginRatio,
    problems,
    blockingDishes,
    complete: problems.length === 0 && contributionMarginRatio !== null,
    hasEstimatedPrices: results.some((r) => r.dish?.hasEstimatedPrices ?? false),
    hasUnconfirmedQuantities: results.some((r) => r.dish?.hasUnconfirmedQuantities ?? false),
  };
}

export function calculateMenu(
  menu: Menu,
  menuVariants: MenuVariant[],
  positions: MenuPosition[],
  ctx: MenuCostingContext,
): MenuVariantResult[] {
  return menuVariants
    .filter((v) => v.menu_id === menu.id)
    .sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0) || a.sort_order - b.sort_order)
    .map((v) => calculateMenuVariant(menu, v, positions, ctx));
}

/** Food cost per guest of the default (or first) variant – used in lists. */
export function primaryMenuResult(results: MenuVariantResult[]): MenuVariantResult | null {
  return results.find((r) => r.menuVariant.is_default) ?? results[0] ?? null;
}

/** Read-only snapshot stored on an event when a menu is linked. */
export type MenuSnapshot = {
  menu: { id: string; name: string; status: string; gross_price_per_person: number | null; vat_rate: number };
  variants: {
    id: string;
    name: string;
    is_default: boolean;
    expected_guests: number | null;
    grossPrice: number | null;
    netPrice: number | null;
    foodCost: number | null;
    contributionMargin1: number | null;
    complete: boolean;
    problems: string[];
    positions: {
      course: string;
      dishName: string | null;
      variantName: string | null;
      quantityPerGuest: number;
      foodCostPerGuest: number | null;
    }[];
  }[];
};

export function buildMenuSnapshot(menu: Menu, results: MenuVariantResult[]): MenuSnapshot {
  return {
    menu: {
      id: menu.id,
      name: menu.name,
      status: menu.status,
      gross_price_per_person: menu.gross_price_per_person === null ? null : Number(menu.gross_price_per_person),
      vat_rate: Number(menu.vat_rate),
    },
    variants: results.map((r) => ({
      id: r.menuVariant.id,
      name: r.menuVariant.name,
      is_default: r.menuVariant.is_default,
      expected_guests: r.menuVariant.expected_guests,
      grossPrice: r.grossPrice,
      netPrice: r.netPrice,
      foodCost: r.foodCost,
      contributionMargin1: r.contributionMargin1,
      complete: r.complete,
      problems: r.problems,
      positions: r.positions.map((p) => ({
        course: p.position.course,
        dishName: p.dishName,
        variantName: p.variantName,
        quantityPerGuest: p.quantityPerGuest,
        foodCostPerGuest: p.foodCostPerGuest,
      })),
    })),
  };
}
