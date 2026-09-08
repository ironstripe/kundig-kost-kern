import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Carrot, UtensilsCrossed, SlidersHorizontal, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { activeMenuCardQuery } from "@/lib/menu-cards";
import { formatDate } from "@/lib/format";
import { useAppContext } from "@/lib/app-route";

export const Route = createFileRoute("/_authenticated/_app/uebersicht")({
  head: () => ({
    meta: [
      { title: "Übersicht – KundiCalc" },
      { name: "description", content: "Einstieg in die Kalkulation des Kundelfingerhofs." },
      { property: "og:title", content: "Übersicht – KundiCalc" },
      { property: "og:description", content: "Einstieg in die Kalkulation." },
    ],
  }),
  component: OverviewPage,
});

const steps = [
  {
    icon: BookOpen,
    title: "Speisekarte anlegen",
    text: "Laufzeit, Öffnungstage und MWST-Satz der aktuellen Karte festhalten.",
    to: "/speisekarten",
  },
  {
    icon: UtensilsCrossed,
    title: "Gerichte und Varianten erfassen",
    text: "Kleine und grosse Portionen sowie Add-ons als eigene Varianten führen.",
    to: "/gerichte",
  },
  {
    icon: Carrot,
    title: "Zutaten und Einkaufspreise pflegen",
    text: "Gebindegrössen und aktuelle EK-Preise zentral hinterlegen.",
    to: "/zutaten",
  },
  {
    icon: SlidersHorizontal,
    title: "Szenarien vergleichen",
    text: "Auswirkungen von Mengen- und Preisänderungen später hier prüfen.",
    to: "/szenario",
  },
] as const;

function OverviewPage() {
  const { profile } = useAppContext();
  const { data: card } = useQuery(activeMenuCardQuery);

  return (
    <>
      <PageHeader
        title={`Guten Tag, ${profile.display_name.split(" ")[0]}`}
        description="KundiCalc zeigt künftig Wareneinsatz, Deckungsbeitrag I und Marge pro Gericht und über die Laufzeit der Karte. Aktuell ist die Grundlage eingerichtet; Kalkulationswerte folgen in einem nächsten Schritt."
      />

      <div className="surface mb-8 flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="section-title">Aktive Speisekarte</div>
          {card ? (
            <>
              <div className="mt-1 text-base font-semibold">{card.name}</div>
              <div className="text-sm text-muted-foreground tabular">
                {formatDate(card.valid_from)} – {formatDate(card.valid_to)}
              </div>
            </>
          ) : (
            <div className="mt-1 text-sm text-muted-foreground">Noch keine aktive Karte.</div>
          )}
        </div>
        <Link
          to="/speisekarten"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          Zu den Speisekarten <ArrowRight className="size-4" />
        </Link>
      </div>

      <h2 className="section-title mb-3">Nächste Schritte</h2>
      <ol className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {steps.map((s, i) => (
          <li key={s.to}>
            <Link
              to={s.to}
              className="surface flex h-full items-start gap-4 px-5 py-4 transition-colors hover:bg-accent/40"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <s.icon className="size-4" strokeWidth={1.75} />
              </span>
              <span>
                <span className="block text-sm font-medium">
                  {i + 1}. {s.title}
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">{s.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}
