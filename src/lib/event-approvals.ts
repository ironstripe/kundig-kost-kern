/**
 * Execution approval ("Durchführung freigeben") and the local preparation of
 * the future Kundivent handover.
 *
 * The approval is decision evidence: an immutable snapshot of the calculation
 * basis, never a second calculation engine. A positive result never approves
 * anything automatically.
 */
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ExecutionApproval = Database["public"]["Tables"]["event_execution_approvals"]["Row"];
export type HandoverState = Database["public"]["Enums"]["event_handover_state"];

export const handoverStateLabels: Record<HandoverState, string> = {
  not_ready: "Noch nicht freigegeben",
  ready: "Zur Übergabe bereit",
  handed_over: "An Kundivent übergeben",
};

export const HANDOVER_NOT_CONFIGURED = "Kundivent-Übergabe noch nicht eingerichtet.";

export async function fetchExecutionApprovals(eventId: string): Promise<ExecutionApproval[]> {
  const { data, error } = await supabase
    .from("event_execution_approvals")
    .select("*")
    .eq("event_id", eventId)
    .order("approved_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export const executionApprovalsQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["event_execution_approvals", eventId],
    queryFn: () => fetchExecutionApprovals(eventId),
  });

/** Current fingerprint of the financially relevant inputs (computed server-side). */
export async function fetchBasisFingerprint(eventId: string): Promise<string> {
  const { data, error } = await supabase.rpc("event_basis_fingerprint", { _event_id: eventId });
  if (error) throw error;
  return (data as string) ?? "";
}

export const basisFingerprintQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["event_basis_fingerprint", eventId],
    queryFn: () => fetchBasisFingerprint(eventId),
  });

/** Server-validated: refused while required calculation inputs are missing. */
export async function approveEventExecution(eventId: string, note: string | null) {
  const { error } = await supabase.rpc("approve_event_execution", {
    _event_id: eventId,
    _note: note,
  });
  if (error) throw error;
}
