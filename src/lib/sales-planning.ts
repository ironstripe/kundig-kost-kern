/**
 * Sales-volume planning: persistence helpers for expected sales of variants
 * and add-ons. The value the user entered is stored as the source
 * (sales_input_mode); the other figure is always derived on the fly.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type SalesInputMode = Database["public"]["Enums"]["sales_input_mode"];
export type SalesTargetKind = "variant" | "add_on";

export type SalesPatch = {
  kind: SalesTargetKind;
  id: string;
  sales_input_mode: SalesInputMode;
  expected_per_open_day: number;
  expected_total: number | null;
};

/** Demo assumption: one sale per opening day. */
export const DEMO_SALES: Pick<SalesPatch, "sales_input_mode" | "expected_per_open_day" | "expected_total"> = {
  sales_input_mode: "per_open_day",
  expected_per_open_day: 1,
  expected_total: null,
};

export function isDemoAssumption(e: { sales_input_mode: SalesInputMode; expected_per_open_day: number | string; expected_total: number | string | null }) {
  return e.sales_input_mode === "per_open_day" && Number(e.expected_per_open_day) === 1;
}

/** Derived pair without overwriting the intentional source value. */
export function derivedSales(
  e: { sales_input_mode: SalesInputMode; expected_per_open_day: number | string; expected_total: number | string | null },
  sellingDays: number,
): { perDay: number | null; total: number | null } {
  if (e.sales_input_mode === "total") {
    const total = e.expected_total === null ? null : Number(e.expected_total);
    if (total === null || !Number.isFinite(total)) return { perDay: null, total: null };
    return { total, perDay: sellingDays > 0 ? total / sellingDays : null };
  }
  const perDay = Number(e.expected_per_open_day);
  if (!Number.isFinite(perDay)) return { perDay: null, total: null };
  return { perDay, total: sellingDays > 0 ? perDay * sellingDays : null };
}

export async function saveSalesPatches(patches: SalesPatch[], userId: string) {
  for (const p of patches) {
    const values = {
      sales_input_mode: p.sales_input_mode,
      expected_per_open_day: p.expected_per_open_day,
      expected_total: p.expected_total,
    };
    const { error } =
      p.kind === "variant"
        ? await supabase.from("variants").update({ ...values, updated_by: userId }).eq("id", p.id)
        : await supabase.from("add_ons").update(values).eq("id", p.id);
    if (error) throw error;
  }
}

/** Bulk update of many rows with the same values – two statements at most. */
export async function bulkSetSales(
  targets: { kind: SalesTargetKind; id: string }[],
  values: Pick<SalesPatch, "sales_input_mode" | "expected_per_open_day" | "expected_total">,
  userId: string,
) {
  const variantIds = targets.filter((t) => t.kind === "variant").map((t) => t.id);
  const addOnIds = targets.filter((t) => t.kind === "add_on").map((t) => t.id);
  if (variantIds.length) {
    const { error } = await supabase.from("variants").update({ ...values, updated_by: userId }).in("id", variantIds);
    if (error) throw error;
  }
  if (addOnIds.length) {
    const { error } = await supabase.from("add_ons").update(values).in("id", addOnIds);
    if (error) throw error;
  }
}
