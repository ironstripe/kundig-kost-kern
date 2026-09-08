import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { BookOpen, Info, UtensilsCrossed, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { MenuCardSelector } from "@/components/menu-cards/MenuCardSelector";
import { ASSUMPTION_NOTICE, DataQualityPanel, KpiCards, SecondaryCounts } from "@/components/dashboard/DashboardPanels";
import { ContributionTable } from "@/components/dashboard/ContributionTable";
import { CategorySummaryTable } from "@/components/dashboard/CategorySummaryTable";
import { TopContributorsChart } from "@/components/dashboard/TopContributorsChart";
import { menuCardDataQuery } from "@/lib/menu-cards";
import { calculateMenuTotals } from "@/lib/menu-totals";
import { useSelectedMenuCard } from "@/lib/selected-menu-card";
import { useAppContext } from "@/lib/app-route";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/_app/uebersicht")({
  head: () => ({
    meta: [
      { title: "Übersicht – KundiCalc" },
      { name: "description", content: "Erwartete Gesamtwirtschaftlichkeit der aktiven Speisekarte: Umsatz, Wareneinsatz und DB I." },
      { property: "og:title", content: "Übersicht – KundiCalc" },
      { property: "og:description", content: "Gesamtwirtschaftlichkeit der Speisekarte." },
    ],
  }),
  component: OverviewPage,
});

const SCENARIO_LABEL = "Erwartetes Szenario auf Basis manueller oder angenommener Verkaufsmengen";

