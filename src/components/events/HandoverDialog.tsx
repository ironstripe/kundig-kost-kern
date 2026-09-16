/**
 * Guided handover: choose → complete/select → review → confirm.
 * Nothing is sent while the dialog is open; it only prepares the immutable
 * attempt after an explicit confirmation.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { formatDate } from "@/lib/format";
import { CreateInputSchema, contractMessage, type MasterData, type TargetEvent } from "@/lib/kundivent-contract";
import {
  loadMasterData,
  loadTargetEvent,
  prepareHandover,
  searchTargetEvents,
  type HandoverContext,
} from "@/lib/kundivent.functions";
import type { Event } from "@/lib/events";

type Mode = "choose" | "create" | "link" | "review-create" | "review-link";

const statusLabels: Record<string, string> = {
  idea: "Idee",
  provisional: "Provisorisch",
  confirmed: "Bestätigt",
  cancelled: "Abgesagt",
};

function statusLabel(status: string) {
  return statusLabels[status] ?? status;
}

export function HandoverDialog({
  event,
  ctx,
  onClose,
  onPrepared,
}: {
  event: Event;
  ctx: HandoverContext;
  onClose: () => void;
  onPrepared: () => void | Promise<void>;
}) {
  const master = useServerFn(loadMasterData);
  const search = useServerFn(searchTargetEvents);
  const readTarget = useServerFn(loadTargetEvent);
  const prepare = useServerFn(prepareHandover);

  const [mode, setMode] = useState<Mode>("choose");
  const [busy, setBusy] = useState(false);

  // create
  const [title, setTitle] = useState(ctx.prefill?.title ?? event.name);
  const [categoryId, setCategoryId] = useState("");
  const [areaIds, setAreaIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(ctx.prefill?.start_date ?? "");
  const [endDate, setEndDate] = useState("");
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [pax, setPax] = useState(ctx.prefill?.pax === null || ctx.prefill?.pax === undefined ? "" : String(ctx.prefill.pax));
  const [notes, setNotes] = useState("");

  // link
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<TargetEvent | null>(null);
  const [confirmChange, setConfirmChange] = useState(false);

  const { data: masterData, error: masterError } = useQuery<MasterData>({
    queryKey: ["kundivent_master_data"],
    queryFn: () => master({}),
    enabled: mode === "create" || mode === "review-create",
    staleTime: 60_000,
  });

  const { data: results, isFetching } = useQuery({
    queryKey: ["kundivent_search", submittedQuery, offset],
    queryFn: () => search({ data: { ...(submittedQuery ? { q: submittedQuery } : {}), offset } }),
    enabled: mode === "link",
  });

  const categories = (masterData?.categories ?? []).filter((c) => c.is_active !== false);
  const areas = (masterData?.planning_areas ?? []).filter((a) => a.is_active !== false);

  const createValues = {
    title: title.trim(),
    category_id: categoryId,
    planning_area_ids: areaIds,
    start_date: startDate,
    end_date: endDate || null,
    all_day: allDay,
    start_time: allDay ? null : startTime,
    end_time: allDay ? null : endTime,
    pax: pax.trim() === "" ? null : Number(pax),
    notes: notes.trim() || null,
  };
  const createCheck = CreateInputSchema.safeParse(createValues);

  const openReview = (target: Mode) => setMode(target);

  const submit = async (operation: "create" | "link") => {
    setBusy(true);
    try {
      await prepare({
        data:
          operation === "create"
            ? { eventId: event.id, operation, create: createCheck.success ? createCheck.data : (createValues as never) }
            : {
                eventId: event.id,
                operation,
                link: { target_event_id: selected!.id, expected_updated_at: selected!.updated_at },
              },
      });
      toast.success("Übergabe vorbereitet. Sie kann jetzt gesendet werden.");
      await onPrepared();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Vorbereitung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  const reloadSelected = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const fresh = await readTarget({ data: { targetEventId: selected.id } });
      setSelected(fresh);
      setConfirmChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? contractMessage(null) : contractMessage(null));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>An Kundivent übergeben</DialogTitle>
          <DialogDescription>
            {event.name} · {formatDate(event.event_date)}
          </DialogDescription>
        </DialogHeader>

        {mode === "choose" && (
          <div className="grid gap-3">
            <button className="rounded-md border px-4 py-3 text-left hover:bg-muted" onClick={() => setMode("create")}>
              <span className="block text-sm font-medium">Neuen Eintrag erstellen</span>
              <span className="block text-xs text-muted-foreground">
                Legt in Kundivent einen bestätigten Eintrag an.
              </span>
            </button>
            <button className="rounded-md border px-4 py-3 text-left hover:bg-muted" onClick={() => setMode("link")}>
              <span className="block text-sm font-medium">Bestehenden Eintrag verknüpfen</span>
              <span className="block text-xs text-muted-foreground">
                Verknüpft diese Kalkulation mit einem vorhandenen Kundivent-Eintrag und bestätigt ihn.
              </span>
            </button>
          </div>
        )}

        {mode === "create" && (
          <div className="grid gap-3">
            {masterError && <p className="text-xs text-warning-foreground">{contractMessage(null)}</p>}
            <div className="grid gap-1.5">
              <Label htmlFor="hv-title">Titel</Label>
              <Input id="hv-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Kategorie</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Kategorie wählen" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Planungsbereiche</Label>
              <div className="grid gap-1.5 rounded-md border px-3 py-2">
                {areas.length === 0 && <p className="text-xs text-muted-foreground">Keine aktiven Planungsbereiche.</p>}
                {areas.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={areaIds.includes(a.id)}
                      onCheckedChange={(v) =>
                        setAreaIds((prev) => (v ? [...prev, a.id] : prev.filter((x) => x !== a.id)))
                      }
                    />
                    {a.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="hv-start">Startdatum</Label>
                <Input id="hv-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="hv-end">Enddatum (optional)</Label>
                <Input id="hv-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={allDay} onCheckedChange={(v) => setAllDay(Boolean(v))} /> Ganztags
            </label>
            {!allDay && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="hv-st">Startzeit</Label>
                  <Input id="hv-st" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="hv-et">Endzeit</Label>
                  <Input id="hv-et" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="hv-pax">Gästezahl (optional)</Label>
                <Input id="hv-pax" inputMode="numeric" value={pax} onChange={(e) => setPax(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="hv-notes">Notizen (optional)</Label>
              <Textarea id="hv-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            {!createCheck.success && (
              <p className="text-xs text-muted-foreground">
                {createCheck.error.issues[0]?.message ?? "Bitte die Pflichtfelder ausfüllen."}
              </p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setMode("choose")}>
                Zurück
              </Button>
              <Button disabled={!createCheck.success} onClick={() => openReview("review-create")}>
                Weiter zur Prüfung
              </Button>
            </DialogFooter>
          </div>
        )}

        {mode === "review-create" && (
          <div className="grid gap-3 text-sm">
            <p className="rounded-md border px-3 py-2">Dieser Eintrag wird in Kundivent als Bestätigt angelegt.</p>
            <dl className="grid gap-1.5">
              <Row label="Titel" value={title} />
              <Row label="Kategorie" value={categories.find((c) => c.id === categoryId)?.name ?? "–"} />
              <Row
                label="Planungsbereiche"
                value={areas.filter((a) => areaIds.includes(a.id)).map((a) => a.name).join(", ") || "–"}
              />
              <Row label="Datum" value={`${formatDate(startDate)}${endDate ? ` – ${formatDate(endDate)}` : ""}`} />
              <Row label="Zeit" value={allDay ? "Ganztags" : `${startTime}–${endTime}`} />
              <Row label="Gäste" value={pax.trim() === "" ? "–" : pax} />
              <Row label="Notizen" value={notes.trim() || "–"} />
            </dl>
            <p className="text-xs text-muted-foreground">
              Es werden keine Kalkulationsdetails an Kundivent übermittelt.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMode("create")}>
                Zurück
              </Button>
              <Button disabled={busy} onClick={() => submit("create")}>
                Bestätigt in Kundivent anlegen
              </Button>
            </DialogFooter>
          </div>
        )}

        {mode === "link" && (
          <div className="grid gap-3">
            <div className="flex gap-2">
              <Input
                placeholder="Suchen in allen Kundivent-Einträgen"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setOffset(0);
                    setSubmittedQuery(query.trim());
                  }
                }}
              />
              <Button
                variant="outline"
                onClick={() => {
                  setOffset(0);
                  setSubmittedQuery(query.trim());
                }}
              >
                Suchen
              </Button>
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {isFetching && <p className="text-xs text-muted-foreground">Wird geladen …</p>}
              {(results?.events ?? []).map((ev) => {
                const cancelled = ev.status === "cancelled";
                const conflicting = ev.has_kundicalc_association === true;
                return (
                  <button
                    key={ev.id}
                    disabled={cancelled || conflicting}
                    className="w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                    onClick={async () => {
                      setBusy(true);
                      try {
                        setSelected(await readTarget({ data: { targetEventId: ev.id } }));
                        setConfirmChange(false);
                        setMode("review-link");
                      } catch {
                        toast.error(contractMessage(null));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{ev.title}</span>
                      <StatusBadge tone={cancelled ? "warning" : "muted"}>{statusLabel(ev.status)}</StatusBadge>
                    </div>
                    <span className="block text-xs text-muted-foreground">
                      {formatDate(ev.start_date ?? null)}
                      {ev.start_time ? `, ${ev.start_time}` : ""}
                      {ev.planning_areas?.length ? ` · ${ev.planning_areas.map((a) => a.name).join(", ")}` : ""}
                      {typeof ev.pax === "number" ? ` · ${ev.pax} Gäste` : ""}
                    </span>
                    {cancelled && <span className="block text-xs text-warning-foreground">Abgesagte Einträge werden nicht bestätigt.</span>}
                    {conflicting && <span className="block text-xs text-warning-foreground">Bereits mit einer Kalkulation verknüpft.</span>}
                  </button>
                );
              })}
              {!isFetching && (results?.events ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">Keine Einträge gefunden.</p>
              )}
            </div>
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 20))}>
                Zurück
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={(results?.events ?? []).length < 20}
                onClick={() => setOffset(offset + 20)}
              >
                Weitere
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMode("choose")}>
                Zurück
              </Button>
            </DialogFooter>
          </div>
        )}

        {mode === "review-link" && selected && (
          <div className="grid gap-3 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border px-3 py-2">
                <p className="text-xs text-muted-foreground">KundiCalc</p>
                <p className="font-medium">{event.name}</p>
                <p className="text-xs text-muted-foreground">{formatDate(event.event_date)}</p>
              </div>
              <div className="rounded-md border px-3 py-2">
                <p className="text-xs text-muted-foreground">Kundivent</p>
                <p className="font-medium">{selected.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(selected.start_date ?? null)} · {statusLabel(selected.status)}
                  {selected.planning_areas?.length ? ` · ${selected.planning_areas.map((a) => a.name).join(", ")}` : ""}
                  {typeof selected.pax === "number" ? ` · ${selected.pax} Gäste` : ""}
                </p>
              </div>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              <li>Idee oder Provisorisch wird zu Bestätigt.</li>
              <li>Bestätigt bleibt Bestätigt.</li>
              <li>Alle übrigen Angaben in Kundivent bleiben unverändert.</li>
            </ul>
            {selected.status === "cancelled" ? (
              <p className="text-xs text-warning-foreground">Abgesagte Einträge werden nicht bestätigt.</p>
            ) : (
              <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={confirmChange} onCheckedChange={(v) => setConfirmChange(Boolean(v))} />
                Ich bestätige, dass dieser Kundivent-Eintrag der richtige ist und auf Bestätigt gesetzt werden darf.
              </label>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setMode("link")}>
                Zurück
              </Button>
              <Button variant="ghost" disabled={busy} onClick={reloadSelected}>
                Neu prüfen
              </Button>
              <Button disabled={busy || !confirmChange || selected.status === "cancelled"} onClick={() => submit("link")}>
                Verknüpfen und bestätigen
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
