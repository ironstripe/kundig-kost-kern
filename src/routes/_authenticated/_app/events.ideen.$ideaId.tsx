import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/format";
import { eventTypeLabels } from "@/lib/event-labels";
import {
  addIdeaNote,
  createEventFromIdea,
  eventIdeaQuery,
  ideaNotesQuery,
  ideaStageLabels,
  IDEA_STAGES,
  setIdeaStage,
  type IdeaStage,
} from "@/lib/event-ideas";
import { eventsQuery, fetchEvent } from "@/lib/events";
import { copyDefaultsToEvent, eventAssumptionsQuery } from "@/lib/event-assumptions";
import { EventIdeaDialog } from "@/components/events/EventIdeaDialog";
import { useAppContext } from "@/lib/app-route";

export const Route = createFileRoute("/_authenticated/_app/events/ideen/$ideaId")({
  head: () => ({
    meta: [
      { title: "Eventidee – KundiCalc" },
      { name: "description", content: "Eine Eventidee besprechen, freigeben und daraus einen Bierdeckel erstellen." },
      { property: "og:title", content: "Eventidee – KundiCalc" },
      { property: "og:description", content: "Diskussion, Freigabe zur Kalkulation und verknüpfter Bierdeckel." },
    ],
  }),
  component: IdeaDetailPage,
});

