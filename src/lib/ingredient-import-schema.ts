/**
 * Standardised Excel ingredient import – shared rules (browser + server).
 * One fixed KundiCalc template; no arbitrary column mapping.
 */
import { z } from "zod";
import { PACKAGE_TO_BASE, unitPrice, type BaseUnit, type PackageUnit } from "@/lib/costing";
import { normaliseKey, similarity } from "@/lib/import-schema";

export const TEMPLATE_FILE_NAME = "KundiCalc_Zutatenimport.xlsx";
export const IMPORT_SHEET = "KundiCalc Import";
export const GUIDE_SHEET = "Anleitung";
export const VALUES_SHEET = "Werte";
export const MAX_XLSX_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 2000;

export const TEMPLATE_COLUMNS = [
  "Zutatenname",
  "Kategorie",
  "Lieferant",
  "Gebindemenge",
  "Gebindeeinheit",
  "Gebindebezeichnung",
  "Gebindepreis_CHF",
  "Basiseinheit",
  "Preisstand",
  "Eigene_Produktion",
  "Notiz",
] as const;
export type TemplateColumn = (typeof TEMPLATE_COLUMNS)[number];

export const REQUIRED_COLUMNS: TemplateColumn[] = [
  "Zutatenname",
  "Kategorie",
  "Gebindemenge",
  "Gebindeeinheit",
  "Gebindepreis_CHF",
  "Basiseinheit",
  "Eigene_Produktion",
];

export const PACKAGE_UNIT_VALUES = ["kg", "g", "l", "ml", "Stück"] as const;
export const BASE_UNIT_VALUES = ["g", "ml", "Stück"] as const;
export const YES_NO_VALUES = ["Ja", "Nein"] as const;

export const INGREDIENT_IMPORT_STEPS = ["Datei wählen", "Prüfung", "Vorschau", "Bestätigung", "Ergebnis"] as const;

const packageUnitFromLabel: Record<string, PackageUnit> = { kg: "kg", g: "g", l: "l", ml: "ml", stück: "piece", stueck: "piece" };
const baseUnitFromLabel: Record<string, BaseUnit> = { g: "g", ml: "ml", stück: "piece", stueck: "piece" };

/** Raw cell values as read from the workbook – already reduced to primitives. */
export type RawRow = { row: number; cells: Partial<Record<TemplateColumn, string>> };

export type RowAction = "create" | "update" | "skip";
export const rowActionLabels: Record<RowAction, string> = {
  create: "Neu anlegen",
  update: "Bestehende Zutat aktualisieren",
  skip: "Überspringen",
};

export type MatchLevel = "exact" | "likely" | "none";
export const matchLevelLabels: Record<MatchLevel, string> = {
  exact: "Exakte Übereinstimmung",
  likely: "Wahrscheinliche Übereinstimmung",
  none: "Keine Übereinstimmung",
};

/** Normalised ingredient name used for matching (umlauts preserved). */
export function normaliseIngredientName(name: string): string {
  return normaliseKey(name).replace(/[.,;:!?()\-_/]+/g, " ").replace(/\s+/g, " ").trim();
}

export type ParsedValues = {
  name: string;
  category: string;
  supplier: string | null;
  package_quantity: number | null;
  package_unit: PackageUnit | null;
  package_label: string | null;
  package_price: number | null;
  base_unit: BaseUnit | null;
  price_date: string | null;
  is_own_production: boolean | null;
  notes: string | null;
};

export type RowIssue = { level: "error" | "warning"; message: string };

