import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Lightbulb, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/format";
import { eventTypeLabels } from "@/lib/event-labels";
import { eventIdeasQuery, ideaStageLabels, IDEA_STAGES, type IdeaStage } from "@/lib/event-ideas";
import { eventsQuery } from "@/lib/events";
import { EventIdeaDialog } from "@/components/events/EventIdeaDialog";
import { useAppContext } from "@/lib/app-route";

export const Route = createFileRoute("/_authenticated/_app/events/ideen/")({
  head: () => ({
    meta: [
      { title: "Eventideen – KundiCalc" },
      { name: "description", content: "Eventideen erfassen, diskutieren und zur Kalkulation freigeben." },
      { property: "og:title", content: "Eventideen – KundiCalc" },
      { property: "og:description", content: "Von der Idee über die Diskussion zur Bierdeckel-Kalkulation." },
    ],
  }),
  component: IdeasPage,
});

const ALL = "__all__";

function stageTone(stage: IdeaStage) {
  if (stage === "approved_for_calculation") return "success" as const;
  if (stage === "rejected" || stage === "deferred") return "muted" as const;
  return "neutral" as const;
}

function IdeasPage() {
  const { user } = useAppContext();
  const navigate = useNavigate();
  const { data: ideas, isPending, error } = useQuery(eventIdeasQuery);
  const { data: events } = useQuery(eventsQuery);
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<string>(ALL);
  const [search, setSearch] = useState("");

  const list = (ideas ?? []).filter((i) => {
    if (stage !== ALL && i.stage !== stage) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${i.title} ${i.summary} ${i.partner ?? ""} ${i.owner_name ?? ""}`.toLowerCase().includes(q);
  });

  return (
    <>
      <PageHeader
        title="Eventideen"
        description="Ideen festhalten, besprechen und bewusst zur Kalkulation freigeben. Eine Freigabe zur Kalkulation ist keine Freigabe der Durchführung."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/events">Kalkulationen</Link>
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" /> Idee erfassen
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          placeholder="Ideen durchsuchen"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={stage} onValueChange={setStage}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Alle Stufen</SelectItem>
            {IDEA_STAGES.map((s) => (
              <SelectItem key={s} value={s}>
                {ideaStageLabels[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isPending && <Skeleton className="h-48 w-full" />}
      {error && <p className="text-sm text-destructive">Ideen konnten nicht geladen werden.</p>}

      {!isPending && list.length === 0 && (
        <EmptyState
          icon={Lightbulb}
          title="Keine Ideen in dieser Ansicht"
          description="Erfassen Sie eine Idee mit Titel und Kurzbeschreibung. Datum, Gästezahl und Preis dürfen offen bleiben."
        />
      )}

      {list.length > 0 && (
        <div className="surface overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Idee</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>Wunschtermin</TableHead>
                <TableHead className="text-right">Erwartete Gäste</TableHead>
                <TableHead>Stufe</TableHead>
                <TableHead>Kalkulation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((idea) => {
                const linked = (events ?? []).find((e) => e.idea_id === idea.id) ?? null;
                const openIdea = () => navigate({ to: "/events/ideen/$ideaId", params: { ideaId: idea.id } });
                return (
                  <TableRow
                    key={idea.id}
                    onClick={openIdea}
                    className="cursor-pointer"
                    title={`${idea.title} öffnen`}
                  >
                    <TableCell>
                      <Link
                        to="/events/ideen/$ideaId"
                        params={{ ideaId: idea.id }}
                        className="font-medium hover:underline"
                      >
                        {idea.title}
                      </Link>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{idea.summary}</p>
                    </TableCell>
                    <TableCell>{idea.event_type ? eventTypeLabels[idea.event_type] : "Noch offen"}</TableCell>
                    <TableCell>
                      {idea.desired_date ? formatDate(idea.desired_date) : (idea.desired_period ?? "Offen")}
                    </TableCell>
                    <TableCell className="text-right tabular">{idea.expected_guests ?? "offen"}</TableCell>
                    <TableCell>
                      <StatusBadge tone={stageTone(idea.stage)}>{ideaStageLabels[idea.stage]}</StatusBadge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {linked ? (
                        <Link
                          to="/events/$eventId"
                          params={{ eventId: linked.id }}
                          className="text-sm hover:underline"
                        >
                          Kalkulation öffnen
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">Keine</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Link
                        to="/events/ideen/$ideaId"
                        params={{ ideaId: idea.id }}
                        className="text-sm font-medium hover:underline"
                      >
                        Details
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {open && (
        <EventIdeaDialog
          open={open}
          onOpenChange={setOpen}
          userId={user.id}
          onCreated={(id) => navigate({ to: "/events/ideen/$ideaId", params: { ideaId: id } })}
        />
      )}
    </>
  );
}
