/**
 * Client-side preview state for the Excel ingredient import. Lives only in
 * memory until the user confirms; nothing here touches the database.
 */
import type { Ingredient } from "@/lib/ingredients";
import {
  crossRowConflicts,
  matchIngredient,
  parseRow,
  validateValues,
  type ImportRowPayload,
  type MatchCandidate,
  type MatchLevel,
  type ParsedValues,
  type RawRow,
  type RowAction,
  type RowIssue,
} from "@/lib/ingredient-import-schema";

export type PreviewRow = {
  row: number;
  values: ParsedValues;
  issues: RowIssue[];
  matchLevel: MatchLevel;
  candidates: MatchCandidate[];
  /** Selected existing ingredient for «Aktualisieren». */
  matchId: string | null;
  action: RowAction;
  /** Explicit per-row approval to overwrite a confirmed price. */
  approved: boolean;
  edited: boolean;
};

export type RowStatus = "valid" | "warning" | "error";
export const rowStatusLabels: Record<RowStatus, string> = { valid: "Gültig", warning: "Warnung", error: "Fehler" };

export function buildPreview(raw: RawRow[], existing: Ingredient[]): PreviewRow[] {
  return raw.map((r) => {
    const { values, issues } = parseRow(r);
    return withMatch({ row: r.row, values, issues, matchLevel: "none", candidates: [], matchId: null, action: "create", approved: false, edited: false }, existing, true);
  });
}

/** Recompute matching for a row (after name edits). Optionally reset defaults. */
export function withMatch(row: PreviewRow, existing: Ingredient[], resetDefaults: boolean): PreviewRow {
  const m = matchIngredient(row.values.name, existing);
  const next: PreviewRow = { ...row, matchLevel: m.level, candidates: m.candidates };
  if (resetDefaults) {
    if (m.level === "exact") { next.matchId = m.exactId; next.action = "update"; }
    else if (m.level === "likely") { next.matchId = null; next.action = "skip"; }
    else { next.matchId = null; next.action = "create"; }
    next.approved = false;
  } else if (next.matchId && !m.candidates.some((c) => c.id === next.matchId) && m.level !== "exact") {
    // keep manual selections; nothing to do
  }
  return next;
}

export function revalidate(row: PreviewRow): PreviewRow {
  return { ...row, issues: validateValues(row.values) };
}

export type RowEvaluation = {
  status: RowStatus;
  blocking: string[];
  warnings: string[];
  target: Ingredient | null;
  priceDiff: { oldUnit: number | null; newUnit: number | null; chf: number | null; pct: number | null } | null;
  confirmedOverwrite: boolean;
};

export function evaluateRows(rows: PreviewRow[], existing: Ingredient[], unitPriceOf: (v: ParsedValues) => number | null, existingUnitPrice: (i: Ingredient) => number | null): Map<number, RowEvaluation> {
  const byId = new Map(existing.map((i) => [i.id, i]));
  const conflicts = crossRowConflicts(rows.map((r) => ({ row: r.row, action: r.action, name: r.values.name, ingredient_id: r.matchId })));
  const out = new Map<number, RowEvaluation>();
  for (const r of rows) {
    const blocking = r.issues.filter((i) => i.level === "error").map((i) => i.message);
    const warnings = r.issues.filter((i) => i.level === "warning").map((i) => i.message);
    const target = r.matchId ? byId.get(r.matchId) ?? null : null;
    let priceDiff: RowEvaluation["priceDiff"] = null;
    let confirmedOverwrite = false;
    if (r.action === "skip") {
      out.set(r.row, { status: blocking.length ? "warning" : warnings.length || r.matchLevel === "likely" ? "warning" : "valid", blocking: [], warnings: blocking.length ? ["Zeile wird übersprungen (enthält Fehler)."] : r.matchLevel === "likely" && !r.matchId ? ["Wahrscheinliche Übereinstimmung – bitte Zutat zuordnen oder bewusst überspringen."] : warnings, target, priceDiff, confirmedOverwrite });
      continue;
    }
    if (conflicts.has(r.row)) blocking.push(conflicts.get(r.row)!);
    if (r.action === "update") {
      if (!target) blocking.push("Bitte eine bestehende Zutat für die Aktualisierung wählen.");
      else {
        if (!target.is_active) warnings.push("Die bestehende Zutat ist inaktiv und wird aktualisiert, aber nicht reaktiviert.");
        const oldUnit = existingUnitPrice(target);
        const newUnit = unitPriceOf(r.values);
        const chf = oldUnit !== null && newUnit !== null ? newUnit - oldUnit : null;
        const pct = oldUnit && newUnit !== null && oldUnit > 0 ? (newUnit - oldUnit) / oldUnit : null;
        priceDiff = { oldUnit, newUnit, chf, pct };
        if (target.price_status !== "confirmed" && r.matchLevel === "exact") warnings.push("Vorgeschlagene Aktualisierung (exakter Treffer) – bitte prüfen und bewusst bestätigen.");
        if (target.price_status === "confirmed") {
          confirmedOverwrite = true;
          if (!r.approved) blocking.push("Bestätigter Preis – Aktualisierung muss in dieser Zeile ausdrücklich freigegeben werden.");
          else warnings.push("Bestätigter Preis wird nach Freigabe überschrieben.");
        }
        if (pct !== null && Math.abs(pct) >= 0.25) warnings.push(`Preisänderung von ${(pct * 100).toFixed(0).replace("-", "−")} % – bitte plausibilisieren.`);
      }
    }
    if (r.action === "create" && r.matchLevel === "exact") blocking.push("Exakte Übereinstimmung vorhanden – bitte aktualisieren oder überspringen statt neu anlegen.");
    if (r.action === "create" && r.matchLevel === "likely") warnings.push("Ähnliche Zutat vorhanden – wird trotzdem neu angelegt.");
    if (r.action === "create" && !existing.some((i) => i.category === r.values.category)) warnings.push(`Neue Kategorie «${r.values.category}».`);
    const status: RowStatus = blocking.length ? "error" : warnings.length ? "warning" : "valid";
    out.set(r.row, { status, blocking, warnings, target, priceDiff, confirmedOverwrite });
  }
  return out;
}

/** Skipped rows are ignored server-side but must still pass the payload schema. */
export function toPayloadRows(rows: PreviewRow[]): ImportRowPayload[] {
  return rows.map((r) => {
    const skip = r.action === "skip";
    const qty = r.values.package_quantity;
    const price = r.values.package_price;
    return {
      row: r.row,
      action: r.action,
      ingredient_id: r.action === "update" ? r.matchId : null,
      approved_confirmed_overwrite: r.approved,
      name: (r.values.name || (skip ? "(leer)" : "")).slice(0, 120),
      category: (r.values.category || (skip ? "(leer)" : "")).slice(0, 80),
      supplier: r.values.supplier,
      package_quantity: qty !== null && qty > 0 ? qty : skip ? 1 : 0,
      package_unit: r.values.package_unit ?? "kg",
      package_label: r.values.package_label,
      package_price: price !== null && price >= 0 ? price : 0,
      base_unit: r.values.base_unit ?? (r.values.package_unit === "l" || r.values.package_unit === "ml" ? "ml" : r.values.package_unit === "piece" ? "piece" : "g"),
      price_date: r.values.price_date,
      is_own_production: r.values.is_own_production ?? false,
      notes: r.values.notes,
    };
  });
}
