import { createFileRoute } from "@tanstack/react-router";
import { SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { MenuCardSelector } from "@/components/menu-cards/MenuCardSelector";

export const Route = createFileRoute("/_authenticated/_app/szenario")({
  head: () => ({
    meta: [
      { title: "Szenario – KundiCalc" },
      { name: "description", content: "Szenarien über die Laufzeit der Speisekarte vergleichen." },
      { property: "og:title", content: "Szenario – KundiCalc" },
      { property: "og:description", content: "Szenarien vergleichen." },
    ],
  }),
  component: ScenarioPage,
});

function ScenarioPage() {
  return (
    <>
      <PageHeader
        title="Szenario"
        description="Das Szenario zeigt später Umsatz, Wareneinsatz und DB I über die gesamte Laufzeit der Karte – abgeleitet aus Öffnungstagen, erwarteten Verkaufsmengen und Einkaufspreisen."
      />
      <MenuCardSelector className="mb-4" />
      <EmptyState
        icon={SlidersHorizontal}
        title="Noch keine Szenario-Berechnung"
        description="Sobald Gerichte, Varianten und Zutatenmengen erfasst sind, lassen sich hier Mengen-, Einkaufs- und Verkaufspreisänderungen durchspielen."
        hint="Es werden keine erfundenen Zahlen angezeigt. Berechnungen folgen im nächsten Ausbauschritt."
      />
    </>
  );
}
