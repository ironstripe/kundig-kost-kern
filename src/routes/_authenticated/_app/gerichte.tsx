import { createFileRoute } from "@tanstack/react-router";
import { UtensilsCrossed } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";

export const Route = createFileRoute("/_authenticated/_app/gerichte")({
  head: () => ({
    meta: [
      { title: "Gerichte – KundiCalc" },
      { name: "description", content: "Gerichte und Portionsvarianten der Speisekarte." },
      { property: "og:title", content: "Gerichte – KundiCalc" },
      { property: "og:description", content: "Gerichte und Portionsvarianten." },
    ],
  }),
  component: DishesPage,
});

function DishesPage() {
  return (
    <>
      <PageHeader
        title="Gerichte"
        description="Jedes Gericht enthält verkaufbare Varianten – etwa kleine und grosse Portionen – sowie kostenpflichtige Add-ons. Jede Variante erhält eigene Kalkulationspositionen."
      />
      <EmptyState
        icon={UtensilsCrossed}
        title="Noch keine Gerichte erfasst"
        description="Hier erscheinen die Gerichte der aktiven Speisekarte, gruppiert nach Kategorie, mit ihren Varianten, Bruttopreisen und dem Kalkulationsstatus."
        hint="Die Erfassung – manuell oder per Import – folgt im nächsten Ausbauschritt."
      />
    </>
  );
}
