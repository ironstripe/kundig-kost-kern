import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
export type Category = Tables["categories"]["Row"];
export type Dish = Tables["dishes"]["Row"];
export type DishInsert = Tables["dishes"]["Insert"];
export type DishUpdate = Tables["dishes"]["Update"];
export type Variant = Tables["variants"]["Row"];
export type VariantInsert = Tables["variants"]["Insert"];
export type VariantUpdate = Tables["variants"]["Update"];
export type CalculationItem = Tables["calculation_items"]["Row"];
export type CalculationItemInsert = Tables["calculation_items"]["Insert"];
export type CalculationItemUpdate = Tables["calculation_items"]["Update"];

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from("categories").select("*").order("sort_order").order("name");
  if (error) throw error;
  return data ?? [];
}

export const categoriesQuery = queryOptions({ queryKey: ["categories"], queryFn: fetchCategories });

export async function createCategory(menuCardId: string, name: string) {
  const { data, error } = await supabase
    .from("categories")
    .insert({ menu_card_id: menuCardId, name: name.trim(), sort_order: 100 })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Dishes
// ---------------------------------------------------------------------------

export async function fetchDishes(): Promise<Dish[]> {
  const { data, error } = await supabase.from("dishes").select("*").order("sort_order").order("name");
  if (error) throw error;
  return data ?? [];
}

export const dishesQuery = queryOptions({ queryKey: ["dishes"], queryFn: fetchDishes });

export async function fetchDish(id: string): Promise<Dish | null> {
  const { data, error } = await supabase.from("dishes").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export const dishQuery = (id: string) => queryOptions({ queryKey: ["dishes", id], queryFn: () => fetchDish(id) });

export async function createDish(values: DishInsert) {
  const { data, error } = await supabase.from("dishes").insert(values).select("id").single();
  if (error) throw error;
  return data;
}

export async function updateDish(id: string, patch: DishUpdate) {
  const { error } = await supabase.from("dishes").update(patch).eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

export async function fetchAllVariants(): Promise<Variant[]> {
  const { data, error } = await supabase.from("variants").select("*").order("is_default", { ascending: false }).order("name");
  if (error) throw error;
  return data ?? [];
}

export const allVariantsQuery = queryOptions({ queryKey: ["variants"], queryFn: fetchAllVariants });

export async function fetchVariantsForDish(dishId: string): Promise<Variant[]> {
  const { data, error } = await supabase
    .from("variants")
    .select("*")
    .eq("dish_id", dishId)
    .order("is_default", { ascending: false })
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

export const dishVariantsQuery = (dishId: string) =>
  queryOptions({ queryKey: ["variants", "dish", dishId], queryFn: () => fetchVariantsForDish(dishId) });

export async function createVariant(values: VariantInsert) {
  const { data, error } = await supabase.from("variants").insert(values).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateVariant(id: string, patch: VariantUpdate) {
  const { error } = await supabase.from("variants").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteVariant(id: string) {
  const { error } = await supabase.from("variants").delete().eq("id", id);
  if (error) throw error;
}

/** Only one default variant per dish. */
export async function setDefaultVariant(dishId: string, variantId: string) {
  const { error: e1 } = await supabase.from("variants").update({ is_default: false }).eq("dish_id", dishId);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from("variants").update({ is_default: true }).eq("id", variantId);
  if (e2) throw e2;
}

/**
 * Duplicate a variant including all calculation items. The copy is an
 * independent variant – quantities are not linked to the original.
 */
export async function duplicateVariant(
  source: Variant,
  items: CalculationItem[],
  overrides: { name: string; gross_price: number },
  userId: string,
) {
  const created = await createVariant({
    dish_id: source.dish_id,
    name: overrides.name,
    gross_price: overrides.gross_price,
    sales_input_mode: source.sales_input_mode,
    expected_per_open_day: source.expected_per_open_day,
    expected_total: source.expected_total,
    small_material_override_mode: source.small_material_override_mode,
    small_material_override_value: source.small_material_override_value,
    calculation_status: "estimated",
    is_default: false,
    is_active: true,
    notes: source.notes,
    updated_by: userId,
  });
  if (items.length > 0) {
    const { error } = await supabase.from("calculation_items").insert(
      items.map((it) => ({
        variant_id: created.id,
        ingredient_id: it.ingredient_id,
        component_group: it.component_group,
        net_quantity: it.net_quantity,
        quantity_unit: it.quantity_unit,
        yield_percent: it.yield_percent,
        sort_order: it.sort_order,
        quantity_source: it.quantity_source,
        quantity_confirmed: it.quantity_confirmed,
        notes: it.notes,
      })),
    );
    if (error) {
      await deleteVariant(created.id);
      throw error;
    }
  }
  return created;
}

// ---------------------------------------------------------------------------
// Calculation items
// ---------------------------------------------------------------------------

export async function fetchAllItems(): Promise<CalculationItem[]> {
  const { data, error } = await supabase.from("calculation_items").select("*").order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export const allItemsQuery = queryOptions({ queryKey: ["calculation_items"], queryFn: fetchAllItems });

export async function fetchItemsForVariants(variantIds: string[]): Promise<CalculationItem[]> {
  if (variantIds.length === 0) return [];
  const { data, error } = await supabase
    .from("calculation_items")
    .select("*")
    .in("variant_id", variantIds)
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export const dishItemsQuery = (dishId: string, variantIds: string[]) =>
  queryOptions({
    queryKey: ["calculation_items", "dish", dishId, [...variantIds].sort().join(",")],
    queryFn: () => fetchItemsForVariants(variantIds),
  });

export async function createItem(values: CalculationItemInsert) {
  const { error } = await supabase.from("calculation_items").insert(values);
  if (error) throw error;
}

export async function updateItem(id: string, patch: CalculationItemUpdate) {
  const { error } = await supabase.from("calculation_items").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteItem(id: string) {
  const { error } = await supabase.from("calculation_items").delete().eq("id", id);
  if (error) throw error;
}

export async function reorderItems(orders: { id: string; sort_order: number }[]) {
  for (const o of orders) {
    const { error } = await supabase.from("calculation_items").update({ sort_order: o.sort_order }).eq("id", o.id);
    if (error) throw error;
  }
}
