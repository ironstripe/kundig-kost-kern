/**
 * Reusable multi-course menus ("Menü").
 *
 * A menu exists independently from an event. Menu positions reference
 * existing dish variants – recipes and calculation items are never copied.
 */
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
export type Menu = Tables["menus"]["Row"];
export type MenuInsert = Tables["menus"]["Insert"];
export type MenuUpdate = Tables["menus"]["Update"];
export type MenuVariant = Tables["menu_variants"]["Row"];
export type MenuVariantInsert = Tables["menu_variants"]["Insert"];
export type MenuVariantUpdate = Tables["menu_variants"]["Update"];
export type MenuPosition = Tables["menu_positions"]["Row"];
export type MenuPositionInsert = Tables["menu_positions"]["Insert"];
export type MenuPositionUpdate = Tables["menu_positions"]["Update"];

// ---------------------------------------------------------------------------
// Menus
// ---------------------------------------------------------------------------

export async function fetchMenus(): Promise<Menu[]> {
  const { data, error } = await supabase.from("menus").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export const menusQuery = queryOptions({ queryKey: ["menus"], queryFn: fetchMenus });

export async function fetchMenu(id: string): Promise<Menu | null> {
  const { data, error } = await supabase.from("menus").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export const menuQuery = (id: string) => queryOptions({ queryKey: ["menus", id], queryFn: () => fetchMenu(id) });

export async function createMenu(values: MenuInsert, userId: string) {
  const { data, error } = await supabase
    .from("menus")
    .insert({ ...values, created_by: userId, updated_by: userId })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateMenu(id: string, patch: MenuUpdate, userId: string) {
  const { error } = await supabase.from("menus").update({ ...patch, updated_by: userId }).eq("id", id);
  if (error) throw error;
}

export async function deleteMenu(id: string) {
  const { error } = await supabase.from("menus").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Menu variants (loaded for all menus at once – no request per menu)
// ---------------------------------------------------------------------------

export async function fetchMenuVariants(): Promise<MenuVariant[]> {
  const { data, error } = await supabase.from("menu_variants").select("*").order("sort_order").order("name");
  if (error) throw error;
  return data ?? [];
}

export const menuVariantsQuery = queryOptions({ queryKey: ["menu_variants"], queryFn: fetchMenuVariants });

export async function fetchMenuPositions(): Promise<MenuPosition[]> {
  const { data, error } = await supabase.from("menu_positions").select("*").order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export const menuPositionsQuery = queryOptions({ queryKey: ["menu_positions"], queryFn: fetchMenuPositions });

export async function createMenuVariant(values: MenuVariantInsert) {
  const { data, error } = await supabase.from("menu_variants").insert(values).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateMenuVariant(id: string, patch: MenuVariantUpdate) {
  const { error } = await supabase.from("menu_variants").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteMenuVariant(id: string) {
  const { error } = await supabase.from("menu_variants").delete().eq("id", id);
  if (error) throw error;
}

export async function createMenuPosition(values: MenuPositionInsert) {
  const { data, error } = await supabase.from("menu_positions").insert(values).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateMenuPosition(id: string, patch: MenuPositionUpdate) {
  const { error } = await supabase.from("menu_positions").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteMenuPosition(id: string) {
  const { error } = await supabase.from("menu_positions").delete().eq("id", id);
  if (error) throw error;
}

/** Duplicates a menu variant including its positions (recipes are referenced, not copied). */
export async function duplicateMenuVariant(variant: MenuVariant, positions: MenuPosition[]) {
  const created = await createMenuVariant({
    menu_id: variant.menu_id,
    name: `${variant.name} (Kopie)`,
    is_default: false,
    expected_guests: variant.expected_guests,
    notes: variant.notes,
    sort_order: variant.sort_order + 1,
  });
  const own = positions.filter((p) => p.menu_variant_id === variant.id);
  if (own.length > 0) {
    const { error } = await supabase.from("menu_positions").insert(
      own.map((p) => ({
        menu_variant_id: created.id,
        course: p.course,
        variant_id: p.variant_id,
        quantity_per_guest: p.quantity_per_guest,
        sort_order: p.sort_order,
        notes: p.notes,
      })),
    );
    if (error) throw error;
  }
  return created;
}
