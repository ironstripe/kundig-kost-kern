import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { MenuCardSummary } from "@/components/menu-cards/MenuCardSummary";
import { menuCardsQuery } from "@/lib/menu-cards";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/_app/speisekarten")({
  head: () => ({
    meta: [
      { title: "Speisekarten – KundiCalc" },
      { name: "description", content: "Speisekarten des Kundelfingerhofs mit Laufzeit und Annahmen." },
      { property: "og:title", content: "Speisekarten – KundiCalc" },
      { property: "og:description", content: "Speisekarten mit Laufzeit und Annahmen." },
    ],
  }),
  component: MenuCardsPage,
});

function MenuCardsPage() {
  const { data: cards, isPending, error } = useQuery(menuCardsQuery);

  return (
    <>
      <PageHeader
        title="Speisekarten"
        description="Eine Speisekarte bündelt Laufzeit, Öffnungstage und zentrale Kalkulationsannahmen. Später werden hier Karten als PDF oder Bild hochgeladen und strukturiert."
      />

      {isPending && <Skeleton className="h-48 w-full" />}
      {error && <p className="text-sm text-destructive">Speisekarten konnten nicht geladen werden.</p>}

      {cards && cards.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title="Noch keine Speisekarte"
          description="Sobald eine Speisekarte angelegt ist, erscheint sie hier mit Laufzeit, Öffnungstagen und Annahmen."
        />
      )}

      {cards && cards.length > 0 && (
        <div className="space-y-6">
          {cards.map((card) => (
            <MenuCardSummary
              key={card.id}
              card={card}
              actions={
                <Link
                  to="/einstellungen/konfiguration"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Konfiguration
                </Link>
              }
            />
          ))}
          <p className="text-xs text-muted-foreground">
            Gerichte, Varianten und Kategorien dieser Karte werden in einem nächsten Schritt erfasst.
          </p>
        </div>
      )}
    </>
  );
}
