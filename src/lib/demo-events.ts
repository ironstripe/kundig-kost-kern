/**
 * Beer & Dine demo data.
 *
 * Idempotent and clearly labelled. Nothing is invented: only values that are
 * actually known are filled in; required but unknown cost positions stay open
 * (value status «Offen»), they are never set to zero.
 */
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { EventLineInsert } from "@/lib/events";

export const BEER_DINE_KEY = "beer_dine_2026_11_14";

export type DemoSeed = { key: string; created_at: string; removed_at: string | null };

export async function fetchDemoSeed(key: string): Promise<DemoSeed | null> {
  const { data, error } = await supabase.from("demo_seeds").select("*").eq("key", key).maybeSingle();
  if (error) throw error;
  return data as DemoSeed | null;
}

export const demoSeedQuery = (key: string) =>
  queryOptions({ queryKey: ["demo_seeds", key], queryFn: () => fetchDemoSeed(key) });

async function existingDemoEventId(): Promise<string | null> {
  const { data, error } = await supabase.from("events").select("id").eq("demo_key", BEER_DINE_KEY).maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

function demoLines(eventId: string): EventLineInsert[] {
  return [
    {
      event_id: eventId,
      name: "Ticketerlös",
      category: "ticket_revenue",
      kind: "revenue",
      calc_mode: "per_guest",
      planned_unit_amount: 120,
      planned_quantity: 50,
      value_status: "confirmed",
      notes: "CHF 120 brutto pro zahlendem Gast, 50 Gäste geplant.",
      sort_order: 10,
    },
    {
      event_id: eventId,
      name: "Hofrundgang (optional)",
      category: "additional_revenue",
      kind: "revenue",
      calc_mode: "per_guest",
      planned_unit_amount: 10,
      planned_quantity: 0,
      value_status: "confirmed",
      notes: "Verkaufspreis CHF 10. 0 Teilnehmende sind eine bewusste Null, kein fehlender Wert.",
      sort_order: 20,
    },
    {
      event_id: eventId,
      name: "Shuttle (optional)",
      category: "additional_revenue",
      kind: "revenue",
      calc_mode: "per_guest",
      planned_unit_amount: 10,
      planned_quantity: 0,
      value_status: "confirmed",
      notes: "Verkaufspreis CHF 10. 0 Teilnehmende geplant (bewusste Null).",
      sort_order: 30,
    },
    {
      event_id: eventId,
      name: "Barfüsser Anteil / Gutschrift",
      category: "partner_per_guest",
      kind: "variable_cost",
      calc_mode: "per_guest",
      planned_unit_amount: 25,
      planned_quantity: 50,
      value_status: "confirmed",
      notes: "CHF 25 pro zahlendem Gast. In der Quelltabelle als «Barfüsser Gutschrift» bezeichnet; hier als variabler Partnerabzug geführt.",
      sort_order: 40,
    },
    {
      event_id: eventId,
      name: "Wareneinsatz 3-Gang-Menü + Apéro",
      category: "menu_food_cost",
      kind: "variable_cost",
      calc_mode: "per_guest",
      value_status: "open",
      notes: "Menü noch nicht kalkuliert – Wareneinsatz offen.",
      sort_order: 50,
    },
    {
      event_id: eventId,
      name: "Shuttle-Kosten",
      category: "other_variable",
      kind: "variable_cost",
      calc_mode: "fixed",
      value_status: "open",
      notes: "Offerte ausstehend.",
      sort_order: 60,
    },
    {
      event_id: eventId,
      name: "Personal Küche",
      category: "personnel_kitchen",
      kind: "personnel_cost",
      calc_mode: "fixed",
      value_status: "open",
      notes: "Stunden noch nicht geplant.",
      sort_order: 70,
    },
    {
      event_id: eventId,
      name: "Personal Service",
      category: "personnel_service",
      kind: "personnel_cost",
      calc_mode: "fixed",
      value_status: "open",
      notes: "Stunden noch nicht geplant.",
      sort_order: 80,
    },
    {
      event_id: eventId,
      name: "Glühbier / Hofrundgang",
      category: "entertainment",
      kind: "fixed_cost",
      calc_mode: "fixed",
      value_status: "open",
      notes: "Kosten offen.",
      sort_order: 90,
    },
    {
      event_id: eventId,
      name: "Marketing / Drucksachen",
      category: "marketing",
      kind: "fixed_cost",
      calc_mode: "fixed",
      value_status: "open",
      notes: "Kosten offen.",
      sort_order: 100,
    },
    {
      event_id: eventId,
      name: "Sonstige Eventkosten",
      category: "other_fixed",
      kind: "fixed_cost",
      calc_mode: "fixed",
      value_status: "open",
      notes: "Kosten offen.",
      sort_order: 110,
    },
    {
      event_id: eventId,
      name: "Kundelfingerhof-Gutscheine an Falken",
      category: "voucher_nominal",
      kind: "informational",
      calc_mode: "fixed",
      planned_unit_amount: 1000,
      planned_quantity: 1,
      value_status: "assumption",
      is_required: false,
      notes: "Nominalwert bekannt, effektiver wirtschaftlicher Aufwand offen. Wirkt nicht auf DB I / DB II.",
      sort_order: 120,
    },
  ];
}

/**
 * Creates the demo once. Returns the event id. When the demo was deliberately
 * removed by an admin it is only recreated with `force`.
 */
export async function ensureBeerDineDemo(userId: string, force = false): Promise<string | null> {
  const existing = await existingDemoEventId();
  if (existing) return existing;

  const seed = await fetchDemoSeed(BEER_DINE_KEY);
  if (seed?.removed_at && !force) return null;

  // Draft menu – no invented dishes, no invented quantities, no food cost.
  const { data: menu, error: menuError } = await supabase
    .from("menus")
    .upsert(
      {
        name: "Beer & Dine – 3-Gang-Menü + Apéro",
        notes: "Demo-Menü. Gänge und Mengen sind noch nicht erfasst – die Kalkulation ist bewusst unvollständig.",
        status: "draft",
        demo_key: BEER_DINE_KEY,
        created_by: userId,
        updated_by: userId,
      },
      { onConflict: "demo_key" },
    )
    .select("id")
    .single();
  if (menuError) throw menuError;

  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert({
      name: "Beer & Dine",
      event_type: "beer_dine",
      event_date: "2026-11-14",
      status: "precalculated",
      planned_paying_guests: 50,
      planned_free_guests: 0,
      is_demo: true,
      demo_key: BEER_DINE_KEY,
      notes:
        "Demo-Datensatz. Bekannt sind Ticketerlös und Barfüsser-Anteil; die übrigen Eventkosten sind offen und werden nicht als Null behandelt.",
      created_by: userId,
      updated_by: userId,
    })
    .select("id")
    .single();
  if (eventError) throw eventError;

  // Every row must carry the same keys: PostgREST bulk inserts send NULL for
  // keys missing in a single row, which would violate NOT NULL defaults.
  const rows = demoLines(event.id).map((line) => ({
    planned_unit_amount: null,
    planned_quantity: null,
    actual_unit_amount: null,
    actual_quantity: null,
    is_required: true,
    origin: null,
    assumption_key: null,
    variance_note: null,
    notes: null,
    ...line,
  }));
  const { error: linesError } = await supabase.from("event_lines").insert(rows);
  if (linesError) throw linesError;

  const { error: linkError } = await supabase.from("event_menu_links").insert({
    event_id: event.id,
    menu_id: menu.id,
    snapshot: {
      menu: { id: menu.id, name: "Beer & Dine – 3-Gang-Menü + Apéro", status: "draft", gross_price_per_person: null, vat_rate: 0.081 },
      variants: [],
    },
    created_by: userId,
  });
  if (linkError) throw linkError;

  const { error: seedError } = await supabase
    .from("demo_seeds")
    .upsert({ key: BEER_DINE_KEY, removed_at: null }, { onConflict: "key" });
  if (seedError) throw seedError;

  return event.id;
}

/** Admin removal: deletes the demo and remembers the deliberate removal. */
export async function removeBeerDineDemo() {
  const id = await existingDemoEventId();
  if (id) {
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) throw error;
  }
  const { error: menuError } = await supabase.from("menus").delete().eq("demo_key", BEER_DINE_KEY);
  if (menuError) throw menuError;
  const { error } = await supabase
    .from("demo_seeds")
    .upsert({ key: BEER_DINE_KEY, removed_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
}
