/**
 * Global calculation assumptions (admin managed) and the per-event copies.
 *
 * Food Catch principle: a global assumption is only a default. When an event
 * is created the current default is copied into the event; later changes to
 * the global default never rewrite existing events.
 */
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
export type EventAssumption = Tables["event_assumptions"]["Row"];
export type EventAssumptionInsert = Tables["event_assumptions"]["Insert"];
export type EventAssumptionUpdate = Tables["event_assumptions"]["Update"];
export type EventType = Database["public"]["Enums"]["event_type"];

export async function fetchEventAssumptions(): Promise<EventAssumption[]> {
  const { data, error } = await supabase.from("event_assumptions").select("*").order("label");
  if (error) throw error;
  return data ?? [];
}

export const eventAssumptionsQuery = queryOptions({
  queryKey: ["event_assumptions"],
  queryFn: fetchEventAssumptions,
});

export async function createEventAssumption(values: EventAssumptionInsert, userId: string) {
  const { error } = await supabase.from("event_assumptions").insert({ ...values, updated_by: userId });
  if (error) throw error;
}

export async function updateEventAssumption(id: string, patch: EventAssumptionUpdate, userId: string) {
  const { error } = await supabase.from("event_assumptions").update({ ...patch, updated_by: userId }).eq("id", id);
  if (error) throw error;
}

export async function deleteEventAssumption(id: string) {
  const { error } = await supabase.from("event_assumptions").delete().eq("id", id);
  if (error) throw error;
}

/** Active defaults for an event type: a type-specific row wins over «Alle». */
export function defaultsForType(assumptions: EventAssumption[], type: EventType): EventAssumption[] {
  const byKey = new Map<string, EventAssumption>();
  for (const a of assumptions.filter((x) => x.is_active)) {
    const current = byKey.get(a.key);
    if (!current || (a.event_type === type && current.event_type === null)) byKey.set(a.key, a);
  }
  return Array.from(byKey.values()).filter((a) => a.event_type === null || a.event_type === type);
}

/** Copies the current defaults into a newly created event. */
export async function copyDefaultsToEvent(eventId: string, assumptions: EventAssumption[], type: EventType) {
  const rows = defaultsForType(assumptions, type).map((a) => ({
    event_id: eventId,
    key: a.key,
    label: a.label,
    value: a.value,
    unit: a.unit,
    origin: "global_default" as const,
    source_assumption_id: a.id,
  }));
  if (rows.length === 0) return;
  const { error } = await supabase
    .from("event_assumption_values")
    .upsert(rows, { onConflict: "event_id,key", ignoreDuplicates: true });
  if (error) throw error;
}

export async function overrideEventAssumption(id: string, value: number | null) {
  const { error } = await supabase
    .from("event_assumption_values")
    .update({ value, origin: "manual_override" })
    .eq("id", id);
  if (error) throw error;
}

/** Deliberate «Aktuellen Standard übernehmen» for one event value. */
export async function adoptCurrentDefault(id: string, assumption: EventAssumption) {
  const { error } = await supabase
    .from("event_assumption_values")
    .update({
      value: assumption.value,
      label: assumption.label,
      unit: assumption.unit,
      origin: "global_default",
      source_assumption_id: assumption.id,
    })
    .eq("id", id);
  if (error) throw error;
}
