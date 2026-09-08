import {
  LayoutDashboard,
  BookOpen,
  UtensilsCrossed,
  Carrot,
  SlidersHorizontal,
  Settings,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  children?: { label: string; to: string; adminOnly?: boolean }[];
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Übersicht", to: "/uebersicht", icon: LayoutDashboard },
  { label: "Speisekarten", to: "/speisekarten", icon: BookOpen, children: [{ label: "Speisekarte importieren", to: "/speisekarten/importieren" }] },
  { label: "Gerichte", to: "/gerichte", icon: UtensilsCrossed, children: [{ label: "Add-ons", to: "/gerichte/add-ons" }] },
  { label: "Zutaten & EK", to: "/zutaten", icon: Carrot, children: [{ label: "Excel importieren", to: "/zutaten/importieren" }] },
  { label: "Verkaufsmengen", to: "/verkaufsmengen", icon: BarChart3 },
  { label: "Szenario", to: "/szenario", icon: SlidersHorizontal },
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
