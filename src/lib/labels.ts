import type { Database } from "@/integrations/supabase/types";

type Enums = Database["public"]["Enums"];

export const smallMaterialModeLabels: Record<Enums["small_material_mode"], string> = {
  percent: "Prozent vom Nettoumsatz",
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
