/**
 * Loads everything the menu costing needs in a handful of requests
 * (no request per menu, variant or position).
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { allItemsQuery, allVariantsQuery, dishesQuery } from "@/lib/dishes";
import { ingredientsQuery } from "@/lib/ingredients";
import { menuCardsQuery } from "@/lib/menu-cards";
import type { MenuCostingContext } from "@/lib/menu-costing";
import type { ItemLike } from "@/lib/costing";

export function useMenuCostingContext() {
  const dishes = useQuery(dishesQuery);
  const variants = useQuery(allVariantsQuery);
  const items = useQuery(allItemsQuery);
  const ingredients = useQuery(ingredientsQuery);
  const cards = useQuery(menuCardsQuery);

  const ctx = useMemo<MenuCostingContext>(() => {
    const itemsByVariant = new Map<string, ItemLike[]>();
    for (const it of items.data ?? []) {
      if (!it.variant_id) continue;
      const list = itemsByVariant.get(it.variant_id) ?? [];
      list.push(it);
      itemsByVariant.set(it.variant_id, list);
    }
    return {
      variantsById: new Map((variants.data ?? []).map((v) => [v.id, v])),
      dishesById: new Map((dishes.data ?? []).map((d) => [d.id, d])),
      itemsByVariant,
      ingredientsById: new Map((ingredients.data ?? []).map((i) => [i.id, i])),
      cardsById: new Map((cards.data ?? []).map((c) => [c.id, c])),
    };
  }, [dishes.data, variants.data, items.data, ingredients.data, cards.data]);

  const isPending =
    dishes.isPending || variants.isPending || items.isPending || ingredients.isPending || cards.isPending;
  const error = dishes.error ?? variants.error ?? items.error ?? ingredients.error ?? cards.error ?? null;

  return { ctx, isPending, error, dishes: dishes.data ?? [], variants: variants.data ?? [] };
}
