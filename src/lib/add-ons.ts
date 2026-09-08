import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
export type AddOn = Tables["add_ons"]["Row"];
export type AddOnInsert = Tables["add_ons"]["Insert"];
export type AddOnUpdate = Tables["add_ons"]["Update"];
export type AddOnLink = Tables["add_on_links"]["Row"];

// ---------------------------------------------------------------------------
// Add-ons
// ---------------------------------------------------------------------------

export async function fetchAddOns(): Promise<AddOn[]> {
  const { data, error } = await supabase.from("add_ons").select("*").order("name");
  if (error) throw error;
  return data ?? [];
}

export const addOnsQuery = queryOptions({ queryKey: ["add_ons"], queryFn: fetchAddOns });

export async function fetchAddOn(id: string): Promise<AddOn | null> {
  const { data, error } = await supabase.from("add_ons").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export const addOnQuery = (id: string) => queryOptions({ queryKey: ["add_ons", id], queryFn: () => fetchAddOn(id) });

export async function createAddOn(values: AddOnInsert) {
  const { data, error } = await supabase.from("add_ons").insert(values).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateAddOn(id: string, patch: AddOnUpdate) {
  const { error } = await supabase.from("add_ons").update(patch).eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Dish ↔ add-on assignments
// ---------------------------------------------------------------------------

export async function fetchAddOnLinks(): Promise<AddOnLink[]> {
  const { data, error } = await supabase.from("add_on_links").select("*");
  if (error) throw error;
  return data ?? [];
}

export const addOnLinksQuery = queryOptions({ queryKey: ["add_on_links"], queryFn: fetchAddOnLinks });

/** Assign an add-on to a dish. Duplicate assignments are ignored (unique constraint). */
export async function linkAddOn(dishId: string, addOnId: string) {
  const { error } = await supabase
    .from("add_on_links")
    .upsert({ dish_id: dishId, add_on_id: addOnId }, { onConflict: "dish_id,add_on_id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function unlinkAddOn(dishId: string, addOnId: string) {
  const { error } = await supabase.from("add_on_links").delete().eq("dish_id", dishId).eq("add_on_id", addOnId);
  if (error) throw error;
}

/** Replace the full set of dish assignments for one add-on. */
export async function setAddOnDishes(addOnId: string, dishIds: string[], current: AddOnLink[]) {
  const existing = new Set(current.filter((l) => l.add_on_id === addOnId).map((l) => l.dish_id));
  const wanted = new Set(dishIds);
  const toAdd = dishIds.filter((d) => !existing.has(d));
  const toRemove = Array.from(existing).filter((d) => !wanted.has(d));
  if (toAdd.length > 0) {
    const { error } = await supabase
      .from("add_on_links")
      .upsert(toAdd.map((dish_id) => ({ dish_id, add_on_id: addOnId })), { onConflict: "dish_id,add_on_id", ignoreDuplicates: true });
    if (error) throw error;
  }
  if (toRemove.length > 0) {
    const { error } = await supabase.from("add_on_links").delete().eq("add_on_id", addOnId).in("dish_id", toRemove);
    if (error) throw error;
  }
}
