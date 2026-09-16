/**
 * Erfahrungswerte: evidence collected from completed events, grouped by event
 * type. Nothing here changes a global assumption automatically.
 */
import type { Event, EventLineRow } from "@/lib/events";
import { calculateLine } from "@/lib/event-costing";
import type { Database } from "@/integrations/supabase/types";

type EventType = Database["public"]["Enums"]["event_type"];

export const COMPLETED_STATUSES: Database["public"]["Enums"]["event_status"][] = ["executed", "postcalculated"];

export type ExperienceMetric = {
  key: string;
  label: string;
  unit: "chf_per_guest" | "chf" | "hours" | "hours_per_guest" | "percent";
  /** Suggested assumption key when a value should become a new default. */
  assumptionKey?: string;
  count: number;
  average: number | null;
  min: number | null;
  max: number | null;
};

export type ExperienceGroup = {
  type: EventType;
  events: Event[];
  from: string | null;
  to: string | null;
  metrics: ExperienceMetric[];
};

type MetricDef = {
  key: string;
  label: string;
  unit: ExperienceMetric["unit"];
  assumptionKey?: string;
  /** Returns the observed value for one event, or null when unknown. */
  value: (lines: EventLineRow[], event: Event) => number | null;
};

function actualTotalOf(lines: EventLineRow[], category: string): number | null {
  const rows = lines.filter((l) => l.category === category);
  if (rows.length === 0) return null;
  const totals = rows.map((l) => calculateLine(l).actualTotal);
  if (totals.some((t) => t === null)) return null;
  return totals.reduce<number>((s, t) => s + (t ?? 0), 0);
}

function actualQuantityOf(lines: EventLineRow[], category: string): number | null {
  const rows = lines.filter((l) => l.category === category);
  if (rows.length === 0) return null;
  const q = rows.map((l) => (l.actual_quantity === null ? null : Number(l.actual_quantity)));
  if (q.some((v) => v === null || !Number.isFinite(v))) return null;
  return q.reduce<number>((s, v) => s + (v ?? 0), 0);
}

function perGuest(value: number | null, event: Event): number | null {
  const g = event.actual_paying_guests;
  if (value === null || g === null || g <= 0) return null;
  return value / g;
}

const METRICS: MetricDef[] = [
  {
    key: "food_per_guest",
    label: "Wareneinsatz pro Gast",
    unit: "chf_per_guest",
    value: (l, e) => perGuest(actualTotalOf(l, "menu_food_cost"), e),
  },
  {
    key: "beverage_per_guest",
    label: "Getränke pro Gast",
    unit: "chf_per_guest",
    value: (l, e) => perGuest(actualTotalOf(l, "beverages"), e),
  },
  {
    key: "kitchen_hours_per_guest",
    label: "Küchenstunden pro Gast",
    unit: "hours_per_guest",
    value: (l, e) => perGuest(actualQuantityOf(l, "personnel_kitchen"), e),
  },
  {
    key: "service_hours_per_guest",
    label: "Servicestunden pro Gast",
    unit: "hours_per_guest",
    value: (l, e) => perGuest(actualQuantityOf(l, "personnel_service"), e),
  },
  {
    key: "organisation_hours",
    label: "Stunden Eventorganisation",
    unit: "hours",
    value: (l) => actualQuantityOf(l, "personnel_organisation"),
  },
  {
    key: "logistics_hours",
    label: "Stunden Logistik",
    unit: "hours",
    value: (l) => actualQuantityOf(l, "personnel_logistics"),
  },
  {
    key: "small_material_per_guest",
    label: "Kleinmaterial pro Gast",
    unit: "chf_per_guest",
    assumptionKey: "small_material_per_guest",
    value: (l, e) => perGuest(actualTotalOf(l, "other_variable"), e),
  },
  {
    key: "fixed_costs",
    label: "Direkte Fixkosten",
    unit: "chf",
    value: (l) => {
      const rows = l.filter((x) => x.kind === "fixed_cost");
      if (rows.length === 0) return null;
      const totals = rows.map((x) => calculateLine(x).actualTotal);
      if (totals.some((t) => t === null)) return null;
      return totals.reduce<number>((s, t) => s + (t ?? 0), 0);
    },
  },
  {
    key: "plan_actual_variance",
    label: "Abweichung Plan/Ist (Kosten)",
    unit: "percent",
    value: (l) => {
      const rows = l.filter((x) => x.kind !== "revenue" && x.kind !== "informational").map(calculateLine);
      const planned = rows.map((r) => r.plannedTotal);
      const actual = rows.map((r) => r.actualTotal);
      if (rows.length === 0 || planned.some((v) => v === null) || actual.some((v) => v === null)) return null;
      const p = planned.reduce<number>((s, v) => s + (v ?? 0), 0);
      const a = actual.reduce<number>((s, v) => s + (v ?? 0), 0);
      if (p === 0) return null;
      return ((a - p) / Math.abs(p)) * 100;
    },
  },
];

export function buildExperience(events: Event[], lines: EventLineRow[]): ExperienceGroup[] {
  const completed = events.filter((e) => COMPLETED_STATUSES.includes(e.status));
  const byType = new Map<EventType, Event[]>();
  for (const e of completed) {
    const list = byType.get(e.event_type) ?? [];
    list.push(e);
    byType.set(e.event_type, list);
  }
  const linesByEvent = new Map<string, EventLineRow[]>();
  for (const l of lines) {
    const list = linesByEvent.get(l.event_id) ?? [];
    list.push(l);
    linesByEvent.set(l.event_id, list);
  }

  return Array.from(byType.entries()).map(([type, list]) => {
    const dates = list.map((e) => e.event_date).filter((d): d is string => !!d).sort();
    const metrics = METRICS.map((m) => {
      const values = list
        .map((e) => m.value(linesByEvent.get(e.id) ?? [], e))
        .filter((v): v is number => v !== null && Number.isFinite(v));
      const count = values.length;
      return {
        key: m.key,
        label: m.label,
        unit: m.unit,
        ...(m.assumptionKey ? { assumptionKey: m.assumptionKey } : {}),
        count,
        average: count > 0 ? values.reduce((s, v) => s + v, 0) / count : null,
        min: count > 0 ? Math.min(...values) : null,
        max: count > 0 ? Math.max(...values) : null,
      } satisfies ExperienceMetric;
    });
    return {
      type,
      events: list,
      from: dates[0] ?? null,
      to: dates[dates.length - 1] ?? null,
      metrics,
    };
  });
}
