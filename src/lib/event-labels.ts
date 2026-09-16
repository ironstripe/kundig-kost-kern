import type { Database } from "@/integrations/supabase/types";

type Enums = Database["public"]["Enums"];

export const menuStatusLabels: Record<Enums["menu_status"], string> = {
  draft: "Entwurf",
  partially_reviewed: "Teilweise geprüft",
  reviewed: "Geprüft",
  archived: "Archiviert",
};

export const eventStatusLabels: Record<Enums["event_status"], string> = {
  draft: "Entwurf",
  precalculated: "Vorkalkulation",
  released: "Freigegeben",
  executed: "Durchgeführt",
  postcalculated: "Nachkalkuliert",
  archived: "Archiviert",
};

export const eventTypeLabels: Record<Enums["event_type"], string> = {
  beer_dine: "Beer & Dine",
  banquet: "Bankett",
  lounge: "Lounge / Fingerfood",
  other: "Sonstiger Event",
};

export const eventLineKindLabels: Record<Enums["event_line_kind"], string> = {
  revenue: "Erlös",
  variable_cost: "Variable Kosten",
  personnel_cost: "Direktes Personal",
  fixed_cost: "Direkte Fixkosten",
  informational: "Informativ",
};

export const valueStatusLabels: Record<Enums["event_value_status"], string> = {
  open: "Offen",
  assumption: "Annahme",
  confirmed: "Bestätigt",
  effective: "Effektiv",
};

export const calcModeLabels: Record<Enums["event_line_calc_mode"], string> = {
  fixed: "Fix",
  per_guest: "Pro Gast",
};

export const assumptionUnitLabels: Record<Enums["assumption_unit"], string> = {
  chf_per_hour: "CHF pro Stunde",
  chf_per_guest: "CHF pro Gast",
  chf_fixed: "CHF fix",
  percent: "Prozent",
};

export const assumptionOriginLabels: Record<Enums["assumption_origin"], string> = {
  global_default: "Globaler Standard",
  manual_override: "Manuell überschrieben",
};

/** Menu course sections. */
export const MENU_COURSES = [
  { value: "apero", label: "Apéro" },
  { value: "starter", label: "Vorspeise" },
  { value: "soup", label: "Suppe" },
  { value: "main", label: "Hauptgang" },
  { value: "dessert", label: "Dessert" },
  { value: "extra", label: "Zusatz" },
] as const;

export const courseLabels: Record<string, string> = Object.fromEntries(
  MENU_COURSES.map((c) => [c.value, c.label]),
);

export const courseOrder: Record<string, number> = Object.fromEntries(
  MENU_COURSES.map((c, i) => [c.value, i]),
);

/** Event line categories grouped by kind. */
export const EVENT_LINE_CATEGORIES: { value: string; label: string; kind: Enums["event_line_kind"] }[] = [
  { value: "ticket_revenue", label: "Ticketerlös", kind: "revenue" },
  { value: "additional_revenue", label: "Zusatzerlös", kind: "revenue" },
  { value: "partner_contribution", label: "Partnerbeitrag", kind: "revenue" },
  { value: "other_revenue", label: "Sonstiger Erlös", kind: "revenue" },

  { value: "menu_food_cost", label: "Wareneinsatz Menü", kind: "variable_cost" },
  { value: "beverages", label: "Getränke", kind: "variable_cost" },
  { value: "partner_per_guest", label: "Partneranteil pro Gast", kind: "variable_cost" },
  { value: "payment_fees", label: "Ticket- / Zahlungsgebühren", kind: "variable_cost" },
  { value: "other_variable", label: "Sonstige variable Kosten", kind: "variable_cost" },

  { value: "personnel_kitchen", label: "Küche", kind: "personnel_cost" },
  { value: "personnel_service", label: "Service", kind: "personnel_cost" },
  { value: "personnel_organisation", label: "Eventorganisation", kind: "personnel_cost" },
  { value: "personnel_logistics", label: "Logistik", kind: "personnel_cost" },
  { value: "personnel_other", label: "Weiteres Personal", kind: "personnel_cost" },

  { value: "marketing", label: "Marketing", kind: "fixed_cost" },
  { value: "printing", label: "Drucksachen", kind: "fixed_cost" },
  { value: "entertainment", label: "Unterhaltung", kind: "fixed_cost" },
  { value: "technology", label: "Technik", kind: "fixed_cost" },
  { value: "room", label: "Raum / Infrastruktur", kind: "fixed_cost" },
  { value: "transport", label: "Transport", kind: "fixed_cost" },
  { value: "other_fixed", label: "Sonstige Eventkosten", kind: "fixed_cost" },

  { value: "voucher_nominal", label: "Gutschein-Nominalwert", kind: "informational" },
  { value: "partner_in_kind", label: "Sachleistung Partner", kind: "informational" },
  { value: "other_informational", label: "Weiterer informativer Wert", kind: "informational" },
];

export const eventCategoryLabels: Record<string, string> = Object.fromEntries(
  EVENT_LINE_CATEGORIES.map((c) => [c.value, c.label]),
);

export const eventSectionOrder: Enums["event_line_kind"][] = [
  "revenue",
  "variable_cost",
  "personnel_cost",
  "fixed_cost",
  "informational",
];

export const eventSectionTitles: Record<Enums["event_line_kind"], string> = {
  revenue: "Erlöse",
  variable_cost: "Menü und variable Kosten",
  personnel_cost: "Personal",
  fixed_cost: "Partner und direkte Fixkosten",
  informational: "Informative Werte (ohne Wirkung auf DB I / DB II)",
};
