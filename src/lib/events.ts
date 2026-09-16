/**
 * Events: pre-calculation, menu link with read-only snapshot, post-calculation.
 */
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { MenuSnapshot } from "@/lib/menu-costing";

type Tables = Database["public"]["Tables"];
export type Event = Tables["events"]["Row"];
export type EventInsert = Tables["events"]["Insert"];
export type EventUpdate = Tables["events"]["Update"];
export type EventLineRow = Tables["event_lines"]["Row"];
export type EventLineInsert = Tables["event_lines"]["Insert"];
export type EventLineUpdate = Tables["event_lines"]["Update"];
export type EventMenuLink = Tables["event_menu_links"]["Row"];
export type EventMenuVariantRow = Tables["event_menu_variants"]["Row"];
export type EventAssumptionValue = Tables["event_assumption_values"]["Row"];

export const LOCKED_STATUSES: Database["public"]["Enums"]["event_status"][] = [
  "executed",
  "postcalculated",
  "archived",
];

export function isSnapshotLocked(status: Event["status"]): boolean {
  return LOCKED_STATUSES.includes(status);
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export async function fetchEvents(): Promise<Event[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("event_date", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export const eventsQuery = queryOptions({ queryKey: ["events"], queryFn: fetchEvents });

export async function fetchEvent(id: string): Promise<Event | null> {
  const { data, error } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export const eventQuery = (id: string) => queryOptions({ queryKey: ["events", id], queryFn: () => fetchEvent(id) });

export async function createEvent(values: EventInsert, userId: string) {
  const { data, error } = await supabase
    .from("events")
    .insert({ ...values, created_by: userId, updated_by: userId })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateEvent(id: string, patch: EventUpdate, userId: string) {
  const { error } = await supabase.from("events").update({ ...patch, updated_by: userId }).eq("id", id);
  if (error) throw error;
}

export async function deleteEvent(id: string) {
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Lines (loaded in one request for all events, or filtered per event)
// ---------------------------------------------------------------------------

export async function fetchEventLines(eventId?: string): Promise<EventLineRow[]> {
  let q = supabase.from("event_lines").select("*").order("sort_order");
  if (eventId) q = q.eq("event_id", eventId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export const eventLinesQuery = queryOptions({ queryKey: ["event_lines"], queryFn: () => fetchEventLines() });

export const eventLinesForQuery = (eventId: string) =>
  queryOptions({ queryKey: ["event_lines", eventId], queryFn: () => fetchEventLines(eventId) });

export async function createEventLine(values: EventLineInsert) {
  const { data, error } = await supabase.from("event_lines").insert(values).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateEventLine(id: string, patch: EventLineUpdate) {
  const { error } = await supabase.from("event_lines").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteEventLine(id: string) {
  const { error } = await supabase.from("event_lines").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Menu link and snapshot
// ---------------------------------------------------------------------------

export async function fetchEventMenuLinks(): Promise<EventMenuLink[]> {
  const { data, error } = await supabase.from("event_menu_links").select("*");
  if (error) throw error;
  return data ?? [];
}

export const eventMenuLinksQuery = queryOptions({
  queryKey: ["event_menu_links"],
  queryFn: fetchEventMenuLinks,
});

export async function fetchEventMenuVariants(): Promise<EventMenuVariantRow[]> {
  const { data, error } = await supabase.from("event_menu_variants").select("*");
  if (error) throw error;
  return data ?? [];
}

export const eventMenuVariantsQuery = queryOptions({
  queryKey: ["event_menu_variants"],
  queryFn: fetchEventMenuVariants,
});

/** Links a menu to an event and stores an immutable calculation snapshot. */
export async function linkMenuToEvent(
  eventId: string,
  menuId: string,
  snapshot: MenuSnapshot,
  userId: string,
) {
  const { error } = await supabase.from("event_menu_links").upsert(
    {
      event_id: eventId,
      menu_id: menuId,
      snapshot: snapshot as unknown as Database["public"]["Tables"]["event_menu_links"]["Insert"]["snapshot"],
      snapshot_at: new Date().toISOString(),
      created_by: userId,
    },
    { onConflict: "event_id" },
  );
  if (error) throw error;
}

export async function unlinkMenuFromEvent(eventId: string) {
  const { error } = await supabase.from("event_menu_links").delete().eq("event_id", eventId);
  if (error) throw error;
  const { error: e2 } = await supabase.from("event_menu_variants").delete().eq("event_id", eventId);
  if (e2) throw e2;
}

export async function setEventMenuVariant(
  eventId: string,
  menuVariantId: string,
  patch: { planned_guests?: number | null; actual_guests?: number | null },
) {
  const { error } = await supabase
    .from("event_menu_variants")
    .upsert({ event_id: eventId, menu_variant_id: menuVariantId, ...patch }, { onConflict: "event_id,menu_variant_id" });
  if (error) throw error;
}

export async function removeEventMenuVariant(eventId: string, menuVariantId: string) {
  const { error } = await supabase
    .from("event_menu_variants")
    .delete()
    .eq("event_id", eventId)
    .eq("menu_variant_id", menuVariantId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Event-specific assumption values
// ---------------------------------------------------------------------------

export async function fetchEventAssumptionValues(eventId: string): Promise<EventAssumptionValue[]> {
  const { data, error } = await supabase
    .from("event_assumption_values")
    .select("*")
    .eq("event_id", eventId)
    .order("label");
  if (error) throw error;
  return data ?? [];
}

export const eventAssumptionValuesQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["event_assumption_values", eventId],
    queryFn: () => fetchEventAssumptionValues(eventId),
  });
