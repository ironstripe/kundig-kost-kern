import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
export type MenuCard = Tables["menu_cards"]["Row"];
export type MenuCardInsert = Tables["menu_cards"]["Insert"];
export type MenuCardUpdate = Tables["menu_cards"]["Update"];
export type ExcludedDay = Tables["excluded_days"]["Row"];

export async function fetchMenuCards(): Promise<MenuCard[]> {
  const { data, error } = await supabase
    .from("menu_cards")
    .select("*")
    .order("valid_from", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchActiveMenuCard(): Promise<MenuCard | null> {
  const { data, error } = await supabase
    .from("menu_cards")
    .select("*")
    .eq("is_active", true)
    .order("valid_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export const menuCardsQuery = queryOptions({
  queryKey: ["menu_cards"],
  queryFn: fetchMenuCards,
});

export const activeMenuCardQuery = queryOptions({
  queryKey: ["menu_cards", "active"],
  queryFn: fetchActiveMenuCard,
});

export async function createMenuCard(values: MenuCardInsert, userId: string) {
  const { data, error } = await supabase
    .from("menu_cards")
    .insert({ ...values, created_by: userId, updated_by: userId })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateMenuCard(id: string, patch: MenuCardUpdate, userId: string) {
  const { error } = await supabase
    .from("menu_cards")
    .update({ ...patch, updated_by: userId })
    .eq("id", id);
  if (error) throw error;
}

/** Only allowed when the card has no dishes (checked in the UI and by the FK). */
export async function deleteMenuCard(id: string) {
  const { error } = await supabase.from("menu_cards").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Excluded days (Schliesstage)
// ---------------------------------------------------------------------------

export async function fetchExcludedDays(menuCardId: string): Promise<ExcludedDay[]> {
  const { data, error } = await supabase
    .from("excluded_days")
    .select("*")
    .eq("menu_card_id", menuCardId)
    .order("excluded_date");
  if (error) throw error;
  return data ?? [];
}

export const excludedDaysQuery = (menuCardId: string) =>
  queryOptions({ queryKey: ["excluded_days", menuCardId], queryFn: () => fetchExcludedDays(menuCardId) });

export async function addExcludedDay(menuCardId: string, date: string, reason: string | null) {
  const { error } = await supabase
    .from("excluded_days")
    .insert({ menu_card_id: menuCardId, excluded_date: date, reason });
  if (error) throw error;
}

export async function removeExcludedDay(id: string) {
  const { error } = await supabase.from("excluded_days").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Per-card counts for the menu-card list (one query per table, not per card)
// ---------------------------------------------------------------------------

export type MenuCardCounts = { dishes: number; variants: number; addOns: number; estimated: number; reviewed: number };

export async function fetchMenuCardCounts(): Promise<Record<string, MenuCardCounts>> {
  const [dishes, variants, addOns] = await Promise.all([
    supabase.from("dishes").select("id, menu_card_id").eq("is_active", true),
    supabase.from("variants").select("dish_id, calculation_status, is_active"),
    supabase.from("add_ons").select("menu_card_id, calculation_status, is_active"),
  ]);
  if (dishes.error) throw dishes.error;
  if (variants.error) throw variants.error;
  if (addOns.error) throw addOns.error;
  const out: Record<string, MenuCardCounts> = {};
  const get = (id: string) => (out[id] ??= { dishes: 0, variants: 0, addOns: 0, estimated: 0, reviewed: 0 });
  const dishCard = new Map<string, string>();
  for (const d of dishes.data ?? []) {
    dishCard.set(d.id, d.menu_card_id);
    get(d.menu_card_id).dishes++;
  }
  for (const v of variants.data ?? []) {
    const cardId = dishCard.get(v.dish_id);
    if (!cardId || !v.is_active) continue;
    const c = get(cardId);
    c.variants++;
    if (v.calculation_status === "reviewed") c.reviewed++;
    else c.estimated++;
  }
  for (const a of addOns.data ?? []) {
    if (!a.is_active) continue;
    const c = get(a.menu_card_id);
    c.addOns++;
    if (a.calculation_status === "reviewed") c.reviewed++;
    else c.estimated++;
  }
  return out;
}

export const menuCardCountsQuery = queryOptions({ queryKey: ["menu_card_counts"], queryFn: fetchMenuCardCounts });

// ---------------------------------------------------------------------------
// Complete data set of one menu card (a handful of set-based queries)
// ---------------------------------------------------------------------------

export type MenuCardData = {
  card: MenuCard;
  excludedDays: ExcludedDay[];
  categories: Tables["categories"]["Row"][];
  dishes: Tables["dishes"]["Row"][];
  variants: Tables["variants"]["Row"][];
  addOns: Tables["add_ons"]["Row"][];
  links: Tables["add_on_links"]["Row"][];
  items: Tables["calculation_items"]["Row"][];
  ingredients: Tables["ingredients"]["Row"][];
};

export async function fetchMenuCardData(cardId: string): Promise<MenuCardData> {
  const [cardRes, excluded, categories, dishes, addOns, ingredients] = await Promise.all([
    supabase.from("menu_cards").select("*").eq("id", cardId).single(),
    supabase.from("excluded_days").select("*").eq("menu_card_id", cardId).order("excluded_date"),
    supabase.from("categories").select("*").eq("menu_card_id", cardId).order("sort_order").order("name"),
    supabase.from("dishes").select("*").eq("menu_card_id", cardId).order("sort_order").order("name"),
    supabase.from("add_ons").select("*").eq("menu_card_id", cardId).order("name"),
    supabase.from("ingredients").select("*"),
  ]);
  for (const r of [cardRes, excluded, categories, dishes, addOns, ingredients]) if (r.error) throw r.error;

  const dishIds = (dishes.data ?? []).map((d) => d.id);
  const addOnIds = (addOns.data ?? []).map((a) => a.id);

  const [variants, links] = await Promise.all([
    dishIds.length
      ? supabase.from("variants").select("*").in("dish_id", dishIds).order("is_default", { ascending: false }).order("name")
      : Promise.resolve({ data: [] as Tables["variants"]["Row"][], error: null }),
    addOnIds.length
      ? supabase.from("add_on_links").select("*").in("add_on_id", addOnIds)
      : Promise.resolve({ data: [] as Tables["add_on_links"]["Row"][], error: null }),
  ]);
  if (variants.error) throw variants.error;
  if (links.error) throw links.error;

  const variantIds = (variants.data ?? []).map((v) => v.id);
  const [variantItems, addOnItems] = await Promise.all([
    variantIds.length
      ? supabase.from("calculation_items").select("*").in("variant_id", variantIds).order("sort_order")
      : Promise.resolve({ data: [] as Tables["calculation_items"]["Row"][], error: null }),
    addOnIds.length
      ? supabase.from("calculation_items").select("*").in("add_on_id", addOnIds).order("sort_order")
      : Promise.resolve({ data: [] as Tables["calculation_items"]["Row"][], error: null }),
  ]);
  if (variantItems.error) throw variantItems.error;
  if (addOnItems.error) throw addOnItems.error;

  return {
    card: cardRes.data!,
    excludedDays: excluded.data ?? [],
    categories: categories.data ?? [],
    dishes: dishes.data ?? [],
    variants: variants.data ?? [],
    addOns: addOns.data ?? [],
    links: links.data ?? [],
    items: [...(variantItems.data ?? []), ...(addOnItems.data ?? [])],
    ingredients: ingredients.data ?? [],
  };
}

export const menuCardDataQuery = (cardId: string) =>
  queryOptions({ queryKey: ["menu_card_data", cardId], queryFn: () => fetchMenuCardData(cardId) });

/** Query keys touched by anything that changes derived menu results. */
export const MENU_RESULT_KEYS = [
  ["menu_card_data"],
  ["menu_cards"],
  ["menu_card_counts"],
  ["variants"],
  ["add_ons"],
  ["excluded_days"],
] as const;
