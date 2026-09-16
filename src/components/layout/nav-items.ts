import {
  LayoutDashboard,
  BookOpen,
  UtensilsCrossed,
  Carrot,
  SlidersHorizontal,
  Settings,
  BarChart3,
  ClipboardList,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";

export type NavChild = {
  label: string;
  to: string;
  adminOnly?: boolean;
  search?: Record<string, string>;
};

export type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  children?: NavChild[];
};

/** Shared source of truth for desktop and mobile navigation. */
export const NAV_ITEMS: NavItem[] = [
  { label: "Übersicht", to: "/uebersicht", icon: LayoutDashboard },
  {
    label: "Gerichte",
    to: "/gerichte",
    icon: UtensilsCrossed,
    children: [
      { label: "Add-ons", to: "/gerichte/add-ons" },
      { label: "Gerichte aus Speisekarte übernehmen", to: "/speisekarten/importieren", search: { from: "gerichte" } },
    ],
  },
  { label: "Menüs", to: "/menues", icon: ClipboardList },
  {
    label: "Events",
    to: "/events",
    icon: CalendarDays,
    children: [
      { label: "Ideen", to: "/events/ideen" },
      { label: "Kalkulationen", to: "/events" },
      { label: "Erfahrungswerte", to: "/events/erfahrungswerte" },
    ],
  },
  { label: "Zutaten & EK", to: "/zutaten", icon: Carrot, children: [{ label: "Excel importieren", to: "/zutaten/importieren" }] },
  { label: "Verkaufsmengen", to: "/verkaufsmengen", icon: BarChart3 },
  { label: "Szenario", to: "/szenario", icon: SlidersHorizontal },
  { label: "Speisekarten", to: "/speisekarten", icon: BookOpen, children: [{ label: "Speisekarte importieren", to: "/speisekarten/importieren" }] },
  {
    label: "Einstellungen",
    to: "/einstellungen",
    icon: Settings,
    children: [
      { label: "Benutzer", to: "/einstellungen/benutzer", adminOnly: true },
      { label: "Konfiguration", to: "/einstellungen/konfiguration" },
    ],
  },
];