function IdeaDetailPage() {
  const { ideaId } = Route.useParams();
  const { user } = useAppContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: idea, isPending } = useQuery(eventIdeaQuery(ideaId));
  const { data: notes } = useQuery(ideaNotesQuery(ideaId));
  const { data: events } = useQuery(eventsQuery);
  const { data: assumptions } = useQuery(eventAssumptionsQuery);
  const [edit, setEdit] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  if (isPending) return <Skeleton className="h-64 w-full" />;
  if (!idea) return <p className="text-sm text-muted-foreground">Idee nicht gefunden.</p>;

  const linked = (events ?? []).find((e) => e.idea_id === idea.id) ?? null;

  const changeStage = async (stage: IdeaStage) => {
    setBusy(true);
    try {
      await setIdeaStage(idea, stage, user.id);
      await qc.invalidateQueries({ queryKey: ["event_ideas"] });
      toast.success(`Stufe geändert: ${ideaStageLabels[stage]}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Stufe konnte nicht geändert werden.");
    } finally {
      setBusy(false);
    }
  };

  /**
   * One deliberate action. Approval for calculation and creation happen
   * atomically server-side; the execution approval stays a separate decision.
   */
  const createCalculation = async (approve: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const id = await createEventFromIdea(idea.id, approve);
      setCreatedId(id);
      const created = await fetchEvent(id);
      if (created) await copyDefaultsToEvent(id, assumptions ?? [], created.event_type);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["events"] }),
        qc.invalidateQueries({ queryKey: ["event_ideas"] }),
        qc.invalidateQueries({ queryKey: ["event_assumption_values", id] }),
      ]);
      navigate({ to: "/events/$eventId", params: { eventId: id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kalkulation konnte nicht erstellt werden.");
    } finally {
      setBusy(false);
    }
  };

  const saveNote = async () => {
    if (!note.trim()) return;
    setBusy(true);
    try {
      await addIdeaNote(idea.id, note.trim(), user.id);
      await qc.invalidateQueries({ queryKey: ["event_idea_notes", idea.id] });
      setNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Notiz konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  };

  const facts: { label: string; value: string }[] = [
    { label: "Eventformat", value: idea.event_type ? eventTypeLabels[idea.event_type] : "Noch offen" },
    { label: "Zielgruppe", value: idea.target_audience ?? "Offen" },
    { label: "Wunschdatum", value: idea.desired_date ? formatDate(idea.desired_date) : "Offen" },
    { label: "Zeitraum", value: idea.desired_period ?? "Offen" },
    { label: "Erwartete Gäste", value: idea.expected_guests === null ? "Offen" : String(idea.expected_guests) },
    { label: "Partner", value: idea.partner ?? "Offen" },
    { label: "Verantwortlich", value: idea.owner_name ?? "Offen" },
  ];

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-3 -ml-2" asChild>
        <Link to="/events/ideen">
          <ArrowLeft className="size-4" /> Alle Ideen
        </Link>
      </Button>

      <PageHeader
        title={idea.title}
        description={idea.summary}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={idea.stage === "approved_for_calculation" ? "success" : "neutral"}>
              {ideaStageLabels[idea.stage]}
            </StatusBadge>
            <Select value={idea.stage} onValueChange={(v) => changeStage(v as IdeaStage)}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IDEA_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {ideaStageLabels[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setEdit(true)}>
              Bearbeiten
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface px-5 py-4">
          <h2 className="section-title">Eckdaten</h2>
          <dl className="mt-3 grid gap-2 text-sm">
            {facts.map((f) => (
              <div key={f.label} className="flex justify-between gap-3 border-b pb-1.5 last:border-b-0">
                <dt className="text-muted-foreground">{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
          {idea.calc_approved_at && (
            <p className="mt-3 text-xs text-muted-foreground">
              Zur Kalkulation freigegeben am {formatDate(idea.calc_approved_at.slice(0, 10))}. Das ist keine Freigabe
              der Durchführung.
            </p>
          )}
        </section>

        <section className="surface px-5 py-4">
          <h2 className="section-title">Kalkulation</h2>
          {linked || createdId ? (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                Mit dieser Idee ist eine Kalkulation verknüpft. Änderungen an der Idee verändern sie nicht.
              </p>
              <Button className="mt-3" asChild>
                <Link to="/events/$eventId" params={{ eventId: (linked?.id ?? createdId)! }}>
                  Kalkulation öffnen
                </Link>
              </Button>
            </>
          ) : idea.stage === "approved_for_calculation" ? (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                Übernommen werden nur bekannte Angaben. Unbekannte Werte bleiben offen und werden nie als Null
                gerechnet.
              </p>
              <Button className="mt-3" onClick={() => createCalculation(false)} disabled={busy}>
                {busy ? "Wird erstellt …" : "Bierdeckel erstellen"}
              </Button>
            </>
          ) : idea.stage === "new" || idea.stage === "in_discussion" ? (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                Gibt die Idee zur Berechnung frei. Die Durchführung wird später separat entschieden.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Übernommen werden nur bekannte Angaben. Unbekannte Werte bleiben offen und werden nie als Null
                gerechnet.
              </p>
              <Button className="mt-3" onClick={() => createCalculation(true)} disabled={busy}>
                {busy ? "Wird freigegeben …" : "Zur Kalkulation freigeben und starten"}
              </Button>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                Diese Idee ist {ideaStageLabels[idea.stage].toLowerCase()}. Sie muss zuerst zurück in die Diskussion,
                bevor gerechnet wird.
              </p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => changeStage("in_discussion")}
                disabled={busy}
              >
                Zurück in Diskussion
              </Button>
            </>
          )}
        </section>
      </div>

      <section className="surface mt-6 px-5 py-4">
        <h2 className="section-title">Diskussion</h2>
        {idea.notes && <p className="mt-2 text-sm text-muted-foreground">{idea.notes}</p>}
        <ul className="mt-3 space-y-2 text-sm">
          {(notes ?? []).map((n) => (
            <li key={n.id} className="rounded-md border px-3 py-2">
              <p>{n.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatDate(n.created_at.slice(0, 10))}</p>
            </li>
          ))}
          {(notes ?? []).length === 0 && <li className="text-xs text-muted-foreground">Noch keine Beiträge.</li>}
        </ul>
        <div className="mt-3 grid gap-2">
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Beitrag erfassen" />
          <div>
            <Button variant="outline" onClick={saveNote} disabled={busy || !note.trim()}>
              Beitrag speichern
            </Button>
          </div>
        </div>
      </section>

      {edit && <EventIdeaDialog open={edit} onOpenChange={setEdit} userId={user.id} idea={idea} />}
    </>
  );
}
