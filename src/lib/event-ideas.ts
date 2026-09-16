/**
 * Event ideas: capture, discussion and the deliberate approval for calculation.
 *
 * An idea approval only permits calculating. It is never an execution approval.
 */
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
export type EventIdea = Tables["event_ideas"]["Row"];
export type EventIdeaInsert = Tables["event_ideas"]["Insert"];
export type EventIdeaUpdate = Tables["event_ideas"]["Update"];
export type EventIdeaNote = Tables["event_idea_notes"]["Row"];
export type IdeaStage = Database["public"]["Enums"]["event_idea_stage"];

export const ideaStageLabels: Record<IdeaStage, string> = {
  new: "Neu",
  in_discussion: "In Diskussion",
  approved_for_calculation: "Zur Kalkulation freigegeben",
  deferred: "Zurückgestellt",
  rejected: "Verworfen",
};

export const IDEA_STAGES: IdeaStage[] = [
  "new",
  "in_discussion",
  "approved_for_calculation",
  "deferred",
  "rejected",
];

export async function fetchEventIdeas(): Promise<EventIdea[]> {
  const { data, error } = await supabase
    .from("event_ideas")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export const eventIdeasQuery = queryOptions({ queryKey: ["event_ideas"], queryFn: fetchEventIdeas });

export async function fetchEventIdea(id: string): Promise<EventIdea | null> {
  const { data, error } = await supabase.from("event_ideas").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export const eventIdeaQuery = (id: string) =>
  queryOptions({ queryKey: ["event_ideas", id], queryFn: () => fetchEventIdea(id) });

export async function createEventIdea(values: EventIdeaInsert, userId: string) {
  const { data, error } = await supabase
    .from("event_ideas")
    .insert({ ...values, created_by: userId, updated_by: userId })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateEventIdea(id: string, patch: EventIdeaUpdate, userId: string) {
  const { error } = await supabase
    .from("event_ideas")
    .update({ ...patch, updated_by: userId })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Changes the stage. Approving for calculation records who decided and when;
 * the record is kept when the idea later moves back into discussion.
 */
export async function setIdeaStage(idea: EventIdea, stage: IdeaStage, userId: string) {
  const patch: EventIdeaUpdate = { stage };
  if (stage === "approved_for_calculation" && !idea.calc_approved_at) {
    patch.calc_approved_by = userId;
    patch.calc_approved_at = new Date().toISOString();
  }
  await updateEventIdea(idea.id, patch, userId);
}

// ---------------------------------------------------------------------------
// Discussion notes
// ---------------------------------------------------------------------------

export async function fetchIdeaNotes(ideaId: string): Promise<EventIdeaNote[]> {
  const { data, error } = await supabase
    .from("event_idea_notes")
    .select("*")
    .eq("idea_id", ideaId)
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

export const ideaNotesQuery = (ideaId: string) =>
  queryOptions({ queryKey: ["event_idea_notes", ideaId], queryFn: () => fetchIdeaNotes(ideaId) });

export async function addIdeaNote(ideaId: string, body: string, userId: string) {
  const { error } = await supabase
    .from("event_idea_notes")
    .insert({ idea_id: ideaId, body, author_id: userId });
  if (error) throw error;
}

export async function deleteIdeaNote(id: string) {
  const { error } = await supabase.from("event_idea_notes").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Idea -> calculation
// ---------------------------------------------------------------------------

/** Idempotent: returns the existing linked calculation instead of a second one. */
export async function createEventFromIdea(ideaId: string): Promise<string> {
  const { data, error } = await supabase.rpc("create_event_from_idea", { _idea_id: ideaId });
  if (error) throw error;
  return data as string;
}
