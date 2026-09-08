import type { Database } from "@/integrations/supabase/types";

type Enums = Database["public"]["Enums"];

export const smallMaterialModeLabels: Record<Enums["small_material_mode"], string> = {
  percent: "Prozent vom Warenkosten (Zutaten)",
  fixed: "Fixbetrag pro Portion",
};

export const importStatusLabels: Record<Enums["import_status"], string> = {
  draft: "Entwurf",
  processing: "In Verarbeitung",
  review: "Zur Prüfung",
  confirmed: "Bestätigt",
  failed: "Fehlgeschlagen",
};

export const calculationStatusLabels: Record<Enums["calculation_status"], string> = {
  estimated: "Geschätzt",
  partially_reviewed: "Teilweise geprüft",
  reviewed: "Geprüft",
};

export const priceStatusLabels: Record<Enums["price_status"], string> = {
  estimated: "Geschätzt",
  confirmed: "Bestätigt",
};

export const packageUnitLabels: Record<Enums["package_unit"], string> = {
  kg: "kg",
  g: "g",
  l: "l",
  ml: "ml",
  piece: "Stück",
};

export const baseUnitLabels: Record<Enums["base_unit"], string> = {
  g: "g",
  ml: "ml",
  piece: "Stück",
};

export const ingredientSourceLabels: Record<Enums["ingredient_source_type"], string> = {
  ai_estimate: "KI-Schätzung",
  manual: "Manuell",
  excel_import: "Excel-Import",
};

export const quantitySourceLabels: Record<Enums["quantity_source"], string> = {
  ai_estimate: "KI-Schätzung",
  manual: "Manuell",
};

/** Component groups of calculation items (stored as text keys). */
export const COMPONENT_GROUPS = [
  { value: "main", label: "Hauptprodukt" },
  { value: "sauce", label: "Sauce" },
  { value: "side", label: "Beilage" },
  { value: "vegetables", label: "Gemüse / Salat" },
  { value: "garnish", label: "Garnitur" },
  { value: "preparation", label: "Zubereitung" },
  { value: "other", label: "Sonstiges" },
] as const;

export type ComponentGroup = (typeof COMPONENT_GROUPS)[number]["value"];

export const componentGroupLabels: Record<string, string> = Object.fromEntries(
  COMPONENT_GROUPS.map((g) => [g.value, g.label]),
);

export const componentGroupOrder: Record<string, number> = Object.fromEntries(
  COMPONENT_GROUPS.map((g, i) => [g.value, i]),
);

/** Short explanations shown next to the key figures. */
export const metricExplanations = {
  foodCost:
    "Wareneinsatz = Warenkosten der Zutaten (Bruttoeinsatzmenge × EK je Basiseinheit) plus Kleinmaterial.",
  contributionMargin:
    "DB I = Netto-Verkaufspreis (Brutto ohne 8.1 % MWST) minus Wareneinsatz. Kein Gewinn – Personal- und Betriebskosten sind nicht abgezogen.",
  margin: "DB-I-Marge = DB I im Verhältnis zum Netto-Verkaufspreis. Eine höhere Marge kann trotzdem weniger CHF bedeuten.",
} as const;
