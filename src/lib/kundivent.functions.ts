/**
 * Authenticated server functions for the Kundivent handover.
 *
 * Everything the receiver sees originates here: the session is validated, the
 * KundiCalc user must be active, the source event and its execution approval
 * are re-checked against the current calculation, and the actor id is derived
 * from the session — never from the browser.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  CONTRACT_VERSION,
  CreateInputSchema,
  LinkInputSchema,
  type MasterData,
  type Receipt,
  type TargetEvent,
  type TargetEventList,
} from "@/lib/kundivent-contract";

export type HandoverAttempt = {
  id: string;
  event_id: string;
  operation: "create" | "link";
  state: "ready" | "sending" | "unknown" | "failed" | "succeeded";
  target_event_id: string | null;
  idempotency_key: string;
  error_code: string | null;
  error_message: string | null;
  handover_id: string | null;
  target_url: string | null;
  target_event_deleted: boolean;
  initiated_by: string | null;
  completed_at: string | null;
  created_at: string;
  attempt_count: number;
};

/** Row shape including the immutable payload; never leaves the server. */
type HandoverAttemptRow = HandoverAttempt & { payload: Record<string, unknown> };

function strip(row: HandoverAttemptRow): HandoverAttempt {
  const { payload: _payload, ...rest } = row;
  return rest;
}

export type HandoverContext = {
  configured: boolean;
  actorId: string;
  /** Server-side verdict whether a new handover may be prepared. */
  canPrepare: boolean;
  /** German plain-text reason when canPrepare is false. */
  reason: string | null;
  approvalRef: string | null;
  approvedAt: string | null;
  attempt: HandoverAttempt | null;
  prefill: {
    title: string;
    start_date: string | null;
    pax: number | null;
    notes: string | null;
  } | null;
};

type Ctx = { supabase: any; userId: string };

async function assertActive(context: Ctx) {
  const { data, error } = await context.supabase
    .from("profiles")
    .select("is_active")
    .eq("id", context.userId)
    .maybeSingle();
  if (error || !data || !data.is_active) throw new Error("Ihr Konto ist deaktiviert.");
}

/** Re-reads event, approval and calculation state. Throws for inaccessible events. */
async function loadSourceState(context: Ctx, eventId: string) {
  const { data: event, error } = await context.supabase.from("events").select("*").eq("id", eventId).maybeSingle();
  if (error) throw new Error("Das Event konnte nicht geladen werden.");
  if (!event) throw new Error("Event nicht gefunden.");

  const [{ data: approvals }, { data: fingerprint }, { data: lines }] = await Promise.all([
    context.supabase
      .from("event_execution_approvals")
      .select("*")
      .eq("event_id", eventId)
      .is("superseded_at", null)
      .order("approved_at", { ascending: false })
      .limit(1),
    context.supabase.rpc("event_basis_fingerprint", { _event_id: eventId }),
    context.supabase.from("event_lines").select("kind, is_required, planned_unit_amount, planned_quantity").eq("event_id", eventId),
  ]);

  const approval = (approvals ?? [])[0] ?? null;
  const relevant = (lines ?? []).filter((l: any) => l.kind !== "informational");
  const open = relevant.filter(
    (l: any) => l.is_required && (l.planned_unit_amount === null || l.planned_quantity === null),
  );

  let reason: string | null = null;
  if (!approval) reason = "Für dieses Event liegt keine gültige Freigabe der Durchführung vor.";
  else if (relevant.length === 0 || open.length > 0) reason = "Die Kalkulation enthält offene Pflichtwerte.";
  else if (approval.basis_fingerprint !== fingerprint)
    reason = "Die Kalkulation hat sich seit der Freigabe verändert. Es ist eine erneute Freigabe nötig.";

  return { event, approval, fingerprint: (fingerprint as string) ?? "", reason };
}

async function loadAttempt(context: Ctx, eventId: string): Promise<HandoverAttempt | null> {
  const { data } = await context.supabase
    .from("event_handover_attempts")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(1);
  const row = (data ?? [])[0] as HandoverAttemptRow | undefined;
  return row ? strip(row) : null;
}

// ---------------------------------------------------------------------------
// Context / status
// ---------------------------------------------------------------------------