function OverviewPage() {
  const { profile } = useAppContext();
  const { data: card, isPending: cardsPending, error: cardsError } = useSelectedMenuCard();
  const { data, isPending, error } = useQuery({ ...menuCardDataQuery(card?.id ?? ""), enabled: !!card });
  const totals = useMemo(() => (data ? calculateMenuTotals(data) : null), [data]);

  const firstName = profile.display_name.split(" ")[0];

  return (
    <>
      <PageHeader title={`Guten Tag, ${firstName}`} description={SCENARIO_LABEL} />
      <MenuCardSelector className="mb-4" />

      {(cardsPending || (card && isPending)) && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {(cardsError || error) && (
        <div className="surface px-6 py-8 text-center">
          <p className="text-sm text-destructive">Die Auswertung konnte nicht geladen werden.</p>
          <p className="mt-1 text-xs text-muted-foreground">Bitte Seite neu laden. Bleibt der Fehler bestehen, sind möglicherweise keine Zugriffsrechte vorhanden.</p>
        </div>
      )}

      {!cardsPending && !card && !cardsError && (
        <EmptyState icon={BookOpen} title="Keine Speisekarte" description="Legen Sie eine Speisekarte mit Laufzeit und Öffnungstagen an. Die Übersicht wertet immer die ausgewählte Karte aus.">
          <Button asChild><Link to="/speisekarten">Speisekarte anlegen</Link></Button>
        </EmptyState>
      )}

      {card && data && totals && (
        <div className="space-y-4">
          {/* Header strip */}
          <div className="surface flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
              <span className="font-semibold">{card.name}</span>
              <span className="tabular text-muted-foreground">{formatDate(card.valid_from)} – {formatDate(card.valid_to)}</span>
              <span><span className="text-muted-foreground">Verkaufstage</span> <span className="tabular font-semibold">{totals.sellingDays}</span></span>
              <Link to="/speisekarten/$menuCardId" params={{ menuCardId: card.id }} className="text-xs font-medium text-primary hover:underline">Karte öffnen</Link>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {totals.complete ? (
                <StatusBadge tone="success">Auswertung vollständig</StatusBadge>
              ) : (
                <StatusBadge tone="warning">Teilauswertung – {totals.excludedLines.length} ausgeschlossen</StatusBadge>
              )}
              {totals.counts.reviewed > 0 && <StatusBadge tone="success">{totals.counts.reviewed} geprüft</StatusBadge>}
              {totals.counts.estimated + totals.counts.partiallyReviewed > 0 && (
                <StatusBadge tone="warning">{totals.counts.estimated + totals.counts.partiallyReviewed} geschätzt</StatusBadge>
              )}
              {totals.counts.incomplete > 0 && <StatusBadge tone="muted">{totals.counts.incomplete} unvollständig</StatusBadge>}
            </div>
          </div>

          {totals.hasAssumptions && (
            <p className="flex items-start gap-2 rounded-md border border-border bg-secondary/40 px-4 py-2.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" /> {ASSUMPTION_NOTICE} Geschätzte Werte stammen aus angenommenen Einkaufspreisen, Rezeptmengen oder Demo-Verkaufsmengen.
            </p>
          )}

          {/* States */}
          {totals.sellingDays === 0 && (
            <StateNotice title="Keine Verkaufstage">
              In der Laufzeit liegt kein Öffnungstag ohne Schliesstag. Gesamtmengen und Summen können nicht berechnet werden.{" "}
              <Link to="/speisekarten/$menuCardId" params={{ menuCardId: card.id }} className="underline">Laufzeit und Öffnungstage prüfen</Link>.
            </StateNotice>
          )}
          {totals.counts.dishes === 0 && (
            <EmptyState icon={UtensilsCrossed} title="Keine Gerichte auf dieser Karte" description="Erfassen Sie Gerichte mit Varianten und Kalkulationspositionen, damit die Übersicht Werte zeigen kann.">
              <Button asChild variant="outline"><Link to="/gerichte">Zu den Gerichten</Link></Button>
            </EmptyState>
          )}
          {totals.counts.dishes > 0 && totals.sellingDays > 0 && !totals.hasSalesQuantities && (
            <StateNotice title="Keine Verkaufsmengen">
              Für keine Position ist ein erwarteter Absatz grösser als 0 erfasst. Umsatz und DB I über die Laufzeit sind deshalb 0.{" "}
              <Link to="/verkaufsmengen" className="underline">Verkaufsmengen planen</Link>.
            </StateNotice>
          )}

          {totals.counts.dishes > 0 && (
            <>
              <KpiCards overall={totals.overall} />
              <SecondaryCounts counts={totals.counts} />

              {totals.excludedLines.length > 0 && (
                <details className="surface px-5 py-3 text-sm">
                  <summary className="cursor-pointer font-medium">
                    <AlertTriangle className="mr-1 inline size-4 text-warning-foreground" />
                    {totals.excludedLines.length} {totals.excludedLines.length === 1 ? "Position ist" : "Positionen sind"} nicht in den Summen enthalten
                  </summary>
                  <p className="mt-2 text-xs text-muted-foreground">Unvollständige Werte werden nicht als 0 gezählt. Die Summen sind deshalb eine Teilauswertung.</p>
                  <ul className="mt-2 space-y-1 text-xs">
                    {totals.excludedLines.map((l) => (
                      <li key={l.key} className="flex flex-wrap gap-x-2">
                        <span className="font-medium">
                          {l.kind === "add_on" ? `${l.name} (Add-on)` : `${l.dishName} – ${l.name}`}
                        </span>
                        <span className="text-muted-foreground">{l.exclusionReasons.join("; ")}</span>
                        {l.result.hasEstimatedPrices && l.exclusionReasons.some((r) => r.includes("Einkaufspreis")) && (
                          <Link to="/zutaten" className="text-primary underline">Zutaten & EK</Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                <TopContributorsChart lines={totals.includedLines} />
                <DataQualityPanel quality={totals.quality} />
              </div>

              <ContributionTable lines={totals.includedLines} />
              <CategorySummaryTable categories={totals.categories} />

              <p className="text-xs text-muted-foreground">
                DB I = Nettoumsatz minus Wareneinsatz (Zutaten inkl. Kleinmaterial). DB I ist kein Gewinn: Personal, Miete, Energie und weitere Kosten sind nicht berücksichtigt.
              </p>
            </>
          )}
        </div>
      )}
    </>
  );
}

function StateNotice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
      <span className="font-medium">{title}: </span>
      {children}
    </div>
  );
}
