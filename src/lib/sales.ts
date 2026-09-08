/**
 * Expected-sales helpers. Prepares variants and add-ons for the later
 * total-menu calculation. No results are persisted.
 */
import type { Database } from "@/integrations/supabase/types";

type SalesInputMode = Database["public"]["Enums"]["sales_input_mode"];

export type SalesLike = {
  sales_input_mode: SalesInputMode;
  expected_per_open_day: number | string;
  expected_total: number | string | null;
};

export type OpenDaysCardLike = {
  valid_from: string;
  valid_to: string;
  opening_weekdays: number[];
};

/** ISO weekday 1 = Monday … 7 = Sunday. */
function isoWeekday(d: Date): number {
  const js = d.getUTCDay();
  return js === 0 ? 7 : js;
}

/** Number of open days in the menu-card period, minus excluded days. */
export function openDaysCount(card: OpenDaysCardLike | null, excludedDates: string[] = []): number {
  if (!card) return 0;
  const from = new Date(`${card.valid_from}T00:00:00Z`);
  const to = new Date(`${card.valid_to}T00:00:00Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return 0;
  const excluded = new Set(excludedDates);
  const weekdays = new Set(card.opening_weekdays);
  let count = 0;
  for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    if (!weekdays.has(isoWeekday(d))) continue;
    if (excluded.has(d.toISOString().slice(0, 10))) continue;
    count++;
  }
  return count;
}

/** Expected total sales over the period, derived from the configured input mode. */
export function expectedTotalSales(entity: SalesLike, openDays: number): number | null {
  if (entity.sales_input_mode === "total") {
    const t = entity.expected_total === null ? NaN : Number(entity.expected_total);
    return Number.isFinite(t) ? t : null;
  }
  const perDay = Number(entity.expected_per_open_day);
  if (!Number.isFinite(perDay)) return null;
  return perDay * openDays;
}

/**
 * Non-blocking plausibility check: an add-on cannot be sold more often than
 * all dishes it is assigned to together. Each add-on is checked on its own –
 * a guest may order several different add-ons.
 */
export function addOnSalesWarning(
  addOn: SalesLike & { name: string },
  assignedDishVariants: SalesLike[],
  openDays: number,
): string | null {
  const addOnTotal = expectedTotalSales(addOn, openDays);
  if (addOnTotal === null || assignedDishVariants.length === 0) return null;
  const dishTotal = assignedDishVariants.reduce((s, v) => s + (expectedTotalSales(v, openDays) ?? 0), 0);
  if (addOnTotal > dishTotal) {
    return `Erwarteter Absatz des Add-ons (${Math.round(addOnTotal).toLocaleString("de-CH")}) liegt über dem erwarteten Absatz aller zugeordneten Gerichte zusammen (${Math.round(dishTotal).toLocaleString("de-CH")}). Bitte Annahmen prüfen.`;
  }
  return null;
}
