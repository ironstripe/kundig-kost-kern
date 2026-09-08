import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Settings2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { MenuCardSummary } from "@/components/menu-cards/MenuCardSummary";
import { MenuCardConfigDialog } from "@/components/menu-cards/MenuCardConfigDialog";
import { activeMenuCardQuery } from "@/lib/menu-cards";
import { useAppContext } from "@/lib/app-route";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/_app/einstellungen/konfiguration")({
  head: () => ({
    meta: [
      { title: "Konfiguration – KundiCalc" },
      { name: "description", content: "Zentrale Kalkulationsannahmen der aktiven Speisekarte." },
      { property: "og:title", content: "Konfiguration – KundiCalc" },
      { property: "og:description", content: "Kalkulationsannahmen der aktiven Speisekarte." },
    ],
  }),
  component: ConfigPage,
});

function ConfigPage() {
  const { user } = useAppContext();
  const { data: card, isPending } = useQuery(activeMenuCardQuery);
  const [open, setOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Konfiguration"
        description="Zentrale Annahmen der aktiven Speisekarte: Gültigkeit, Öffnungstage, MWST-Satz (8.1 % für Restaurantkonsum) und Kleinmaterial. Alle aktiven Benutzer dürfen diese Werte anpassen."
      />

      {isPending && <Skeleton className="h-48 w-full" />}

      {!isPending && !card && (
        <EmptyState
          icon={Settings2}
          title="Keine aktive Speisekarte"
          description="Sobald eine aktive Speisekarte existiert, können ihre Kalkulationsannahmen hier eingesehen und bearbeitet werden."
        />
      )}

      {card && (
        <>
          <MenuCardSummary
            card={card}
            actions={
              <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
                Bearbeiten
              </Button>
            }
          />
          {open && (
            <MenuCardConfigDialog card={card} userId={user.id} open={open} onOpenChange={setOpen} />
          )}
          <section className="surface mt-6 px-6 py-5">
            <h2 className="section-title">Grundsätze des Prototyps</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li>Restaurantumsätze werden mit 8.1 % MWST gerechnet; Take-away ist nicht Bestandteil.</li>
              <li>Rechenwerte werden aus den Eingabedaten abgeleitet und nicht redundant gespeichert.</li>
              <li>Intern wird mit höherer Präzision gerechnet; die Oberfläche zeigt CHF auf zwei Dezimalstellen.</li>
              <li>Ausgeschlossene Tage (z. B. Betriebsferien) reduzieren die Anzahl Verkaufstage.</li>
            </ul>
          </section>
        </>
      )}
    </>
  );
}
