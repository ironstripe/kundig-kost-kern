import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LineChart } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatNumber } from "@/lib/format";
import { eventTypeLabels } from "@/lib/event-labels";
import { eventLinesQuery, eventsQuery } from "@/lib/events";
import { buildExperience, type ExperienceMetric } from "@/lib/event-experience";

export const Route = createFileRoute("/_authenticated/_app/events/erfahrungswerte")({
  head: () => ({
    meta: [
      { title: "Erfahrungswerte – KundiCalc" },
      { name: "description", content: "Beobachtete Werte aus durchgeführten Events, nach Eventtyp." },
      { property: "og:title", content: "Erfahrungswerte – KundiCalc" },
      { property: "og:description", content: "Beobachtete Werte aus durchgeführten Events." },
    ],
  }),
  component: ExperiencePage,
});

function unitLabel(unit: ExperienceMetric["unit"]): string {
  switch (unit) {
    case "chf_per_guest":
      return "CHF pro Gast";
    case "chf":
      return "CHF";
    case "hours":
      return "Stunden";
    case "hours_per_guest":
      return "Stunden pro Gast";
    default:
      return "%";
  }
}

function value(v: number | null): string {
  return v === null ? "–" : formatNumber(v, 2);
}

function ExperiencePage() {
  const { data: events, isPending } = useQuery(eventsQuery);
  const { data: lines } = useQuery(eventLinesQuery);
  const groups = buildExperience(events ?? [], lines ?? []);

  return (
    <>
      <PageHeader
        title="Erfahrungswerte"
        description="Beobachtete Werte aus durchgeführten Events, gruppiert nach Eventtyp. Diese Werte verändern keine Standardannahmen automatisch – eine Übernahme erfolgt immer bewusst in der Konfiguration."
      />

      {isPending && <Skeleton className="h-48 w-full" />}

      {!isPending && groups.length === 0 && (
        <EmptyState
          icon={LineChart}
          title="Noch keine abgeschlossenen Events"
          description="Sobald Events durchgeführt und nachkalkuliert sind, erscheinen hier Durchschnitts-, Minimal- und Maximalwerte."
        />
      )}

      {groups.map((g) => (
        <section key={g.type} className="surface mb-6">
          <div className="border-b px-5 py-3">
            <h2 className="text-sm font-semibold">{eventTypeLabels[g.type]}</h2>
            <p className="text-xs text-muted-foreground">
              {g.events.length} {g.events.length === 1 ? "Event" : "Events"} · Beobachtungszeitraum {formatDate(g.from)} bis {formatDate(g.to)}
            </p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kennzahl</TableHead>
                  <TableHead>Einheit</TableHead>
                  <TableHead className="text-right">Beobachtungen</TableHead>
                  <TableHead className="text-right">Durchschnitt</TableHead>
                  <TableHead className="text-right">Minimum</TableHead>
                  <TableHead className="text-right">Maximum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {g.metrics.map((m) => (
                  <TableRow key={m.key}>
                    <TableCell className="font-medium">{m.label}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{unitLabel(m.unit)}</TableCell>
                    <TableCell className="text-right tabular">{m.count}</TableCell>
                    <TableCell className="text-right tabular">{value(m.average)}</TableCell>
                    <TableCell className="text-right tabular">{value(m.min)}</TableCell>
                    <TableCell className="text-right tabular">{value(m.max)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      ))}
    </>
  );
}
