/**
 * Selected menu card – shared across Übersicht, Speisekarten, Gerichte,
 * Verkaufsmengen and Szenario. The selection lives in the browser only
 * (localStorage); it defaults to the most recent active card.
 */
import { useCallback, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { menuCardsQuery, type MenuCard } from "@/lib/menu-cards";

const KEY = "kundicalc.selectedMenuCard";
const listeners = new Set<() => void>();

function read(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function write(id: string | null) {
  try {
    if (id) window.localStorage.setItem(KEY, id);
    else window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => e.key === KEY && l();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function resolveSelectedCard(cards: MenuCard[] | undefined, storedId: string | null): MenuCard | null {
  if (!cards || cards.length === 0) return null;
  const stored = storedId ? cards.find((c) => c.id === storedId) : undefined;
  if (stored) return stored;
  const active = [...cards].filter((c) => c.is_active).sort((a, b) => b.valid_from.localeCompare(a.valid_from));
  return active[0] ?? cards[0] ?? null;
}

/**
 * Drop-in replacement for `useQuery(activeMenuCardQuery)`: `data` is the
 * currently selected menu card.
 */
export function useSelectedMenuCard() {
  const storedId = useSyncExternalStore(subscribe, read, () => null);
  const { data: cards, isPending, error } = useQuery(menuCardsQuery);
  const card = resolveSelectedCard(cards, storedId);
  const select = useCallback((id: string | null) => write(id), []);
  return { data: card, cards: cards ?? [], isPending, error, select, isExplicit: !!storedId && card?.id === storedId };
}

/** Menu card a dish or add-on belongs to (falls back to the selected card). */
export function useMenuCardFor(menuCardId: string | null | undefined) {
  const sel = useSelectedMenuCard();
  const card = menuCardId ? (sel.cards.find((c) => c.id === menuCardId) ?? sel.data) : sel.data;
  return { ...sel, data: card };
}
