import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type MenuCard = Database["public"]["Tables"]["menu_cards"]["Row"];
export type MenuCardUpdate = Database["public"]["Tables"]["menu_cards"]["Update"];

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

export async function updateMenuCard(id: string, patch: MenuCardUpdate, userId: string) {
  const { error } = await supabase
    .from("menu_cards")
    .update({ ...patch, updated_by: userId })
    .eq("id", id);
  if (error) throw error;
}
