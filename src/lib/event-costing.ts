/**
 * Event costing ("Bierdeckel"). One shared implementation used by lists,
 * detail pages and summaries.
 *
 * Rules:
 * - A missing value stays `null` and is never treated as zero.
 * - A deliberate zero (quantity 0 with a confirmed status) is a real value.
 * - DB I / DB II are only computed when all required inputs are known.
 * - Informational lines never influence DB I or DB II.
 */
import { VAT_RATE_DEFAULT } from "@/lib/costing";
import type { Database } from "@/integrations/supabase/types";

type Enums = Database["public"]["Enums"];
export type EventLine = Database["public"]["Tables"]["event_lines"]["Row"];
export type EventLineKind = Enums["event_line_kind"];
export type EventValueStatus = Enums["event_value_status"];

export type EventLineResult = {
  line: EventLine;
  plannedTotal: number | null;
  actualTotal: number | null;
  /** Required line without a usable planned total. */
  missing: boolean;
  deltaAbsolute: number | null;
  deltaPercent: number | null;
};

function total(unit: number | null, quantity: number | null): number | null {
  if (unit === null || quantity === null) return null;
  const u = Number(unit);
  const q = Number(quantity);
  if (!Number.isFinite(u) || !Number.isFinite(q)) return null;
  const t = u * q;
  return Number.isFinite(t) ? t : null;
}

export function calculateLine(line: EventLine): EventLineResult {
  const plannedTotal = total(line.planned_unit_amount as number | null, line.planned_quantity as number | null);
  const actualTotal = total(line.actual_unit_amount as number | null, line.actual_quantity as number | null);
  const missing = line.kind !== "informational" && line.is_required && plannedTotal === null;
  const deltaAbsolute = plannedTotal !== null && actualTotal !== null ? actualTotal - plannedTotal : null;
  const deltaPercent =
    plannedTotal !== null && actualTotal !== null && plannedTotal !== 0
      ? ((actualTotal - plannedTotal) / Math.abs(plannedTotal)) * 100
      : null;
  return { line, plannedTotal, actualTotal, missing, deltaAbsolute, deltaPercent };
}

export type Bucket = {
  kind: EventLineKind;
  lines: EventLineResult[];
  /** Sum of the known planned totals (always available). */
  known: number;
  /** Complete planned sum, or null when a required line is open. */
  planned: number | null;
  actual: number | null;
  openLines: string[];
};

function bucket(kind: EventLineKind, results: EventLineResult[]): Bucket {
  const lines = results.filter((r) => r.line.kind === kind);
  const known = lines.reduce((s, r) => s + (r.plannedTotal ?? 0), 0);
  const openLines = lines.filter((r) => r.missing).map((r) => r.line.name);
  const actualComplete = lines.length > 0 && lines.every((r) => r.actualTotal !== null);
  return {
    kind,
    lines,
    known,
    planned: openLines.length === 0 ? known : null,
    actual: actualComplete ? lines.reduce((s, r) => s + (r.actualTotal ?? 0), 0) : null,
    openLines,
  };
}

export type CompletenessLabel = "Vollständig" | "Teilweise vollständig" | "Nicht vollständig kalkulierbar";

export type EventResult = {
  lines: EventLineResult[];
  revenue: Bucket;
  variable: Bucket;
  personnel: Bucket;
  fixed: Bucket;
  informational: EventLineResult[];
  grossRevenue: number | null;
  netRevenue: number | null;
  variableCosts: number | null;
  contributionMargin1: number | null;
  contributionMargin1PerPayingGuest: number | null;
  personnelCosts: number | null;
  fixedCosts: number | null;
  contributionMargin2: number | null;
  contributionMargin2PerPayingGuest: number | null;
  contributionMargin2Ratio: number | null;
  breakEvenPayingGuests: number | null;
  /** Gross revenue minus known deductions – never a contribution margin. */
  knownIntermediateBalance: number;
  openPositions: string[];
  counts: { confirmed: number; assumption: number; effective: number; open: number; informational: number };
  completeness: CompletenessLabel;
  complete: boolean;
};

