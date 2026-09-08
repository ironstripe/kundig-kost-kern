import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ImportJob } from "@/lib/import-schema";

export async function fetchImportJobs(menuCardId: string): Promise<ImportJob[]> {
  const { data, error } = await supabase
    .from("import_jobs")
    .select("*")
    .eq("menu_card_id", menuCardId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export const importJobsQuery = (menuCardId: string) =>
  queryOptions({ queryKey: ["import_jobs", menuCardId], queryFn: () => fetchImportJobs(menuCardId) });

export async function fetchIngredientImportJobs(): Promise<ImportJob[]> {
  const { data, error } = await supabase
    .from("import_jobs")
    .select("*")
    .eq("import_type", "ingredient_excel")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export const ingredientImportJobsQuery = queryOptions({ queryKey: ["import_jobs", "ingredient_excel"], queryFn: fetchIngredientImportJobs });

export async function fetchImportJob(jobId: string): Promise<ImportJob | null> {
  const { data, error } = await supabase.from("import_jobs").select("*").eq("id", jobId).maybeSingle();
  if (error) throw error;
  return data;
}

export const importJobQuery = (jobId: string) =>
  queryOptions({ queryKey: ["import_jobs", "one", jobId], queryFn: () => fetchImportJob(jobId) });

/** Query keys to refresh after a confirmed import touches operational data. */
export const IMPORT_RESULT_KEYS = [
  ["import_jobs"],
  ["menu_card_data"],
  ["menu_cards"],
  ["menu_card_counts"],
  ["dishes"],
  ["variants"],
  ["add_ons"],
  ["ingredients"],
  ["categories"],
  ["calculation_items"],
  ["add_on_links"],
] as const;
