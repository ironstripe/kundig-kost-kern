/**
 * Excel ingredient import – server side. Called only after the user clicked
 * «Import verbindlich ausführen». Re-validates every row against the current
 * database state and writes through a transactional database procedure that
 * runs with the caller's own permissions (RLS applies).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import {
  IngredientImportPayloadSchema,
  crossRowConflicts,
  matchIngredient,
  validateValues,
} from "@/lib/ingredient-import-schema";

type Ctx = { supabase: any; userId: string };

export type IngredientImportResult = {
  jobId: string;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  affectedVariants: { id: string; name: string; dishName: string; dishId: string }[];
  affectedAddOns: { id: string; name: string }[];
};

class StageError extends Error {
  constructor(public stage: string, message: string) { super(message); this.name = "StageError"; }
}

export const executeIngredientImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IngredientImportPayloadSchema.parse(input))
  .handler(async ({ data, context }): Promise<IngredientImportResult> => {
    const ctx: Ctx = context;
    const { data: me } = await ctx.supabase.from("profiles").select("is_active").eq("id", ctx.userId).maybeSingle();
    if (!me?.is_active) throw new Error("Ihr Konto ist deaktiviert.");

    // ---- Stage 1: server-side validation against current data ------------
    const { data: existing, error: exErr } = await ctx.supabase.from("ingredients").select("id, name, is_active, price_status, package_price, package_quantity, package_unit");
    if (exErr) throw new StageError("Validierung", "Bestehende Zutaten konnten nicht geladen werden.");
    const byId = new Map<string, { id: string; name: string; is_active: boolean; price_status: string }>((existing ?? []).map((e: any) => [e.id, e]));
    const problems: string[] = [];
    const conflicts = crossRowConflicts(data.rows);
    for (const r of data.rows) {
      if (r.action === "skip") continue;
      const issues = validateValues(r).filter((i) => i.level === "error");
      if (issues.length) problems.push(`Zeile ${r.row}: ${issues.map((i) => i.message).join(" ")}`);
      if (conflicts.has(r.row)) problems.push(`Zeile ${r.row}: ${conflicts.get(r.row)}`);
      if (r.action === "update") {
        const target = r.ingredient_id ? byId.get(r.ingredient_id) : null;
        if (!target) { problems.push(`Zeile ${r.row}: Zielzutat für die Aktualisierung fehlt.`); continue; }
        if (target.price_status === "confirmed" && !r.approved_confirmed_overwrite)
          problems.push(`Zeile ${r.row}: «${target.name}» hat einen bestätigten Preis – Überschreiben nur mit ausdrücklicher Freigabe.`);
      }
      if (r.action === "create") {
        const m = matchIngredient(r.name, existing ?? []);
        if (m.level === "exact") problems.push(`Zeile ${r.row}: «${r.name}» existiert bereits (${byId.get(m.exactId!)?.name}). Bitte aktualisieren oder überspringen.`);
      }
    }
    if (problems.length) throw new StageError("Validierung", `Der Import wurde nicht ausgeführt:\n${problems.slice(0, 8).join("\n")}${problems.length > 8 ? `\n… und ${problems.length - 8} weitere` : ""}`);

    // ---- Stage 2: import record ---------------------------------------------
    const { data: job, error: jobErr } = await ctx.supabase
      .from("import_jobs")
      .insert({
        import_type: "ingredient_excel",
        source_kind: "file",
        source_name: data.fileName,
        file_url: data.fileName,
        file_size: data.fileSize,
        content_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        status: "processing",
        created_by: ctx.userId,
        row_count: data.rowCount,
      })
      .select("id")
      .single();
    if (jobErr || !job) throw new StageError("Import-Datensatz", "Der Import-Datensatz konnte nicht angelegt werden.");
    const jobId = job.id as string;

    // ---- Stage 3: transactional write ----------------------------------------
    const payload = { rows: data.rows.map((r) => ({ ...r, name: r.name.trim(), category: r.category.trim() })) } as unknown as Json;
    const { data: res, error: rpcErr } = await ctx.supabase.rpc("import_ingredient_rows", { _job_id: jobId, _payload: payload });
    if (rpcErr) {
      const msg = /^[A-ZÄÖÜ]/.test(rpcErr.message ?? "") && !/postgres|violates|syntax/i.test(rpcErr.message) ? rpcErr.message : "Die Datenbank hat den Import abgelehnt. Es wurden keine Änderungen gespeichert.";
      await ctx.supabase.from("import_jobs").update({ status: "failed", failed_stage: "Datenbankschreibung", error_message: msg, failed_count: data.rows.filter((r) => r.action !== "skip").length, created_count: 0, updated_count: 0, skipped_count: data.rows.filter((r) => r.action === "skip").length }).eq("id", jobId);
      throw new StageError("Datenbankschreibung", msg);
    }
    const out = res as { created: number; updated: number; skipped: number; ingredient_ids: string[] };

    // ---- Stage 4: affected variants / add-ons (for the result view) ---------
    const ids: string[] = out.ingredient_ids ?? [];
    let affectedVariants: IngredientImportResult["affectedVariants"] = [];
    let affectedAddOns: IngredientImportResult["affectedAddOns"] = [];
    if (ids.length) {
      const { data: items } = await ctx.supabase
        .from("calculation_items")
        .select("variant_id, add_on_id, variants(id, name, dish_id, dishes(id, name)), add_ons(id, name)")
        .in("ingredient_id", ids);
      const v = new Map<string, IngredientImportResult["affectedVariants"][number]>();
      const a = new Map<string, { id: string; name: string }>();
      for (const it of (items ?? []) as any[]) {
        if (it.variants) v.set(it.variants.id, { id: it.variants.id, name: it.variants.name, dishId: it.variants.dishes?.id ?? it.variants.dish_id, dishName: it.variants.dishes?.name ?? "" });
        if (it.add_ons) a.set(it.add_ons.id, { id: it.add_ons.id, name: it.add_ons.name });
      }
      affectedVariants = [...v.values()].sort((x, y) => `${x.dishName}${x.name}`.localeCompare(`${y.dishName}${y.name}`, "de-CH"));
      affectedAddOns = [...a.values()].sort((x, y) => x.name.localeCompare(y.name, "de-CH"));
    }
    return { jobId, created: out.created, updated: out.updated, skipped: out.skipped, failed: 0, affectedVariants, affectedAddOns };
  });
