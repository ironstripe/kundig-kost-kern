/**
 * Menu import – shared (client-safe) schemas, constants and types.
 *
 * Nothing here talks to the database or the AI. The server functions validate
 * every payload against these schemas before anything is stored.
 */
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export type ImportJob = Database["public"]["Tables"]["import_jobs"]["Row"];
export type ImportJobStatus = Database["public"]["Enums"]["import_job_status"];

export const MAX_IMPORT_BYTES = 15 * 1024 * 1024;
export const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export type AllowedMime = (typeof ALLOWED_MIME)[number];
export const MIME_EXT: Record<AllowedMime, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
export const ALLOWED_URL_HOSTS = ["kundelfingerhof.ch", "www.kundelfingerhof.ch"];

export const importJobStatusLabels: Record<ImportJobStatus, string> = {
  pending: "Bereit zur Analyse",
  processing: "Analyse läuft",
  review: "Zur Prüfung bereit",
  confirmed: "Übernommen",
  failed: "Fehlgeschlagen",
};

export const IMPORT_STEPS = ["Quelle", "Analyse", "Prüfung", "Übernahme", "Kalkulationsvorschlag"] as const;

export type ReviewItemState = "extracted" | "corrected" | "ambiguous" | "manual";
export const reviewStateLabels: Record<ReviewItemState, string> = {
  extracted: "Extrahiert",
  corrected: "Manuell korrigiert",
  ambiguous: "Unklar",
  manual: "Manuell ergänzt",
};

/** Detect a file type from its first bytes (magic numbers). */
export function sniffMime(bytes: Uint8Array): AllowedMime | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "application/pdf";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  )
    return "image/webp";
  return null;
}

