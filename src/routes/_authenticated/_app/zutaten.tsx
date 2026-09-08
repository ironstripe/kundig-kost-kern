import { createFileRoute } from "@tanstack/react-router";
import { Carrot } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";

export const Route = createFileRoute("/_authenticated/_app/zutaten")({
  head: () => ({
    meta: [
      { title: "Zutaten & EK – KundiCalc" },
      { name: "description", content: "Zutaten und aktuelle Einkaufspreise zentral pflegen." },
      { property: "og:title", content: "Zutaten & EK – KundiCalc" },
      { property: "og:description", content: "Zutaten und Einkaufspreise." },
    ],
  }),
  component: IngredientsPage,
});

function IngredientsPage() {
  return (
    <>
      <PageHeader
        title="Zutaten & EK"
        description="Zutaten werden mit Gebindegrösse, Gebindepreis und Basiseinheit (g, ml, Stück) zentral geführt. Der Prototyp überschreibt Einkaufspreise; es gibt keine Preisversionen."
      />
      <EmptyState
        icon={Carrot}
        title="Noch keine Zutaten erfasst"
        description="Hier entsteht die zentrale Zutatenliste mit Lieferant, Gebinde, Einkaufspreis in CHF und Preisstatus (geschätzt oder bestätigt)."
        hint="Manuelle Erfassung und Excel-Import folgen im nächsten Ausbauschritt."
      />
    </>
  );
}