const NUMBER_RE = /^-?\d+(?:[.,]\d+)?$/;
export function parsePlainNumber(raw: string | undefined): number | null | "invalid" {
  const s = (raw ?? "").trim().replace(/'/g, "");
  if (!s) return null;
  if (!NUMBER_RE.test(s)) return "invalid";
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : "invalid";
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function isValidIsoDate(s: string): boolean {
  if (!ISO_DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Validate one raw row into typed values plus issues. */
export function parseRow(raw: RawRow): { values: ParsedValues; issues: RowIssue[] } {
  const c = raw.cells;
  const issues: RowIssue[] = [];
  const err = (m: string) => issues.push({ level: "error", message: m });
  const text = (k: TemplateColumn) => (c[k] ?? "").trim().replace(/\s+/g, " ");

  const name = text("Zutatenname");
  if (!name) err("Zutatenname fehlt.");
  else if (name.length > 120) err("Zutatenname ist länger als 120 Zeichen.");
  const category = text("Kategorie");
  if (!category) err("Kategorie fehlt.");

  const qty = parsePlainNumber(c.Gebindemenge);
  if (qty === null) err("Gebindemenge fehlt.");
  else if (qty === "invalid") err("Gebindemenge ist keine Zahl.");
  else if (qty <= 0) err("Gebindemenge muss grösser als 0 sein.");

  const puRaw = text("Gebindeeinheit");
  const pu = packageUnitFromLabel[puRaw.toLowerCase()] ?? null;
  if (!puRaw) err("Gebindeeinheit fehlt.");
  else if (!pu) err(`Gebindeeinheit «${puRaw}» ist nicht erlaubt (kg, g, l, ml, Stück).`);

  const price = parsePlainNumber(c.Gebindepreis_CHF);
  if (price === null) err("Gebindepreis_CHF fehlt.");
  else if (price === "invalid") err("Gebindepreis_CHF muss eine reine Zahl ohne Währungszeichen sein.");
  else if (price < 0) err("Gebindepreis_CHF darf nicht negativ sein.");

  const buRaw = text("Basiseinheit");
  const bu = baseUnitFromLabel[buRaw.toLowerCase()] ?? null;
  if (!buRaw) err("Basiseinheit fehlt.");
  else if (!bu) err(`Basiseinheit «${buRaw}» ist nicht erlaubt (g, ml, Stück).`);

  if (pu && bu && PACKAGE_TO_BASE[pu] !== bu) {
    err(`Gebindeeinheit «${puRaw}» passt nicht zur Basiseinheit «${buRaw}» (Gewicht, Volumen und Stück dürfen nicht gemischt werden).`);
  }

  const dateRaw = text("Preisstand");
  let price_date: string | null = null;
  if (dateRaw) {
    if (isValidIsoDate(dateRaw)) price_date = dateRaw;
    else err(`Preisstand «${dateRaw}» ist kein gültiges Datum im Format JJJJ-MM-TT.`);
  }

  const ownRaw = text("Eigene_Produktion");
  let own: boolean | null = null;
  if (!ownRaw) err("Eigene_Produktion fehlt (Ja oder Nein).");
  else if (ownRaw.toLowerCase() === "ja") own = true;
  else if (ownRaw.toLowerCase() === "nein") own = false;
  else err(`Eigene_Produktion «${ownRaw}» muss Ja oder Nein sein.`);

  if (typeof price === "number" && price === 0) issues.push({ level: "warning", message: "Gebindepreis ist 0 CHF." });

  return {
    values: {
      name,
      category,
      supplier: text("Lieferant") || null,
      package_quantity: typeof qty === "number" ? qty : null,
      package_unit: pu,
      package_label: text("Gebindebezeichnung") || null,
      package_price: typeof price === "number" ? price : null,
      base_unit: bu,
      price_date,
      is_own_production: own,
      notes: text("Notiz") || null,
    },
    issues,
  };
}

/** Re-validate already typed values (after preview edits / on the server). */
export function validateValues(v: ParsedValues): RowIssue[] {
  const issues: RowIssue[] = [];
  const err = (m: string) => issues.push({ level: "error", message: m });
  if (!v.name.trim()) err("Zutatenname fehlt.");
  if (!v.category.trim()) err("Kategorie fehlt.");
  if (v.package_quantity === null || !Number.isFinite(v.package_quantity)) err("Gebindemenge fehlt.");
  else if (v.package_quantity <= 0) err("Gebindemenge muss grösser als 0 sein.");
  if (!v.package_unit) err("Gebindeeinheit fehlt.");
  if (v.package_price === null || !Number.isFinite(v.package_price)) err("Gebindepreis fehlt.");
  else if (v.package_price < 0) err("Gebindepreis darf nicht negativ sein.");
  if (!v.base_unit) err("Basiseinheit fehlt.");
  if (v.package_unit && v.base_unit && PACKAGE_TO_BASE[v.package_unit] !== v.base_unit) err("Gebindeeinheit passt nicht zur Basiseinheit.");
  if (v.price_date && !isValidIsoDate(v.price_date)) err("Preisstand ist kein gültiges Datum (JJJJ-MM-TT).");
  if (v.is_own_production === null) err("Eigene Produktion fehlt.");
  if (v.package_price === 0) issues.push({ level: "warning", message: "Gebindepreis ist 0 CHF." });
  return issues;
}

export function rowUnitPrice(v: ParsedValues): number | null {
  if (v.package_quantity === null || v.package_price === null || !v.package_unit || !v.base_unit) return null;
  return unitPrice({ package_quantity: v.package_quantity, package_unit: v.package_unit, package_price: v.package_price, base_unit: v.base_unit });
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

export type MatchCandidate = { id: string; name: string; score: number };
export type ExistingIngredientLite = { id: string; name: string; is_active: boolean };

export const LIKELY_THRESHOLD = 0.62;

export function matchIngredient(name: string, existing: ExistingIngredientLite[]): { level: MatchLevel; exactId: string | null; candidates: MatchCandidate[] } {
  const key = normaliseIngredientName(name);
  if (!key) return { level: "none", exactId: null, candidates: [] };
  const exact = existing.find((e) => normaliseIngredientName(e.name) === key);
  if (exact) return { level: "exact", exactId: exact.id, candidates: [{ id: exact.id, name: exact.name, score: 1 }] };
  const candidates = existing
    .map((e) => {
      const n = normaliseIngredientName(e.name);
      const contains = n.includes(key) || key.includes(n) ? 0.75 : 0;
      return { id: e.id, name: e.name, score: Math.max(similarity(name, e.name), contains) };
    })
    .filter((c) => c.score >= LIKELY_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  return { level: candidates.length ? "likely" : "none", exactId: null, candidates };
}

// ---------------------------------------------------------------------------
// Payload sent to the server after explicit confirmation
// ---------------------------------------------------------------------------

export const ImportRowPayloadSchema = z.object({
  row: z.number().int().positive(),
  action: z.enum(["create", "update", "skip"]),
  ingredient_id: z.string().uuid().nullable(),
  /** Explicit row-level approval to overwrite a confirmed price. */
  approved_confirmed_overwrite: z.boolean(),
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(80),
  supplier: z.string().trim().max(120).nullable(),
  package_quantity: z.number().positive(),
  package_unit: z.enum(["kg", "g", "l", "ml", "piece"]),
  package_label: z.string().trim().max(120).nullable(),
  package_price: z.number().min(0),
  base_unit: z.enum(["g", "ml", "piece"]),
  price_date: z.string().regex(ISO_DATE_RE).nullable(),
  is_own_production: z.boolean(),
  notes: z.string().trim().max(500).nullable(),
});
export type ImportRowPayload = z.infer<typeof ImportRowPayloadSchema>;

export const IngredientImportPayloadSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().min(0).max(MAX_XLSX_BYTES),
  rowCount: z.number().int().min(0).max(MAX_ROWS),
  rows: z.array(ImportRowPayloadSchema).max(MAX_ROWS),
});
export type IngredientImportPayload = z.infer<typeof IngredientImportPayloadSchema>;

/**
 * Cross-row checks shared by client and server. Returns blocking messages
 * keyed by row number.
 */
export function crossRowConflicts(rows: { row: number; action: RowAction; name: string; ingredient_id: string | null }[]): Map<number, string> {
  const out = new Map<number, string>();
  const newNames = new Map<string, number[]>();
  const targets = new Map<string, number[]>();
  for (const r of rows) {
    if (r.action === "create") {
      const k = normaliseIngredientName(r.name);
      newNames.set(k, [...(newNames.get(k) ?? []), r.row]);
    } else if (r.action === "update" && r.ingredient_id) {
      targets.set(r.ingredient_id, [...(targets.get(r.ingredient_id) ?? []), r.row]);
    }
  }
  for (const rs of newNames.values()) if (rs.length > 1) for (const r of rs) out.set(r, `Gleicher Zutatenname wird mehrfach neu angelegt (Zeilen ${rs.join(", ")}). Nur eine Zeile darf «Neu anlegen» sein.`);
  for (const rs of targets.values()) if (rs.length > 1) for (const r of rs) out.set(r, `Mehrere Zeilen aktualisieren dieselbe Zutat (Zeilen ${rs.join(", ")}). Bitte nur eine Aktualisierung behalten.`);
  return out;
}
