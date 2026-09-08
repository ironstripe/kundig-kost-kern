/**
 * Temporary scenario layer.
 *
 * Overrides live only in browser memory (never persisted, never written to
 * the database). They are keyed by entity + id + field and applied on top of
 * the saved baseline data right before the shared costing engine runs.
 * The operational dataset is never duplicated – only touched rows are
 * shallow-copied while calculating.
 */
import { useCallback, useSyncExternalStore } from "react";
import type { MenuCardData } from "@/lib/menu-cards";
import type { SmallMaterialMode } from "@/lib/costing";

export type OverrideEntity = "variant" | "add_on" | "ingredient" | "item" | "card";
export type OverrideField =
  | "gross_price"
  | "per_day"
  | "total"
  | "package_price"
  | "net_quantity"
  | "yield_percent"
  | "small_material_value"
  | "small_material_mode";

export type Override = {
  entity: OverrideEntity;
  id: string;
  field: OverrideField;
  value: number | string;
};

export type Overrides = Record<string, Override>;

export const overrideKey = (entity: OverrideEntity, id: string, field: OverrideField) => `${entity}:${id}:${field}`;

export const FIELD_LABELS: Record<OverrideField, string> = {
  gross_price: "Brutto-Verkaufspreis",
  per_day: "Verkäufe pro Öffnungstag",
  total: "Verkäufe gesamt (Laufzeit)",
  package_price: "Einkaufspreis pro Gebinde",
  net_quantity: "Nettomenge",
  yield_percent: "Ausbeute",
  small_material_value: "Kleinmaterial (Wert)",
  small_material_mode: "Kleinmaterial (Modus)",
};

export const ENTITY_LABELS: Record<OverrideEntity, string> = {
  variant: "Variante",
  add_on: "Add-on",
  ingredient: "Zutat",
  item: "Rezeptmenge",
  card: "Speisekarte",
};

// ---------------------------------------------------------------------------
// In-memory store (module scope – cleared on refresh, never persisted)
// ---------------------------------------------------------------------------

type State = { cardId: string | null; overrides: Overrides };
let state: State = { cardId: null, overrides: {} };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnapshot = () => state;
const EMPTY: State = { cardId: null, overrides: {} };
const getServerSnapshot = () => EMPTY;

export const scenarioStore = {
  get: () => state,
  count: () => Object.keys(state.overrides).length,
  hasChanges: () => Object.keys(state.overrides).length > 0,
  set(cardId: string, entity: OverrideEntity, id: string, field: OverrideField, value: number | string | null) {
    const next: Overrides = state.cardId === cardId ? { ...state.overrides } : {};
    const key = overrideKey(entity, id, field);
    if (value === null) delete next[key];
    else {
      next[key] = { entity, id, field, value };
      // Sales quantity: only one intentional input mode per entity.
      if (field === "per_day") delete next[overrideKey(entity, id, "total")];
      if (field === "total") delete next[overrideKey(entity, id, "per_day")];
    }
    state = { cardId, overrides: next };
    emit();
  },
  remove(key: string) {
    if (!(key in state.overrides)) return;
    const next = { ...state.overrides };
    delete next[key];
    state = { ...state, overrides: next };
    emit();
  },
  clear() {
    state = { cardId: null, overrides: {} };
    emit();
  },
  subscribe,
};

/** React hook returning the overrides for a card (empty when the card differs). */
export function useScenario(cardId: string | null | undefined) {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const overrides: Overrides = cardId && snap.cardId === cardId ? snap.overrides : {};
  const set = useCallback(
    (entity: OverrideEntity, id: string, field: OverrideField, value: number | string | null) => {
      if (!cardId) return;
      scenarioStore.set(cardId, entity, id, field, value);
    },
    [cardId],
  );
  return {
    overrides,
    count: Object.keys(overrides).length,
    set,
    remove: scenarioStore.remove,
    clear: scenarioStore.clear,
    get: (entity: OverrideEntity, id: string, field: OverrideField) => overrides[overrideKey(entity, id, field)]?.value,
  };
}

/** Used by navigation guards (logout, card switch) outside the scenario page. */
export function useScenarioHasChanges(): boolean {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return Object.keys(snap.overrides).length > 0;
}

export const SCENARIO_LOSS_MESSAGE =
  "Das temporäre Szenario enthält nicht gespeicherte Änderungen. Beim Verlassen gehen sie verloren.";

// ---------------------------------------------------------------------------
// Applying overrides to baseline data
// ---------------------------------------------------------------------------

/**
 * Returns a derived dataset with overrides applied. Untouched rows are the
 * same object references as in the baseline; nothing is copied wholesale.
 */
export function applyOverrides(data: MenuCardData, overrides: Overrides | undefined): MenuCardData {
  if (!overrides || Object.keys(overrides).length === 0) return data;
  const num = (entity: OverrideEntity, id: string, field: OverrideField): number | undefined => {
    const v = overrides[overrideKey(entity, id, field)]?.value;
    return typeof v === "number" && Number.isFinite(v) ? v : undefined;
  };

  const smMode = overrides[overrideKey("card", data.card.id, "small_material_mode")]?.value;
  const smValue = num("card", data.card.id, "small_material_value");
  const card =
    smMode !== undefined || smValue !== undefined
      ? {
          ...data.card,
          small_material_mode: (smMode as SmallMaterialMode | undefined) ?? data.card.small_material_mode,
          small_material_value: smValue ?? data.card.small_material_value,
        }
      : data.card;

  const applySellable = <T extends { id: string; gross_price: number; sales_input_mode: "per_open_day" | "total"; expected_per_open_day: number; expected_total: number | null }>(
    entity: "variant" | "add_on",
    row: T,
  ): T => {
    const price = num(entity, row.id, "gross_price");
    const perDay = num(entity, row.id, "per_day");
    const total = num(entity, row.id, "total");
    if (price === undefined && perDay === undefined && total === undefined) return row;
    const next = { ...row };
    if (price !== undefined) next.gross_price = price;
    if (perDay !== undefined) {
      next.sales_input_mode = "per_open_day";
      next.expected_per_open_day = perDay;
    } else if (total !== undefined) {
      next.sales_input_mode = "total";
      next.expected_total = total;
    }
    return next;
  };

  return {
    ...data,
    card,
    variants: data.variants.map((v) => applySellable("variant", v)),
    addOns: data.addOns.map((a) => applySellable("add_on", a)),
    ingredients: data.ingredients.map((i) => {
      const p = num("ingredient", i.id, "package_price");
      return p === undefined ? i : { ...i, package_price: p };
    }),
    items: data.items.map((it) => {
      const q = num("item", it.id, "net_quantity");
      const y = num("item", it.id, "yield_percent");
      if (q === undefined && y === undefined) return it;
      return { ...it, net_quantity: q ?? it.net_quantity, yield_percent: y ?? it.yield_percent };
    }),
  };
}

/** Signed difference; null when either side is missing. */
export function diff(base: number | null | undefined, scen: number | null | undefined): number | null {
  if (base === null || base === undefined || scen === null || scen === undefined) return null;
  if (!Number.isFinite(base) || !Number.isFinite(scen)) return null;
  return scen - base;
}
