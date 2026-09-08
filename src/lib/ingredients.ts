import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Ingredient = Database["public"]["Tables"]["ingredients"]["Row"];
export type IngredientInsert = Database["public"]["Tables"]["ingredients"]["Insert"];
export type IngredientUpdate = Database["public"]["Tables"]["ingredients"]["Update"];

export async function fetchIngredients(): Promise<Ingredient[]> {
  const { data, error } = await supabase.from("ingredients").select("*").order("name");
  if (error) throw error;
  return data ?? [];
}

export const ingredientsQuery = queryOptions({
  queryKey: ["ingredients"],
  queryFn: fetchIngredients,
});

/** Number of calculation items per ingredient – used to block deletion. */
export async function fetchIngredientUsage(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from("calculation_items").select("ingredient_id");
  if (error) throw error;
  const usage: Record<string, number> = {};
  for (const row of data ?? []) usage[row.ingredient_id] = (usage[row.ingredient_id] ?? 0) + 1;
  return usage;
}

export const ingredientUsageQuery = queryOptions({
  queryKey: ["ingredients", "usage"],
  queryFn: fetchIngredientUsage,
});

export async function createIngredient(values: IngredientInsert) {
  const { data, error } = await supabase.from("ingredients").insert(values).select("id").single();
  if (error) throw error;
  return data;
}

export async function updateIngredient(id: string, patch: IngredientUpdate) {
  const { error } = await supabase.from("ingredients").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteIngredient(id: string) {
  const { error } = await supabase.from("ingredients").delete().eq("id", id);
  if (error) throw error;
}

/** Normalised name for duplicate detection. */
export function normaliseName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}
