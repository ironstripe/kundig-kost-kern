/**
 * Menu import – server functions. Every step is triggered explicitly by the
 * user; nothing here runs automatically. All AI calls and URL downloads run
 * on the server, and every write goes through the caller's own RLS-scoped
 * client (or a transactional database procedure running as the caller).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import {
  ALLOWED_MIME,
  MAX_IMPORT_BYTES,
  MIME_EXT,
  ReviewStateSchema,
  EstimationStateSchema,
  normaliseKey,
  similarity,
  validateReview,
  type AllowedMime,
  type Extraction,
  type ReviewState,
  type ReviewDish,
  type EstimationState,
  type EstimationRow,
  type ReviewVariant,
} from "@/lib/import-schema";
import { PACKAGE_TO_BASE } from "@/lib/costing";
import { COMPONENT_GROUPS } from "@/lib/labels";

const GROUP_VALUES = new Set<string>(COMPONENT_GROUPS.map((g) => g.value));
const safeGroup = (g: string) => (GROUP_VALUES.has(g) ? g : "other");

const BUCKET = "menu-sources";
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PATH_RE = new RegExp(`^uploads/${UUID}/${UUID}\\.(pdf|jpg|png|webp)$`);

type Ctx = { supabase: any; userId: string };

function userMessage(e: unknown, fallback: string): string {
  if (e && typeof e === "object" && "name" in e && (e as { name: string }).name === "ImportError") return (e as Error).message;
  if (e instanceof Error && /^[A-Za-zÄÖÜäöü«»]/.test(e.message) && e.message.length < 200 && !/at\s|\bstack\b|supabase|postgres|jwt/i.test(e.message))
    return e.message;
  return fallback;
}

async function assertActive(ctx: Ctx) {
  const { data, error } = await ctx.supabase.from("profiles").select("is_active").eq("id", ctx.userId).maybeSingle();
  if (error || !data || !data.is_active) throw new Error("Ihr Konto ist deaktiviert.");
}

async function loadJob(ctx: Ctx, jobId: string) {
  const { data, error } = await ctx.supabase.from("import_jobs").select("*").eq("id", jobId).maybeSingle();
  if (error || !data) throw new Error("Import-Auftrag nicht gefunden.");
  return data as import("@/lib/import-schema").ImportJob;
}

async function setJob(ctx: Ctx, jobId: string, patch: Record<string, unknown>) {
  const { error } = await ctx.supabase.from("import_jobs").update(patch).eq("id", jobId);
  if (error) throw new Error("Der Import-Auftrag konnte nicht aktualisiert werden.");
}

// ---------------------------------------------------------------------------
// 1) Register an uploaded file (the browser uploaded it to the private bucket)
// ---------------------------------------------------------------------------

export const registerFileImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        menuCardId: z.string().uuid(),
        storagePath: z.string().regex(PATH_RE, "Ungültiger Speicherpfad."),
        originalName: z.string().trim().min(1).max(255),
        contentType: z.enum(ALLOWED_MIME),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertActive(context);
    if (!data.storagePath.startsWith(`uploads/${data.menuCardId}/`)) throw new Error("Speicherpfad passt nicht zur Speisekarte.");
    const folder = data.storagePath.split("/").slice(0, -1).join("/");
    const file = data.storagePath.split("/").pop()!;
    const { data: listed, error } = await context.supabase.storage.from(BUCKET).list(folder, { search: file });
    const obj = (listed ?? []).find((o: { name: string }) => o.name === file);
    if (error || !obj) throw new Error("Die hochgeladene Datei wurde nicht gefunden.");
    const size = Number((obj as { metadata?: { size?: number } }).metadata?.size ?? 0) || null;
    if (size && size > MAX_IMPORT_BYTES) throw new Error("Die Datei ist grösser als 15 MB.");
    const ext = file.split(".").pop();
    if (MIME_EXT[data.contentType] !== ext) throw new Error("Dateityp und Dateiendung passen nicht zusammen.");

    const { data: job, error: insErr } = await context.supabase
      .from("import_jobs")
      .insert({
        menu_card_id: data.menuCardId,
        import_type: "menu_document",
        file_url: data.storagePath,
        storage_path: data.storagePath,
        source_kind: "file",
        source_name: data.originalName,
        content_type: data.contentType,
        file_size: size,
        status: "pending",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (insErr || !job) throw new Error("Der Import-Auftrag konnte nicht angelegt werden.");
    return { jobId: job.id as string };
  });

// ---------------------------------------------------------------------------
// 2) Import from an allow-listed URL (download happens here, server-side)
// ---------------------------------------------------------------------------

export const importFromUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ menuCardId: z.string().uuid(), url: z.string().trim().min(8).max(2000) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertActive(context);
    const { fetchRestrictedUrl } = await import("@/lib/import.server");
    let doc;
    try {
      doc = await fetchRestrictedUrl(data.url);
    } catch (e) {
      throw new Error(userMessage(e, "Der Link konnte nicht geladen werden."));
    }
    const path = `uploads/${data.menuCardId}/${crypto.randomUUID()}.${MIME_EXT[doc.mime]}`;
    const { error: upErr } = await context.supabase.storage
      .from(BUCKET)
      .upload(path, doc.bytes, { contentType: doc.mime, upsert: false });
    if (upErr) {
      console.error("[import] storage upload failed", upErr);
      throw new Error("Das Dokument konnte nicht gespeichert werden.");
    }
    const { data: job, error: insErr } = await context.supabase
      .from("import_jobs")
      .insert({
        menu_card_id: data.menuCardId,
        import_type: "menu_document",
        file_url: doc.finalUrl,
        storage_path: path,
        source_kind: "url",
        source_name: doc.finalUrl,
        content_type: doc.mime,
        file_size: doc.bytes.byteLength,
        status: "pending",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (insErr || !job) throw new Error("Der Import-Auftrag konnte nicht angelegt werden.");
    return { jobId: job.id as string };
  });

// ---------------------------------------------------------------------------
// 3) Analyse (explicit "Analyse starten")
// ---------------------------------------------------------------------------

type ExistingDish = { id: string; name: string; category: string | null; prices: number[] };

function buildReviewState(ex: Extraction, existing: ExistingDish[], existingCategories: { id: string; name: string }[]): ReviewState {
  let n = 0;
  const key = (p: string) => `${p}${++n}`;
  const rule = ex.small_portion_rule?.detected ? { detected: true, discount: ex.small_portion_rule.discount ?? 4, source_text: ex.small_portion_rule.source_text ?? null } : null;
  const warnings = ex.warnings.map((w) => ({ type: w.type, message: w.message, source_text: w.source_text ?? null }));

  const categories = [...ex.categories]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((c) => {
      const existingCat = existingCategories.find((x) => normaliseKey(x.name) === normaliseKey(c.name));
      const dishes: ReviewDish[] = [...c.dishes]
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((d) => {
          const variants: ReviewVariant[] = d.variants.map((v, i) => ({
            key: key("v"),
            name: v.name,
            gross_price: v.gross_price,
            is_default: v.is_default ?? i === 0,
            source_text: v.source_text ?? null,
            excluded: false,
            state: "extracted" as const,
            proposed: false,
          }));
          if (!variants.some((v) => v.is_default) && variants[0]) variants[0].is_default = true;
          if (variants.filter((v) => v.is_default).length > 1) {
            let seen = false;
            for (const v of variants) {
              if (v.is_default && seen) v.is_default = false;
              if (v.is_default) seen = true;
            }
            warnings.push({ type: "ambiguous_default", message: `Mehrere Standardvarianten bei «${d.name}» – erste übernommen.`, source_text: null });
          }
          // "Hauptgang als kleine Portion −4": propose, never auto-accept.
          if (rule && d.eligible_for_small_portion && variants.length === 1 && variants[0]!.gross_price > rule.discount) {
            variants.push({
              key: key("v"),
              name: "Klein",
              gross_price: Math.round((variants[0]!.gross_price - rule.discount) * 100) / 100,
              is_default: false,
              source_text: rule.source_text,
              excluded: true,
              state: "ambiguous",
              proposed: true,
            });
          }
          // Duplicate detection against the target card.
          let dup: ReviewDish["duplicate_of"] = null;
          let best = 0;
          for (const e of existing) {
            const s = similarity(e.name, d.name);
            if (s > best && s >= 0.8) {
              best = s;
              const samePrice = e.prices.some((p) => variants.some((v) => !v.proposed && Math.abs(v.gross_price - p) < 0.005));
              const reason = [s >= 0.999 ? "Gleicher Name" : "Ähnlicher Name", samePrice ? "gleicher Preis" : null].filter(Boolean).join(", ");
              dup = { id: e.id, name: e.name, category: e.category, prices: e.prices, reason };
            }
          }
          return {
            key: key("d"),
            name: d.name,
            description: d.description ?? null,
            excluded: false,
            state: "extracted" as const,
            action: dup ? ("skip" as const) : ("create" as const),
            existing_dish_id: dup?.id ?? null,
            duplicate_of: dup,
            variants,
            add_ons: (d.add_ons ?? []).map((a) => ({
              key: key("a"),
              name: a.name,
              gross_price: a.gross_price,
              source_text: a.source_text ?? null,
              excluded: false,
              state: a.gross_price > 0 ? ("extracted" as const) : ("ambiguous" as const),
            })),
          };
        });
      return { key: key("c"), name: c.name, excluded: false, state: "extracted" as const, existing_category_id: existingCat?.id ?? null, dishes };
    });
  return { menu_name: ex.menu_name_suggestion || "Speisekarte", categories, warnings, small_portion_rule: rule };
}

export const analyzeImportJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertActive(context);
    const job = await loadJob(context, data.jobId);
    if (job.status === "processing") throw new Error("Die Analyse läuft bereits.");
    if (job.status === "confirmed") throw new Error("Dieser Import wurde bereits übernommen.");
    if (!job.storage_path) throw new Error("Für diesen Import ist kein Dokument gespeichert.");
    await setJob(context, job.id, { status: "processing", error_message: null });
    try {
      const { data: blob, error: dlErr } = await context.supabase.storage.from(BUCKET).download(job.storage_path);
      if (dlErr || !blob) throw new Error("Das Dokument konnte nicht aus dem Speicher geladen werden.");
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (bytes.byteLength > MAX_IMPORT_BYTES) throw new Error("Das Dokument ist grösser als 15 MB.");
      const { sniffMime } = await import("@/lib/import-schema");
      const mime = (sniffMime(bytes) ?? job.content_type) as AllowedMime | null;
      if (!mime || !(ALLOWED_MIME as readonly string[]).includes(mime)) throw new Error("Das Dokument hat keinen unterstützten Dateityp.");

      const { extractMenuStructure } = await import("@/lib/import.server");
      const extraction = await extractMenuStructure(bytes, mime, job.source_name ?? "speisekarte");
      const dishCount = extraction.categories.reduce((s, c) => s + c.dishes.length, 0);
      if (dishCount === 0) throw new Error("Im Dokument wurden keine Speisen erkannt.");

      const [{ data: dishes }, { data: cats }, { data: variants }] = await Promise.all([
        context.supabase.from("dishes").select("id, name, category_id").eq("menu_card_id", job.menu_card_id).eq("is_active", true),
        context.supabase.from("categories").select("id, name").eq("menu_card_id", job.menu_card_id),
        context.supabase.from("variants").select("dish_id, gross_price"),
      ]);
      const catName = new Map<string, string>((cats ?? []).map((c: { id: string; name: string }) => [c.id, c.name]));
      const existing: ExistingDish[] = (dishes ?? []).map((d: { id: string; name: string; category_id: string | null }) => ({
        id: d.id,
        name: d.name,
        category: d.category_id ? (catName.get(d.category_id) ?? null) : null,
        prices: (variants ?? []).filter((v: { dish_id: string }) => v.dish_id === d.id).map((v: { gross_price: number }) => Number(v.gross_price)),
      }));
      const review = buildReviewState(extraction, existing, cats ?? []);
      await setJob(context, job.id, {
        status: "review",
        extracted_payload: extraction as unknown as Json,
        review_payload: review as unknown as Json,
        error_message: null,
      });
      return { ok: true as const, review };
    } catch (e) {
      const message = userMessage(e, "Die Analyse ist fehlgeschlagen.");
      console.error("[import] analysis failed", e);
      await setJob(context, job.id, { status: "failed", error_message: message }).catch(() => undefined);
      throw new Error(message);
    }
  });

// ---------------------------------------------------------------------------
// 4) Save review draft / 5) Confirm ("Speisekarte übernehmen")
// ---------------------------------------------------------------------------

export const saveImportReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid(), review: ReviewStateSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const job = await loadJob(context, data.jobId);
    if (job.status !== "review") throw new Error("Dieser Import ist nicht in Prüfung.");
    await setJob(context, job.id, { review_payload: data.review as unknown as Json });
    return { ok: true as const };
  });

export const confirmImportJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid(), review: ReviewStateSchema }).parse(input))
  .handler(async ({ data, context }) => {
    await assertActive(context);
    const job = await loadJob(context, data.jobId);
    if (job.status !== "review") throw new Error("Dieser Import ist nicht zur Übernahme bereit.");
    const issues = validateReview(data.review).filter((i) => i.level === "error");
    if (issues.length) throw new Error(`Prüfung unvollständig: ${issues[0]!.message}`);

    // Reduce the review state to what the database procedure needs.
    let catOrder = 0;
    const payload = {
      menu_name: data.review.menu_name,
      categories: data.review.categories
        .filter((c) => !c.excluded)
        .map((c) => {
          let dishOrder = 0;
          return {
            name: c.name.trim(),
            sort_order: ++catOrder,
            existing_category_id: c.existing_category_id,
            dishes: c.dishes
              .filter((d) => !d.excluded && d.action !== "skip")
              .map((d) => ({
                name: d.name.trim(),
                description: d.description?.trim() || null,
                sort_order: ++dishOrder,
                action: d.action,
                existing_dish_id: d.action === "update" ? d.existing_dish_id : null,
                variants: d.variants.filter((v) => !v.excluded).map((v) => ({ name: v.name.trim(), gross_price: v.gross_price, is_default: v.is_default })),
                add_ons: d.add_ons.filter((a) => !a.excluded).map((a) => ({ name: a.name.trim(), gross_price: a.gross_price })),
              })),
          };
        })
        .filter((c) => c.dishes.length > 0),
    };
    // Keep the latest reviewed state even if the procedure fails (retry stays possible).
    await setJob(context, job.id, { review_payload: data.review as unknown as Json });
    const { data: result, error } = await context.supabase.rpc("import_menu_payload", { _job_id: job.id, _payload: payload as unknown as Json });
    if (error) {
      console.error("[import] confirm failed", error);
      throw new Error(userMessage(new Error(error.message), "Die Übernahme in die Datenbank ist fehlgeschlagen. Es wurde nichts gespeichert."));
    }
    return result as { dishes_created: number; dishes_updated: number; dishes_skipped: number; variants_created: number; add_ons_created: number; dish_ids: string[] };
  });

// ---------------------------------------------------------------------------
// 6) Ingredient & quantity estimation (explicit "Zutaten und Mengen schätzen")
// ---------------------------------------------------------------------------

export const startEstimation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid(), dishIds: z.array(z.string().uuid()).min(1).max(60) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertActive(context);
    const job = await loadJob(context, data.jobId);
    if (job.status !== "confirmed") throw new Error("Die Speisekarte muss zuerst übernommen werden.");

    const [{ data: dishes, error: dErr }, { data: cats }, { data: ingredients, error: iErr }] = await Promise.all([
      context.supabase.from("dishes").select("id, name, description, category_id").eq("menu_card_id", job.menu_card_id).in("id", data.dishIds),
      context.supabase.from("categories").select("id, name").eq("menu_card_id", job.menu_card_id),
      context.supabase.from("ingredients").select("id, name, base_unit, price_status, is_active").eq("is_active", true),
    ]);
    if (dErr || iErr) throw new Error("Die Daten für den Kalkulationsvorschlag konnten nicht geladen werden.");
    if (!dishes?.length) throw new Error("Keine passenden Gerichte gefunden.");
    const dishIds = dishes.map((d: { id: string }) => d.id);
    const [{ data: variants }, { data: items }] = await Promise.all([
      context.supabase.from("variants").select("id, dish_id, name, gross_price, is_active").in("dish_id", dishIds).eq("is_active", true),
      context.supabase.from("calculation_items").select("variant_id").not("variant_id", "is", null),
    ]);
    const withItems = new Set<string>((items ?? []).map((i: { variant_id: string | null }) => i.variant_id).filter((x: string | null): x is string => !!x));
    const catName = new Map<string, string>((cats ?? []).map((c: { id: string; name: string }) => [c.id, c.name]));
    const skipped: EstimationState["skipped_variants"] = [];
    const input = dishes
      .map((d: { id: string; name: string; description: string | null; category_id: string | null }) => ({
        dish_id: d.id,
        name: d.name,
        description: d.description,
        category: d.category_id ? (catName.get(d.category_id) ?? null) : null,
        variants: (variants ?? [])
          .filter((v: { dish_id: string }) => v.dish_id === d.id)
          .filter((v: { id: string; name: string }) => {
            if (withItems.has(v.id)) {
              skipped.push({ variant_id: v.id, label: `${d.name} · ${v.name}`, reason: "Hat bereits Kalkulationspositionen – wird nicht überschrieben." });
              return false;
            }
            return true;
          })
          .map((v: { id: string; name: string; gross_price: number }) => ({ variant_id: v.id, name: v.name, gross_price: Number(v.gross_price) })),
      }))
      .filter((d: { variants: unknown[] }) => d.variants.length > 0);
    if (input.length === 0) throw new Error("Alle gewählten Varianten haben bereits Kalkulationspositionen.");

    const { estimateIngredientsForDishes } = await import("@/lib/import.server");
    let ai;
    try {
      ai = await estimateIngredientsForDishes(input, (ingredients ?? []).map((i: { name: string }) => i.name));
    } catch (e) {
      throw new Error(userMessage(e, "Der Kalkulationsvorschlag ist fehlgeschlagen."));
    }

    const ingList = (ingredients ?? []) as { id: string; name: string; base_unit: string; price_status: string }[];
    const dishById = new Map(dishes.map((d: { id: string; name: string }) => [d.id, d.name]));
    const varById = new Map((variants ?? []).map((v: { id: string; name: string; dish_id: string }) => [v.id, v]));
    const rows: EstimationRow[] = [];
    const warnings: string[] = [];
    let n = 0;
    for (const d of ai.dishes) {
      if (!dishById.has(d.dish_id)) continue;
      for (const v of d.variants) {
        const vr = varById.get(v.variant_id) as { id: string; name: string; dish_id: string } | undefined;
        if (!vr || vr.dish_id !== d.dish_id || withItems.has(vr.id)) continue;
        for (const it of v.calculation_items) {
          const candidates = ingList
            .map((i) => ({ id: i.id, name: i.name, score: similarity(i.name, it.ingredient_name), base_unit: i.base_unit, price_status: i.price_status }))
            .filter((c) => c.score >= 0.55)
            .sort((a, b) => b.score - a.score || (a.price_status === "confirmed" ? -1 : 1))
            .slice(0, 4);
          const exact = candidates.find((c) => c.score >= 0.999 && c.base_unit === it.quantity_unit);
          const confirmedGood = candidates.find((c) => c.score >= 0.85 && c.price_status === "confirmed" && c.base_unit === it.quantity_unit);
          const match = exact ?? confirmedGood ?? null;
          const rowWarnings = [...v.warnings];
          if (PACKAGE_TO_BASE[it.estimated_package_unit] !== it.estimated_base_unit) rowWarnings.push("Gebinde-Einheit passt nicht zur Basiseinheit.");
          if (it.quantity_unit !== it.estimated_base_unit) rowWarnings.push("Mengeneinheit weicht von der Basiseinheit ab.");
          if (it.net_quantity <= 0) rowWarnings.push("Menge ist 0.");
          rows.push({
            key: `e${++n}`,
            dish_id: d.dish_id,
            dish_name: String(dishById.get(d.dish_id)),
            variant_id: vr.id,
            variant_name: vr.name,
            component_group: safeGroup(it.component_group),
            ingredient_name: it.ingredient_name,
            ingredient_category: it.ingredient_category ?? "Sonstiges",
            match_id: match?.id ?? null,
            candidates: candidates.map((c) => ({ id: c.id, name: c.name, score: Math.round(c.score * 100) / 100 })),
            net_quantity: it.net_quantity,
            quantity_unit: it.quantity_unit,
            yield_percent: it.yield_percent,
            est_package_quantity: it.estimated_package_quantity,
            est_package_unit: it.estimated_package_unit,
            est_package_price: it.estimated_package_price,
            est_base_unit: it.estimated_base_unit,
            note: it.reasoning_note,
            excluded: false,
            warnings: rowWarnings,
          });
        }
      }
    }
    if (rows.length === 0) throw new Error("Der KI-Dienst hat keine verwertbaren Positionen vorgeschlagen.");
    const state: EstimationState = { generated_at: new Date().toISOString(), rows, skipped_variants: skipped, warnings };
    await setJob(context, job.id, { estimation_payload: state as unknown as Json });
    return state;
  });

export const confirmEstimation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid(), state: EstimationStateSchema }).parse(input))
  .handler(async ({ data, context }) => {
    await assertActive(context);
    const job = await loadJob(context, data.jobId);
    if (job.status !== "confirmed") throw new Error("Die Speisekarte muss zuerst übernommen werden.");
    const rows = data.state.rows.filter((r) => !r.excluded);
    if (rows.length === 0) throw new Error("Keine Position ausgewählt.");

    const matchIds = [...new Set(rows.map((r) => r.match_id).filter((x): x is string => !!x))];
    const { data: linked } = matchIds.length
      ? await context.supabase.from("ingredients").select("id, base_unit").in("id", matchIds)
      : { data: [] as { id: string; base_unit: string }[] };
    const baseUnitOf = new Map<string, string>((linked ?? []).map((i: { id: string; base_unit: string }) => [i.id, i.base_unit]));

    const newIngredients = new Map<string, { key: string; name: string; category: string; package_quantity: number; package_unit: string; package_price: number; base_unit: string }>();
    const items: Record<string, unknown>[] = [];
    for (const r of rows) {
      if (!r.ingredient_name.trim()) throw new Error("Eine Position hat keinen Zutatennamen.");
      if (!(r.net_quantity > 0)) throw new Error(`«${r.ingredient_name}»: Menge muss grösser als 0 sein.`);
      if (r.match_id) {
        const bu = baseUnitOf.get(r.match_id);
        if (!bu) throw new Error(`«${r.ingredient_name}»: verknüpfte Zutat nicht gefunden.`);
        if (bu !== r.quantity_unit) throw new Error(`«${r.ingredient_name}»: Mengeneinheit passt nicht zur Basiseinheit der verknüpften Zutat (${bu}).`);
        items.push({ variant_id: r.variant_id, ingredient_id: r.match_id, component_group: r.component_group, net_quantity: r.net_quantity, quantity_unit: r.quantity_unit, yield_percent: r.yield_percent, notes: r.note });
      } else {
        if (PACKAGE_TO_BASE[r.est_package_unit] !== r.est_base_unit) throw new Error(`«${r.ingredient_name}»: Gebinde-Einheit passt nicht zur Basiseinheit.`);
        if (r.quantity_unit !== r.est_base_unit) throw new Error(`«${r.ingredient_name}»: Mengeneinheit passt nicht zur Basiseinheit.`);
        const k = `${normaliseKey(r.ingredient_name)}|${r.est_base_unit}`;
        if (!newIngredients.has(k))
          newIngredients.set(k, {
            key: k,
            name: r.ingredient_name.trim(),
            category: r.ingredient_category || "Sonstiges",
            package_quantity: r.est_package_quantity,
            package_unit: r.est_package_unit,
            package_price: r.est_package_price,
            base_unit: r.est_base_unit,
          });
        items.push({ variant_id: r.variant_id, ingredient_key: k, component_group: r.component_group, net_quantity: r.net_quantity, quantity_unit: r.quantity_unit, yield_percent: r.yield_percent, notes: r.note });
      }
    }
    const payload = { new_ingredients: [...newIngredients.values()], items } as unknown as Json;
    const { data: result, error } = await context.supabase.rpc("import_estimation_payload", { _job_id: job.id, _payload: payload });
    if (error) {
      console.error("[import] estimation confirm failed", error);
      throw new Error(userMessage(new Error(error.message), "Die Kalkulationspositionen konnten nicht gespeichert werden. Es wurde nichts geschrieben."));
    }
    return result as { ingredients_created: number; items_created: number };
  });
