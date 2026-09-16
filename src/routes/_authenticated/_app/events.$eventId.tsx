import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDate } from "@/lib/format";
import { eventStatusLabels, eventTypeLabels } from "@/lib/event-labels";
import { calculateEvent } from "@/lib/event-costing";
import {
  deleteEvent,
  deleteEventLine,
  eventLinesForQuery,
  eventMenuLinksQuery,
  eventMenuVariantsQuery,
  eventQuery,
  type EventLineRow,
} from "@/lib/events";
import { EventDialog } from "@/components/events/EventDialog";
import { EventLineDialog } from "@/components/events/EventLineDialog";
import { EventSections } from "@/components/events/EventSections";
import { EventCompletenessPanel, EventResultPanel } from "@/components/events/EventResultPanels";
import { EventMenuPanel } from "@/components/events/EventMenuPanel";
import { EventAssumptionsPanel } from "@/components/events/EventAssumptionsPanel";
import { EventPostCalculation } from "@/components/events/EventPostCalculation";
import { useAppContext } from "@/lib/app-route";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/_app/events/$eventId")({
  head: () => ({
    meta: [
      { title: "Eventkalkulation – KundiCalc" },
      { name: "description", content: "Bierdeckel-Vorkalkulation und Nachkalkulation eines Events." },
      { property: "og:title", content: "Eventkalkulation – KundiCalc" },
      { property: "og:description", content: "Vorkalkulation und Plan-Ist-Vergleich eines Events." },
    ],
  }),
  component: EventDetailPage,
});

function EventDetailPage() {
  const { eventId } = Route.useParams();
  const { user } = useAppContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: event, isPending } = useQuery(eventQuery(eventId));
  const { data: lines } = useQuery(eventLinesForQuery(eventId));
  const { data: links } = useQuery(eventMenuLinksQuery);
  const { data: menuVariants } = useQuery(eventMenuVariantsQuery);

  const [editEvent, setEditEvent] = useState(false);
  const [lineDialog, setLineDialog] = useState<{ line?: EventLineRow; kind?: Database["public"]["Enums"]["event_line_kind"]; actual?: boolean } | null>(null);
  const [toDelete, setToDelete] = useState<EventLineRow | null>(null);
  const [deleteEventOpen, setDeleteEventOpen] = useState(false);

  if (isPending) return <Skeleton className="h-64 w-full" />;
  if (!event) return <p className="text-sm text-muted-foreground">Event nicht gefunden.</p>;

  const result = calculateEvent(lines ?? [], event);
  const link = (links ?? []).find((l) => l.event_id === event.id) ?? null;
  const evMenuVariants = (menuVariants ?? []).filter((v) => v.event_id === event.id);

  const removeLine = async () => {
    if (!toDelete) return;
    await deleteEventLine(toDelete.id);
    await qc.invalidateQueries({ queryKey: ["event_lines"] });
    setToDelete(null);
    toast.success("Position gelöscht.");
  };

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-3 -ml-2" asChild>
        <Link to="/events">
          <ArrowLeft className="size-4" /> Alle Events
        </Link>
      </Button>

      <PageHeader
        title={event.name}
        description={`${eventTypeLabels[event.event_type]} · ${formatDate(event.event_date)} · geplant ${event.planned_paying_guests ?? "offen"} zahlende und ${event.planned_free_guests ?? "offen"} Gratisgäste`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {event.is_demo && <StatusBadge tone="muted">Demo-Annahme</StatusBadge>}
            <StatusBadge>{eventStatusLabels[event.status]}</StatusBadge>
            <Button variant="outline" onClick={() => setEditEvent(true)}>
              Bearbeiten
            </Button>
            <Button variant="ghost" onClick={() => setDeleteEventOpen(true)}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        }
      />

      {event.notes && <p className="mb-6 text-sm text-muted-foreground">{event.notes}</p>}

      <Tabs defaultValue="vor">
        <TabsList>
          <TabsTrigger value="vor">Vorkalkulation</TabsTrigger>
          <TabsTrigger value="nach">Nachkalkulation</TabsTrigger>
          <TabsTrigger value="annahmen">Annahmen</TabsTrigger>
        </TabsList>

        <TabsContent value="vor" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <EventCompletenessPanel result={result} />
            <EventResultPanel result={result} />
          </div>
          <EventMenuPanel event={event} link={link} variants={evMenuVariants} userId={user.id} />
          <EventSections
            result={result}
            onAdd={(kind) => setLineDialog({ kind })}
            onEdit={(line) => setLineDialog({ line })}
            onDelete={(line) => setToDelete(line)}
          />
        </TabsContent>

        <TabsContent value="nach">
          <EventPostCalculation
            event={event}
            lines={lines ?? []}
            planned={result}
            onEditLine={(line) => setLineDialog({ line, actual: true })}
          />
        </TabsContent>

        <TabsContent value="annahmen">
          <EventAssumptionsPanel event={event} />
        </TabsContent>
      </Tabs>

      {editEvent && <EventDialog open={editEvent} onOpenChange={setEditEvent} userId={user.id} event={event} />}

      {lineDialog && (
        <EventLineDialog
          open
          onOpenChange={(o) => !o && setLineDialog(null)}
          eventId={event.id}
          line={lineDialog.line}
          defaultKind={lineDialog.kind}
          actualMode={lineDialog.actual}
        />
      )}

      <AlertDialog open={Boolean(toDelete)} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Position löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              «{toDelete?.name}» wird aus dieser Eventkalkulation entfernt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={removeLine}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteEventOpen} onOpenChange={setDeleteEventOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Event löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              «{event.name}» wird mit allen Positionen, der Menüverknüpfung und den Eventannahmen gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await deleteEvent(event.id);
                await qc.invalidateQueries({ queryKey: ["events"] });
                toast.success("Event gelöscht.");
                navigate({ to: "/events" });
              }}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