export const getHandoverContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { eventId: string }) => z.object({ eventId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<HandoverContext> => {
    await assertActive(context as Ctx);
    const { readConfig } = await import("@/lib/kundivent.server");
    const configured = readConfig() !== null;
    const state = await loadSourceState(context as Ctx, data.eventId);
    const attempt = await loadAttempt(context as Ctx, data.eventId);

    let reason = state.reason;
    if (!reason && attempt && attempt.state === "succeeded") reason = "Dieses Event wurde bereits an Kundivent übergeben.";
    if (!reason && attempt && ["ready", "sending", "unknown"].includes(attempt.state))
      reason = "Für dieses Event läuft bereits ein Übergabeversuch.";

    return {
      configured,
      actorId: context.userId,
      canPrepare: configured && reason === null,
      reason,
      approvalRef: state.approval?.id ?? null,
      approvedAt: state.approval?.approved_at ?? null,
      attempt,
      prefill: {
        title: state.event.name,
        start_date: state.event.event_date,
        pax:
          state.event.planned_paying_guests === null && state.event.planned_free_guests === null
            ? null
            : (state.event.planned_paying_guests ?? 0) + (state.event.planned_free_guests ?? 0),
        notes: state.event.notes,
      },
    };
  });

// ---------------------------------------------------------------------------
// Receiver reads
// ---------------------------------------------------------------------------

export const loadMasterData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MasterData> => {
    await assertActive(context as Ctx);
    const { requireConfig, getMasterData } = await import("@/lib/kundivent.server");
    return getMasterData(requireConfig(), context.userId);
  });

export const searchTargetEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { q?: string; from?: string; to?: string; status?: string; offset?: number }) =>
    z
      .object({
        q: z.string().trim().max(120).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        status: z.string().optional(),
        offset: z.number().int().min(0).max(5000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<TargetEventList> => {
    await assertActive(context as Ctx);
    const { requireConfig, searchEvents } = await import("@/lib/kundivent.server");
    return searchEvents(requireConfig(), context.userId, {
      ...(data.q ? { q: data.q } : {}),
      ...(data.from ? { from: data.from } : {}),
      ...(data.to ? { to: data.to } : {}),
      ...(data.status ? { status: data.status } : {}),
      limit: 20,
      offset: data.offset ?? 0,
    });
  });

export const loadTargetEvent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { targetEventId: string }) => z.object({ targetEventId: z.string().min(1).max(128) }).parse(d))
  .handler(async ({ data, context }): Promise<TargetEvent> => {
    await assertActive(context as Ctx);
    const { requireConfig, getEvent } = await import("@/lib/kundivent.server");
    return getEvent(requireConfig(), context.userId, data.targetEventId);
  });

// ---------------------------------------------------------------------------
// Prepare an immutable attempt
// ---------------------------------------------------------------------------

const PrepareSchema = z.object({
  eventId: z.string().uuid(),
  operation: z.enum(["create", "link"]),
  create: CreateInputSchema.optional(),
  link: LinkInputSchema.optional(),
});