export type EventLike = {
  planned_paying_guests: number | null;
  actual_paying_guests?: number | null;
  vat_rate?: number;
};

export function calculateEvent(lines: EventLine[], event: EventLike): EventResult {
  const results = [...lines]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(calculateLine);

  const revenue = bucket("revenue", results);
  const variable = bucket("variable_cost", results);
  const personnel = bucket("personnel_cost", results);
  const fixed = bucket("fixed_cost", results);
  const informational = results.filter((r) => r.line.kind === "informational");

  const vat = event.vat_rate ?? VAT_RATE_DEFAULT;
  const grossRevenue = revenue.planned;
  const netRevenue = grossRevenue === null ? null : grossRevenue / (1 + vat);
  const variableCosts = variable.planned;
  const contributionMargin1 = netRevenue !== null && variableCosts !== null ? netRevenue - variableCosts : null;
  const personnelCosts = personnel.planned;
  const fixedCosts = fixed.planned;
  const contributionMargin2 =
    contributionMargin1 !== null && personnelCosts !== null && fixedCosts !== null
      ? contributionMargin1 - personnelCosts - fixedCosts
      : null;

  const payingGuests = event.planned_paying_guests;
  const perGuest = (v: number | null) =>
    v !== null && payingGuests !== null && payingGuests > 0 ? v / payingGuests : null;

  const contributionMargin2Ratio =
    contributionMargin2 !== null && netRevenue !== null && netRevenue > 0
      ? (contributionMargin2 / netRevenue) * 100
      : null;

  // Break-even: fixed blocks divided by the contribution per paying guest.
  let breakEvenPayingGuests: number | null = null;
  if (
    contributionMargin1 !== null &&
    personnelCosts !== null &&
    fixedCosts !== null &&
    payingGuests !== null &&
    payingGuests > 0
  ) {
    const cmPerGuest = contributionMargin1 / payingGuests;
    if (cmPerGuest > 0) {
      const be = (personnelCosts + fixedCosts) / cmPerGuest;
      breakEvenPayingGuests = Number.isFinite(be) ? Math.ceil(be) : null;
    }
  }

  const knownIntermediateBalance =
    revenue.known - variable.known - personnel.known - fixed.known;

  const openPositions = [...revenue.openLines, ...variable.openLines, ...personnel.openLines, ...fixed.openLines];

  const relevant = results.filter((r) => r.line.kind !== "informational");
  const counts = {
    confirmed: relevant.filter((r) => r.line.value_status === "confirmed").length,
    assumption: relevant.filter((r) => r.line.value_status === "assumption").length,
    effective: relevant.filter((r) => r.line.value_status === "effective").length,
    open: openPositions.length,
    informational: informational.length,
  };

  const complete = contributionMargin2 !== null && openPositions.length === 0 && relevant.length > 0;
  const completeness: CompletenessLabel = complete
    ? "Vollständig"
    : counts.confirmed + counts.effective + counts.assumption > 0
      ? "Teilweise vollständig"
      : "Nicht vollständig kalkulierbar";

  return {
    lines: results,
    revenue,
    variable,
    personnel,
    fixed,
    informational,
    grossRevenue,
    netRevenue,
    variableCosts,
    contributionMargin1,
    contributionMargin1PerPayingGuest: perGuest(contributionMargin1),
    personnelCosts,
    fixedCosts,
    contributionMargin2,
    contributionMargin2PerPayingGuest: perGuest(contributionMargin2),
    contributionMargin2Ratio,
    breakEvenPayingGuests,
    knownIntermediateBalance,
    openPositions,
    counts,
    completeness,
    complete,
  };
}

export const INCOMPLETE_NOTICE =
  "Diese Eventkalkulation enthält offene Kosten. Zwischensalden sind kein vollständiger Deckungsbeitrag.";
