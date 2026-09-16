import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { MetricValue } from "@/components/dishes/Metric";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { eventStatusLabels, eventTypeLabels } from "@/lib/event-labels";
import { calculateEvent } from "@/lib/event-costing";
import { eventLinesQuery, eventsQuery } from "@/lib/events";
import { BEER_DINE_KEY, demoSeedQuery, ensureBeerDineDemo } from "@/lib/demo-events";
import { EventDialog } from "@/components/events/EventDialog";
import { useAppContext } from "@/lib/app-route";

export const Route = createFileRoute("/_authenticated/_app/events")({
  head: () => ({
    meta: [
      { title: "Events – KundiCalc" },
      { name: "description", content: "Eventvorkalkulation, Nachkalkulation und Erfahrungswerte." },
      { property: "og:title", content: "Events – KundiCalc" },
      { property: "og:description", content: "Eventvorkalkulation und Nachkalkulation im Kundelfingerhof." },
    ],
  }),
  component: EventsPage,
});

function EventsPage() {
  const { user, profile } = useAppContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: events, isPending, error } = useQuery(eventsQuery);
  const { data: lines } = useQuery(eventLinesQuery);
  const { data: seed } = useQuery(demoSeedQuery(BEER_DINE_KEY));
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const hasDemo = (events ?? []).some((e) => e.demo_key === BEER_DINE_KEY);

  const createDemo = async () => {
    setBusy(true);
    try {
      const id = await ensureBeerDineDemo(user.id, Boolean(seed?.removed_at));
      await qc.invalidateQueries({ queryKey: ["events"] });
      await qc.invalidateQueries({ queryKey: ["event_lines"] });
      await qc.invalidateQueries({ queryKey: ["menus"] });
      if (id) {
        toast.success("Beer & Dine Demo bereitgestellt. Alle Werte sind als Annahmen gekennzeichnet.");
        navigate({ to: "/events/$eventId", params: { eventId: id } });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Demo konnte nicht erstellt werden.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Events"
        description="Kompakte Eventvorkalkulation nach dem Bierdeckel-Prinzip: Erlöse, Menü, Personal, Partner und direkte Kosten. Offene Werte bleiben offen und werden nie als Null gerechnet."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/events/erfahrungswerte">Erfahrungswerte</Link>
            </Button>
            {!hasDemo && (
              <Button variant="outline" onClick={createDemo} disabled={busy}>
                Beer & Dine Demo laden
              </Button>
            )}
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" /> Event anlegen
            </Button>
          </div>
        }
      />

      {isPending && <Skeleton className="h-48 w-full" />}
      {error && <p className="text-sm text-destructive">Events konnten nicht geladen werden.</p>}

      {!isPending && (events ?? []).length === 0 && (
        <EmptyState
          icon={CalendarDays}
          title="Noch keine Events"
          description="Legen Sie einen Event an oder laden Sie die klar gekennzeichnete Beer & Dine Demo."
        />
      )}

      {(events ?? []).length > 0 && (
        <div className="surface overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Zahlende Gäste</TableHead>
                <TableHead className="text-right">DB I</TableHead>
                <TableHead className="text-right">DB II</TableHead>
                <TableHead>Kalkulationsstand</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(events ?? []).map((ev) => {
                const result = calculateEvent((lines ?? []).filter((l) => l.event_id === ev.id), ev);
                return (
                  <TableRow key={ev.id}>
                    <TableCell>
                      <Link to="/events/$eventId" params={{ eventId: ev.id }} className="font-medium hover:underline">
                        {ev.name}
                      </Link>
                      {ev.is_demo && (
                        <StatusBadge tone="muted" className="ml-2">
                          Demo-Annahme
                        </StatusBadge>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(ev.event_date)}</TableCell>
                    <TableCell>{eventTypeLabels[ev.event_type]}</TableCell>
                    <TableCell>
                      <StatusBadge tone={ev.status === "postcalculated" ? "success" : "neutral"}>
                        {eventStatusLabels[ev.status]}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-right tabular">{ev.planned_paying_guests ?? "offen"}</TableCell>
                    <TableCell className="text-right">
                      <MetricValue value={result.contributionMargin1} kind="chf" problems={result.openPositions} />
                    </TableCell>
                    <TableCell className="text-right">
                      <MetricValue value={result.contributionMargin2} kind="chf" problems={result.openPositions} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={result.complete ? "success" : "warning"}>{result.completeness}</StatusBadge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {profile.is_admin && (
        <p className="mt-4 text-xs text-muted-foreground">
          Zentrale Standardannahmen für Events pflegen Sie unter Einstellungen · Konfiguration.
        </p>
      )}

      {open && <EventDialog open={open} onOpenChange={setOpen} userId={user.id} onCreated={(id) => navigate({ to: "/events/$eventId", params: { eventId: id } })} />}
    </>
  );
}
