import {
  LayoutDashboard,
  BookOpen,
  UtensilsCrossed,
  Carrot,
  SlidersHorizontal,
  Settings,
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
  { label: "Speisekarten", to: "/speisekarten", icon: BookOpen },
  { label: "Gerichte", to: "/gerichte", icon: UtensilsCrossed },
  { label: "Zutaten & EK", to: "/zutaten", icon: Carrot },
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
