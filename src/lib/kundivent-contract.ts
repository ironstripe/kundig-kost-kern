/**
 * Shared, browser-safe definitions of the Kundivent handover contract v1.
 *
 * Only shapes, validation and German texts live here — never credentials and
 * never the target origin. The actual HTTP calls happen server-side.
 */
import { z } from "zod";

export const CONTRACT_VERSION = "v1";
export const SOURCE_SYSTEM_DEFAULT = "kundicalc";

// ---------------------------------------------------------------------------
// Receiver responses
// ---------------------------------------------------------------------------

export const MasterDataSchema = z.object({
  contract_version: z.string(),
  categories: z
    .array(z.object({ id: z.string(), name: z.string(), is_active: z.boolean().optional() }))
    .default([]),
  planning_areas: z
    .array(z.object({ id: z.string(), name: z.string(), is_active: z.boolean().optional() }))
    .default([]),
});
export type MasterData = z.infer<typeof MasterDataSchema>;

export const TargetEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  start_time: z.string().nullable().optional(),
  end_time: z.string().nullable().optional(),
  all_day: z.boolean().nullable().optional(),
  pax: z.number().nullable().optional(),
  planning_areas: z.array(z.object({ id: z.string(), name: z.string() })).nullable().optional(),
  category: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
  updated_at: z.string(),
  has_kundicalc_association: z.boolean().nullable().optional(),
});
export type TargetEvent = z.infer<typeof TargetEventSchema>;

export const TargetEventListSchema = z.object({
  contract_version: z.string(),
  events: z.array(TargetEventSchema).default([]),
  total: z.number().nullable().optional(),
  limit: z.number().nullable().optional(),
  offset: z.number().nullable().optional(),
});
export type TargetEventList = z.infer<typeof TargetEventListSchema>;

export const ReceiptSchema = z.object({
  contract_version: z.string(),
  handover_id: z.string(),
  source_event_id: z.string(),
  source_calculation_id: z.string().nullable().optional(),
  target_event_id: z.string(),
  target_url: z.string(),
  calculation_url: z.string().nullable().optional(),
  operation: z.enum(["create", "link"]),
  outcome: z.enum(["created", "linked", "already_processed"]),
  completed_at: z.string(),
  target_event_deleted: z.boolean().default(false),
});
export type Receipt = z.infer<typeof ReceiptSchema>;

// ---------------------------------------------------------------------------
// Client input for a handover attempt
// ---------------------------------------------------------------------------

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const CreateInputSchema = z
  .object({
    title: z.string().trim().min(2, "Titel ist zu kurz.").max(200),
    category_id: z.string().uuid("Bitte eine Kategorie wählen."),
    planning_area_ids: z.array(z.string().uuid()).min(1, "Mindestens ein Planungsbereich ist nötig."),
    start_date: z.string().regex(DATE, "Startdatum fehlt."),
    end_date: z.string().regex(DATE).nullable().optional(),
    all_day: z.boolean(),
    start_time: z.string().regex(TIME, "Ungültige Startzeit.").nullable().optional(),
    end_time: z.string().regex(TIME, "Ungültige Endzeit.").nullable().optional(),
    pax: z.number().int().min(0).max(100000).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.all_day && (!v.start_time || !v.end_time)) {
      ctx.addIssue({ code: "custom", message: "Ohne Ganztags-Angabe sind Start- und Endzeit nötig.", path: ["start_time"] });
    }
    if (v.end_date && v.end_date < v.start_date) {
      ctx.addIssue({ code: "custom", message: "Das Enddatum liegt vor dem Startdatum.", path: ["end_date"] });
    }
  });
export type CreateInput = z.infer<typeof CreateInputSchema>;

export const LinkInputSchema = z.object({
  target_event_id: z.string().min(1),
  expected_updated_at: z.string().min(1),
});
export type LinkInput = z.infer<typeof LinkInputSchema>;

// ---------------------------------------------------------------------------
// Error codes → safe German messages (plain text, never HTML)
// ---------------------------------------------------------------------------

export const NOT_CONFIGURED = "Kundivent-Übergabe noch nicht eingerichtet.";

export const CONTRACT_ERROR_MESSAGES: Record<string, string> = {
  integration_not_configured: NOT_CONFIGURED,
  invalid_credentials: "Die Zugangsdaten für Kundivent werden nicht akzeptiert. Bitte durch die Administration prüfen lassen.",
  unmapped_source_user:
    "Für Ihr KundiCalc-Konto besteht in Kundivent keine Zuordnung. Die Administration hinterlegt sie in Kundivent unter Einstellungen → KundiCalc-Übergabe.",
  inactive_user: "Das zugeordnete Kundivent-Konto ist deaktiviert. Bitte die Administration von Kundivent kontaktieren.",
  insufficient_permissions:
    "Das zugeordnete Kundivent-Konto darf keine Einträge erstellen oder bestätigen. Die Administration von Kundivent kann die Rolle anpassen.",
  invalid_payload: "Kundivent hat die übermittelten Angaben abgelehnt. Bitte die Eingaben prüfen.",
  invalid_category: "Die gewählte Kategorie ist in Kundivent nicht mehr aktiv. Bitte neu wählen.",
  invalid_planning_area: "Ein gewählter Planungsbereich ist in Kundivent nicht mehr aktiv. Bitte neu wählen.",
  invalid_responsible_user: "Die gewählte verantwortliche Person ist in Kundivent nicht gültig.",
  target_not_found: "Der gewählte Kundivent-Eintrag existiert nicht mehr.",
  target_changed: "Der Kundivent-Eintrag hat sich seit der Prüfung verändert. Bitte erneut prüfen und bestätigen.",
  cancelled_target: "Abgesagte Kundivent-Einträge werden nicht bestätigt.",
  association_conflict: "Für dieses Event oder diesen Kundivent-Eintrag besteht bereits eine Verknüpfung.",
  idempotency_conflict: "Dieser Übergabeversuch wurde mit anderen Angaben bereits verwendet. Bitte neu vorbereiten.",
  transaction_failed: "Kundivent konnte die Übergabe nicht abschliessen. Es wurde nichts gespeichert.",
  not_found: "Zu diesem Event liegt in Kundivent keine Übergabe-Bestätigung vor.",
};

export const GENERIC_ERROR = "Die Übergabe an Kundivent ist fehlgeschlagen. Bitte später erneut versuchen.";

export function contractMessage(code: string | null | undefined): string {
  if (!code) return GENERIC_ERROR;
  return CONTRACT_ERROR_MESSAGES[code] ?? GENERIC_ERROR;
}

export const attemptStateLabels: Record<string, string> = {
  ready: "Vorbereitet",
  sending: "Wird übermittelt",
  unknown: "Ergebnis unklar",
  failed: "Fehlgeschlagen",
  succeeded: "An Kundivent übergeben",
};