export const prepareHandover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PrepareSchema.parse(d))
  .handler(async ({ data, context }): Promise<HandoverAttempt> => {
    await assertActive(context as Ctx);
    const { requireConfig } = await import("@/lib/kundivent.server");
    const cfg = requireConfig();
    const state = await loadSourceState(context as Ctx, data.eventId);
    if (state.reason) throw new Error(state.reason);
    const approval = state.approval!;

    const existing = await loadAttempt(context as Ctx, data.eventId);
    if (existing && existing.state === "succeeded") throw new Error("Dieses Event wurde bereits an Kundivent übergeben.");
    if (existing && ["ready", "sending", "unknown"].includes(existing.state))
      throw new Error("Für dieses Event läuft bereits ein Übergabeversuch.");

    const payload: Record<string, unknown> = {
      contract_version: CONTRACT_VERSION,
      source_system: cfg.sourceSystem,
      source_event_id: state.event.id,
      source_calculation_id: state.event.source_key,
      source_actor_id: context.userId,
      execution_approval_ref: approval.id,
      execution_approved_at: approval.approved_at,
      idempotency_key: crypto.randomUUID(),
      operation: data.operation,
    };

    if (data.operation === "create") {
      if (!data.create) throw new Error("Die Angaben für den neuen Eintrag fehlen.");
      const c = data.create;
      payload["event"] = {
        title: c.title,
        category_id: c.category_id,
        planning_area_ids: c.planning_area_ids,
        start_date: c.start_date,
        all_day: c.all_day,
        ...(c.end_date ? { end_date: c.end_date } : {}),
        ...(!c.all_day && c.start_time ? { start_time: c.start_time } : {}),
        ...(!c.all_day && c.end_time ? { end_time: c.end_time } : {}),
        ...(c.pax === null || c.pax === undefined ? {} : { pax: c.pax }),
        ...(c.notes ? { notes: c.notes } : {}),
      };
    } else {
      if (!data.link) throw new Error("Der Kundivent-Eintrag fehlt.");
      payload["target_event_id"] = data.link.target_event_id;
      payload["expected_updated_at"] = data.link.expected_updated_at;
      payload["confirm_status_change"] = true;
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("event_handover_attempts")
      .insert({
        event_id: state.event.id,
        approval_id: approval.id,
        approval_fingerprint: state.fingerprint,
        approved_at: approval.approved_at,
        initiated_by: context.userId,
        operation: data.operation,
        target_event_id: data.operation === "link" ? data.link!.target_event_id : null,
        idempotency_key: payload["idempotency_key"] as string,
        payload: payload as never,
        state: "ready",
      })
      .select("*")
      .single();
    if (error) throw new Error("Der Übergabeversuch konnte nicht vorbereitet werden.");
    return strip(row as unknown as HandoverAttemptRow);
  });

// ---------------------------------------------------------------------------
// Send / retry / recover
// ---------------------------------------------------------------------------

async function persistReceipt(attemptId: string, receipt: Receipt, trustedUrl: boolean) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin
    .from("event_handover_attempts")
    .update({
      state: "succeeded",
      receipt: receipt as never,
      handover_id: receipt.handover_id,
      target_event_id: receipt.target_event_id,
      target_url: trustedUrl ? receipt.target_url : null,
      target_event_deleted: receipt.target_event_deleted,
      completed_at: receipt.completed_at,
      error_code: null,
      error_message: null,
    })
    .eq("id", attemptId)
    .select("*")
    .single();
  return strip(row as unknown as HandoverAttemptRow);
}

async function markEventHandedOver(eventId: string, receipt: Receipt, targetUrl: string | null) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("events")
    .update({ handover_state: "handed_over", handover_ref: receipt.target_event_id, handover_url: targetUrl })
    .eq("id", eventId);
}

/** Validates the acknowledgement against the attempt before anything is stored. */
function validateReceipt(receipt: Receipt, attempt: HandoverAttempt, trusted: boolean): string | null {
  if (receipt.contract_version !== CONTRACT_VERSION) return "Kundivent hat eine unbekannte Vertragsversion geantwortet.";
  if (receipt.source_event_id !== attempt.event_id) return "Die Antwort von Kundivent gehört zu einem anderen Event.";
  if (!receipt.target_event_id) return "Die Antwort von Kundivent enthält keinen Ziel-Eintrag.";
  if (!trusted) return "Die zurückgemeldete Kundivent-Adresse stammt nicht vom eingerichteten Kundivent-System.";
  return null;
}