export function formatBytes(n: number | null | undefined): string {
  if (n === null || n === undefined) return "–";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1).replace(".", ".")} MB`;
}

// ---------------------------------------------------------------------------
// 1) Raw AI extraction result (validated straight after the model call)
// ---------------------------------------------------------------------------

const name = z.string().trim().min(1).max(200);
const price = z.number().finite().min(0).max(10000);
const srcText = z.string().max(500).nullable().optional();

export const ExtractionSchema = z.object({
  menu_name_suggestion: z.string().trim().max(200).default("Speisekarte"),
  categories: z
    .array(
      z.object({
        name,
        sort_order: z.number().int().optional(),
        dishes: z.array(
          z.object({
            name,
            description: z.string().trim().max(600).nullable().optional(),
            sort_order: z.number().int().optional(),
            eligible_for_small_portion: z.boolean().optional(),
            variants: z
              .array(
                z.object({
                  name,
                  gross_price: price,
                  is_default: z.boolean().optional(),
                  source_text: srcText,
                }),
              )
              .min(1),
            add_ons: z
              .array(z.object({ name, gross_price: price, source_text: srcText }))
              .optional(),
          }),
        ),
      }),
    )
    .min(1),
  small_portion_rule: z
    .object({ detected: z.boolean(), discount: z.number().finite().nullable().optional(), source_text: srcText })
    .optional(),
  warnings: z
    .array(z.object({ type: z.string().max(60), message: z.string().max(500), source_text: srcText }))
    .default([]),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

// ---------------------------------------------------------------------------
// 2) Review state (what the user edits; stored as review_payload)
// ---------------------------------------------------------------------------

const stateEnum = z.enum(["extracted", "corrected", "ambiguous", "manual"]);

export const ReviewVariantSchema = z.object({
  key: z.string(),
  name: z.string().trim().max(200),
  gross_price: z.number().finite().min(0),
  is_default: z.boolean(),
  source_text: z.string().max(500).nullable(),
  excluded: z.boolean(),
  state: stateEnum,
  /** Proposed by the "kleine Portion" rule – needs explicit acceptance. */
  proposed: z.boolean(),
});
export const ReviewAddOnSchema = z.object({
  key: z.string(),
  name: z.string().trim().max(200),
  gross_price: z.number().finite().min(0),
  source_text: z.string().max(500).nullable(),
  excluded: z.boolean(),
  state: stateEnum,
});
export const ReviewDishSchema = z.object({
  key: z.string(),
  name: z.string().trim().max(200),
  description: z.string().trim().max(600).nullable(),
  excluded: z.boolean(),
  state: stateEnum,
  action: z.enum(["create", "update", "skip"]),
  existing_dish_id: z.string().uuid().nullable(),
  duplicate_of: z
    .object({ id: z.string().uuid(), name: z.string(), category: z.string().nullable(), prices: z.array(z.number()), reason: z.string() })
    .nullable(),
  variants: z.array(ReviewVariantSchema),
  add_ons: z.array(ReviewAddOnSchema),
});
export const ReviewCategorySchema = z.object({
  key: z.string(),
  name: z.string().trim().max(200),
  excluded: z.boolean(),
  state: stateEnum,
  existing_category_id: z.string().uuid().nullable(),
  dishes: z.array(ReviewDishSchema),
});
export const ReviewWarningSchema = z.object({ type: z.string(), message: z.string(), source_text: z.string().nullable() });
export const ReviewStateSchema = z.object({
  menu_name: z.string().trim().max(200),
  categories: z.array(ReviewCategorySchema),
  warnings: z.array(ReviewWarningSchema),
  small_portion_rule: z.object({ detected: z.boolean(), discount: z.number().nullable(), source_text: z.string().nullable() }).nullable(),
});
export type ReviewState = z.infer<typeof ReviewStateSchema>;
export type ReviewCategory = z.infer<typeof ReviewCategorySchema>;
export type ReviewDish = z.infer<typeof ReviewDishSchema>;
export type ReviewVariant = z.infer<typeof ReviewVariantSchema>;
export type ReviewAddOn = z.infer<typeof ReviewAddOnSchema>;

export type ReviewIssue = { level: "error" | "warning"; path: string; message: string };

/** Validation of the reviewed structure before "Speisekarte übernehmen". */
export function validateReview(state: ReviewState): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const dishNames = new Map<string, string>();
  let included = 0;
  for (const c of state.categories) {
    if (c.excluded) continue;
    if (!c.name.trim()) issues.push({ level: "error", path: c.name || c.key, message: "Kategorie ohne Namen." });
    for (const d of c.dishes) {
      if (d.excluded || d.action === "skip") continue;
      included++;
      const label = `${c.name} → ${d.name || "(ohne Namen)"}`;
      if (!d.name.trim()) issues.push({ level: "error", path: label, message: "Gericht ohne Namen." });
      const nk = normaliseKey(d.name);
      if (dishNames.has(nk)) issues.push({ level: "warning", path: label, message: `Gleichnamiges Gericht auch in «${dishNames.get(nk)}».` });
      else dishNames.set(nk, c.name);
      const vs = d.variants.filter((v) => !v.excluded);
      if (vs.length === 0) issues.push({ level: "error", path: label, message: "Mindestens eine Variante ist nötig." });
      const defaults = vs.filter((v) => v.is_default).length;
      if (vs.length > 0 && defaults !== 1) issues.push({ level: "error", path: label, message: "Genau eine Standardvariante ist nötig." });
      const vnames = new Set<string>();
      for (const v of vs) {
        if (!v.name.trim()) issues.push({ level: "error", path: label, message: "Variante ohne Namen." });
        if (!(v.gross_price >= 0) || !Number.isFinite(v.gross_price)) issues.push({ level: "error", path: label, message: `Ungültiger Preis bei Variante «${v.name}».` });
        if (vnames.has(normaliseKey(v.name))) issues.push({ level: "error", path: label, message: `Doppelte Variante «${v.name}».` });
        vnames.add(normaliseKey(v.name));
        if (v.state === "ambiguous") issues.push({ level: "warning", path: label, message: `Variante «${v.name}» ist als unklar markiert.` });
      }
      for (const a of d.add_ons.filter((x) => !x.excluded)) {
        if (!a.name.trim()) issues.push({ level: "error", path: label, message: "Add-on ohne Namen." });
        if (!(a.gross_price > 0)) issues.push({ level: "error", path: label, message: `Add-on «${a.name}» braucht einen positiven Aufpreis.` });
      }
      if (d.action === "update" && !d.existing_dish_id) issues.push({ level: "error", path: label, message: "Aktualisieren ohne bestehendes Gericht." });
    }
  }
  if (included === 0) issues.push({ level: "error", path: "Speisekarte", message: "Kein Gericht ist für die Übernahme ausgewählt." });
  return issues;
}

export function normaliseKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/[«»"'`´’]/g, "")
    .replace(/[^a-z0-9äöüéèàç ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Sørensen–Dice similarity on character bigrams (0..1). */
export function similarity(a: string, b: string): number {
  const x = normaliseKey(a);
  const y = normaliseKey(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const grams = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  };
  const ga = grams(x);
  const gb = grams(y);
  let inter = 0;
  for (const [g, n] of ga) inter += Math.min(n, gb.get(g) ?? 0);
  return (2 * inter) / (x.length - 1 + (y.length - 1));
}

// ---------------------------------------------------------------------------
// 3) Ingredient / quantity estimation
// ---------------------------------------------------------------------------

export const EstimationAiSchema = z.object({
  dishes: z.array(
    z.object({
      dish_id: z.string(),
      variants: z.array(
        z.object({
          variant_id: z.string(),
          calculation_items: z.array(
            z.object({
              component_group: z.string().max(40),
              ingredient_name: name,
              net_quantity: z.number().finite().min(0),
              quantity_unit: z.enum(["g", "ml", "piece"]),
              yield_percent: z.number().finite().min(1).max(100).default(100),
              estimated_package_quantity: z.number().finite().positive(),
              estimated_package_unit: z.enum(["kg", "g", "l", "ml", "piece"]),
              estimated_package_price: z.number().finite().min(0),
              estimated_base_unit: z.enum(["g", "ml", "piece"]),
              ingredient_category: z.string().max(80).optional(),
              reasoning_note: z.string().max(240),
            }),
          ),
          warnings: z.array(z.string().max(300)).default([]),
        }),
      ),
    }),
  ),
});
export type EstimationAi = z.infer<typeof EstimationAiSchema>;

export const EstimationRowSchema = z.object({
  key: z.string(),
  dish_id: z.string().uuid(),
  dish_name: z.string(),
  variant_id: z.string().uuid(),
  variant_name: z.string(),
  component_group: z.string(),
  ingredient_name: z.string().trim().max(200),
  ingredient_category: z.string().max(80),
  /** Linked existing central ingredient (null → create new estimated ingredient). */
  match_id: z.string().uuid().nullable(),
  candidates: z.array(z.object({ id: z.string().uuid(), name: z.string(), score: z.number() })),
  net_quantity: z.number().finite().min(0),
  quantity_unit: z.enum(["g", "ml", "piece"]),
  yield_percent: z.number().finite().min(1).max(100),
  est_package_quantity: z.number().finite().positive(),
  est_package_unit: z.enum(["kg", "g", "l", "ml", "piece"]),
  est_package_price: z.number().finite().min(0),
  est_base_unit: z.enum(["g", "ml", "piece"]),
  note: z.string().max(240),
  excluded: z.boolean(),
  warnings: z.array(z.string()),
});
export const EstimationStateSchema = z.object({
  generated_at: z.string(),
  rows: z.array(EstimationRowSchema),
  skipped_variants: z.array(z.object({ variant_id: z.string(), label: z.string(), reason: z.string() })),
  warnings: z.array(z.string()),
});
export type EstimationRow = z.infer<typeof EstimationRowSchema>;
export type EstimationState = z.infer<typeof EstimationStateSchema>;

export const componentGroupHint = "main | sauce | side | vegetables | garnish | preparation | other";
