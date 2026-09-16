import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "kundicalc.sidebar.expanded";

/**
 * Desktop-only sidebar preference. Stored locally in the browser, never in the
 * database. Defaults to expanded when no preference exists. The value is read
 * after mount so SSR and hydration agree; `hydrated` lets the layout suppress
 * the opening/closing transition on the very first paint.
 */
export function useSidebarPreference() {
  const [expanded, setExpanded] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "false") setExpanded(false);
    } catch {
      /* storage unavailable – keep the default */
    }
    setHydrated(true);
  }, []);

  const toggle = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* storage unavailable – preference simply is not remembered */
      }
      return next;
    });
  }, []);

  return { expanded, hydrated, toggle };
}