export const sendHandover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { attemptId: string }) => z.object({ attemptId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<HandoverAttempt> => {
    await assertActive(context as Ctx);
    const { requireConfig, postHandover, isTrustedTargetUrl, KundiventError } = await import("@/lib/kundivent.server");
    const cfg = requireConfig();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Claim the attempt: only a 'ready' or 'failed-retryable' row can move to 'sending'.
    const { data: claimed } = await supabaseAdmin
      .from("event_handover_attempts")
      .update({ state: "sending", sent_at: new Date().toISOString() })
      .eq("id", data.attemptId)
      .in("state", ["ready"])
      .select("*")
      .maybeSingle();
    if (!claimed) throw new Error("Dieser Übergabeversuch ist nicht mehr bereit zum Senden.");
    const attempt = claimed as unknown as HandoverAttemptRow;

    // The actor identity of the original attempt is preserved.
    if (attempt.initiated_by && attempt.initiated_by !== context.userId) {
      await supabaseAdmin.from("event_handover_attempts").update({ state: "ready" }).eq("id", attempt.id);
      throw new Error("Dieser Übergabeversuch wurde von einer anderen Person vorbereitet und kann nur von ihr gesendet werden.");
    }

    await supabaseAdmin
      .from("event_handover_attempts")
      .update({ attempt_count: (attempt.attempt_count ?? 0) + 1 })
      .eq("id", attempt.id);

    try {
      const receipt = await postHandover(cfg, attempt.initiated_by ?? context.userId, attempt.payload);
      const trusted = isTrustedTargetUrl(receipt.target_url, cfg);
      const problem = validateReceipt(receipt, attempt, trusted);
      if (problem) {
        const { data: row } = await supabaseAdmin
          .from("event_handover_attempts")
          .update({ state: "unknown", error_code: "unexpected", error_message: problem })
          .eq("id", attempt.id)
          .select("*")
          .single();
        return strip(row as unknown as HandoverAttemptRow);
      }
      const saved = await persistReceipt(attempt.id, receipt, trusted);
      await markEventHandedOver(attempt.event_id, receipt, receipt.target_url);
      return saved;
    } catch (error) {
      const code = error instanceof KundiventError ? error.code : "unexpected";
      const uncertain = code === "timeout" || code === "network_error" || code === "transaction_failed";
      const { data: row } = await supabaseAdmin
        .from("event_handover_attempts")
        .update({ state: uncertain ? "unknown" : "failed", error_code: code, error_message: null })
        .eq("id", attempt.id)
        .select("*")
        .single();
      return strip(row as unknown as HandoverAttemptRow);
    }
  });

/** Recovery for 'unknown': ask the receiver for the receipt, otherwise allow a controlled retry. */
export const resolveHandover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { attemptId: string }) => z.object({ attemptId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<HandoverAttempt> => {
    await assertActive(context as Ctx);
    const { requireConfig, getReceipt, isTrustedTargetUrl, KundiventError } = await import("@/lib/kundivent.server");
    const cfg = requireConfig();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: found } = await supabaseAdmin
      .from("event_handover_attempts")
      .select("*")
      .eq("id", data.attemptId)
      .maybeSingle();
    if (!found) throw new Error("Übergabeversuch nicht gefunden.");
    const attempt = found as unknown as HandoverAttemptRow;
    if (attempt.state === "succeeded") return strip(attempt);

    try {
      const receipt = await getReceipt(cfg, attempt.initiated_by ?? context.userId, attempt.event_id);
      if (!receipt) {
        // No receipt yet: the original request may still be processing. Keep the
        // same payload and key; the user may retry deliberately.
        const { data: row } = await supabaseAdmin
          .from("event_handover_attempts")
          .update({ state: "ready", error_code: null, error_message: null })
          .eq("id", attempt.id)
          .select("*")
          .single();
        return strip(row as unknown as HandoverAttemptRow);
      }
      const trusted = isTrustedTargetUrl(receipt.target_url, cfg);
      const problem = validateReceipt(receipt, attempt, trusted);
      if (problem) throw new Error(problem);
      const saved = await persistReceipt(attempt.id, receipt, trusted);
      await markEventHandedOver(attempt.event_id, receipt, receipt.target_url);
      return saved;
    } catch (error) {
      if (error instanceof KundiventError) {
        const { data: row } = await supabaseAdmin
          .from("event_handover_attempts")
          .update({ state: "unknown", error_code: error.code })
          .eq("id", attempt.id)
          .select("*")
          .single();
        return strip(row as unknown as HandoverAttemptRow);
      }
      throw error;
    }
  });

/** Discards a definitively failed attempt so the user can correct and prepare a new one. */
export const discardHandoverAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { attemptId: string }) => z.object({ attemptId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertActive(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("event_handover_attempts")
      .select("state")
      .eq("id", data.attemptId)
      .maybeSingle();
    if (!row) throw new Error("Übergabeversuch nicht gefunden.");
    if (!["ready", "failed"].includes(row.state as string))
      throw new Error("Nur vorbereitete oder endgültig fehlgeschlagene Versuche können verworfen werden.");
    await supabaseAdmin.from("event_handover_attempts").delete().eq("id", data.attemptId);
    return { ok: true };
  });
