import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Sparkles, Wand2 } from "lucide-react";
import { z } from "zod";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { EmptyState } from "@/components/layout/EmptyState";
import { MenuCardSelector } from "@/components/menu-cards/MenuCardSelector";
import { ImportSteps } from "@/components/import/ImportSteps";
import { ImportSourcePanel } from "@/components/import/ImportSourcePanel";
import { ReviewEditor } from "@/components/import/ReviewEditor";
import { EstimationReview } from "@/components/import/EstimationReview";
import { ImportHistory } from "@/components/import/ImportHistory";
import { useSelectedMenuCard } from "@/lib/selected-menu-card";
import { importJobsQuery, IMPORT_RESULT_KEYS } from "@/lib/import-jobs";
import { analyzeImportJob, confirmEstimation, confirmImportJob, saveImportReview, startEstimation } from "@/lib/import.functions";
import {
  EstimationStateSchema,
  ReviewStateSchema,
  importJobStatusLabels,
  validateReview,
  type EstimationState,
  type ImportJob,
  type ReviewState,
} from "@/lib/import-schema";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
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
import { BookOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/speisekarten/importieren")({
  validateSearch: z.object({ job: z.string().uuid().optional() }),
  head: () => ({
    meta: [
      { title: "Speisekarte importieren – KundiCalc" },
      { name: "description", content: "PDF oder Bild einer Speisekarte hochladen, per KI analysieren, prüfen und kontrolliert übernehmen." },
      { property: "og:title", content: "Speisekarte importieren – KundiCalc" },
      { property: "og:description", content: "Speisekarte analysieren, prüfen und kontrolliert übernehmen." },
    ],
  }),
  component: ImportPage,
});

function stepOf(job: ImportJob | null, estimation: EstimationState | null): number {
  if (!job) return 0;
  if (job.status === "pending" || job.status === "failed") return 1;
  if (job.status === "processing") return 1;
  if (job.status === "review") return 2;
  if (job.status === "confirmed") return estimation || job.estimation_confirmed_at ? 4 : 3;
  return 0;
}

function ImportPage() {
  const { job: jobId } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const queryClient = useQueryClient();
  const { data: card, isPending: cardPending } = useSelectedMenuCard();
  const { data: jobs, isPending } = useQuery({ ...importJobsQuery(card?.id ?? ""), enabled: !!card });
  const job = useMemo(() => jobs?.find((j) => j.id === jobId) ?? null, [jobs, jobId]);

  const [review, setReview] = useState<ReviewState | null>(null);
  const [estimation, setEstimation] = useState<EstimationState | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmEstOpen, setConfirmEstOpen] = useState(false);
  const [estimationDishes, setEstimationDishes] = useState<Record<string, boolean>>({});
  const [confirmResult, setConfirmResult] = useState<{ dishes_created: number; dishes_updated: number; dishes_skipped: number; variants_created: number; add_ons_created: number; dish_ids: string[] } | null>(null);

  // Hydrate local editing state from the stored job payloads.
  useEffect(() => {
    if (!job) { setReview(null); setEstimation(null); setConfirmResult(null); setDirty(false); return; }
    const r = ReviewStateSchema.safeParse(job.review_payload);
    setReview(r.success ? r.data : null);
    const e = EstimationStateSchema.safeParse(job.estimation_payload);
    setEstimation(e.success && !job.estimation_confirmed_at ? e.data : null);
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, job?.status, job?.updated_at]);

  const openJob = (id: string | undefined) => navigate({ search: id ? { job: id } : {} });
  const refreshJobs = () => queryClient.invalidateQueries({ queryKey: ["import_jobs"] });
  const refreshAll = () => Promise.all(IMPORT_RESULT_KEYS.map((k) => queryClient.invalidateQueries({ queryKey: [...k] })));

  const analyze = useServerFn(analyzeImportJob);
  const save = useServerFn(saveImportReview);
  const confirm = useServerFn(confirmImportJob);
  const estimate = useServerFn(startEstimation);
  const confirmEst = useServerFn(confirmEstimation);

  const analyzeM = useMutation({
    mutationFn: (id: string) => analyze({ data: { jobId: id } }),
    onSuccess: async () => { await refreshJobs(); toast.success("Analyse abgeschlossen. Bitte Ergebnis prüfen."); },
    onError: async (e) => { await refreshJobs(); toast.error(e instanceof Error ? e.message : "Analyse fehlgeschlagen."); },
  });
  const saveM = useMutation({
    mutationFn: (r: ReviewState) => save({ data: { jobId: job!.id, review: r } }),
    onSuccess: async () => { setDirty(false); await refreshJobs(); toast.success("Zwischenstand gespeichert."); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen."),
  });
  const confirmM = useMutation({
    mutationFn: (r: ReviewState) => confirm({ data: { jobId: job!.id, review: r } }),
    onSuccess: async (res) => {
      setConfirmOpen(false);
      setConfirmResult(res);
      setEstimationDishes(Object.fromEntries(res.dish_ids.map((id) => [id, true])));
      await refreshAll();
      toast.success(`Speisekarte übernommen: ${res.dishes_created} neu, ${res.dishes_updated} aktualisiert, ${res.dishes_skipped} übersprungen.`);
    },
    onError: (e) => { setConfirmOpen(false); toast.error(e instanceof Error ? e.message : "Übernahme fehlgeschlagen."); },
  });
  const estimateM = useMutation({
    mutationFn: (dishIds: string[]) => estimate({ data: { jobId: job!.id, dishIds } }),
    onSuccess: async (state) => { setEstimation(state); await refreshJobs(); toast.success("Kalkulationsvorschlag erstellt. Bitte prüfen."); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Kalkulationsvorschlag fehlgeschlagen."),
  });
  const confirmEstM = useMutation({
    mutationFn: (s: EstimationState) => confirmEst({ data: { jobId: job!.id, state: s } }),
    onSuccess: async (res) => {
      setConfirmEstOpen(false);
      setEstimation(null);
      await refreshAll();
      toast.success(`${res.items_created} Kalkulationspositionen und ${res.ingredients_created} neue Zutaten (geschätzt) gespeichert.`);
    },
    onError: (e) => { setConfirmEstOpen(false); toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen."); },
  });

  const busy = analyzeM.isPending || saveM.isPending || confirmM.isPending || estimateM.isPending || confirmEstM.isPending;
  const step = stepOf(job, estimation);
  const errors = review ? validateReview(review).filter((i) => i.level === "error") : [];

  // Dishes eligible for estimation: from confirm result, else all dishes of the card created by this import.
  const { data: cardDishes } = useQuery({
    queryKey: ["dishes", "import-candidates", card?.id],
    enabled: !!card && job?.status === "confirmed",
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase.from("dishes").select("id, name, source_type").eq("menu_card_id", card!.id).eq("is_active", true).order("sort_order").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const candidateDishes = useMemo(() => {
    if (!cardDishes) return [];
    if (confirmResult) return cardDishes.filter((d) => confirmResult.dish_ids.includes(d.id));
    return cardDishes.filter((d) => d.source_type === "menu_import");
  }, [cardDishes, confirmResult]);
  useEffect(() => {
    if (!confirmResult && candidateDishes.length && Object.keys(estimationDishes).length === 0)
      setEstimationDishes(Object.fromEntries(candidateDishes.map((d) => [d.id, true])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateDishes.length]);

  return (
    <>
      <PageHeader
        title="Speisekarte importieren"
        description="PDF oder Bild hochladen, Analyse bewusst starten, Ergebnis prüfen und erst dann übernehmen. Kein Schritt läuft automatisch; nichts wird ohne Bestätigung gespeichert."
        actions={<Button variant="outline" asChild><Link to="/speisekarten"><ArrowLeft className="size-4" /> Zu den Speisekarten</Link></Button>}
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <MenuCardSelector />
        <ImportSteps current={step} />
      </div>

      {cardPending && <Skeleton className="h-40 w-full" />}
      {!cardPending && !card && (
        <EmptyState icon={BookOpen} title="Keine Speisekarte" description="Legen Sie zuerst eine Ziel-Speisekarte an. Importierte Gerichte werden immer einer Karte zugeordnet.">
          <Button asChild><Link to="/speisekarten">Speisekarte anlegen</Link></Button>
        </EmptyState>
      )}

      {card && (
        <div className="space-y-8">
          {!job && (
            <section className="surface p-5">
              <h2 className="mb-1 text-base font-semibold">1 · Quelle bereitstellen</h2>
              <p className="mb-4 text-sm text-muted-foreground">Ziel: <span className="font-medium text-foreground">{card.name}</span>. Das Dokument wird nur gespeichert – analysiert wird erst nach Klick auf «Analyse starten».</p>
              <ImportSourcePanel menuCardId={card.id} onCreated={async (id) => { await refreshJobs(); openJob(id); }} />
            </section>
          )}

          {job && (
            <section className="surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold">{job.status === "confirmed" ? "4 · Übernommen" : job.status === "review" ? "3 · Prüfung und Korrektur" : "2 · Analyse"}</h2>
                  <p className="truncate text-sm text-muted-foreground" title={job.source_name ?? undefined}>
                    {job.source_kind === "url" ? "Link" : "Datei"}: {job.source_name ?? "Dokument"} · {formatDateTime(job.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={job.status === "confirmed" ? "success" : job.status === "failed" ? "warning" : "neutral"}>{importJobStatusLabels[job.status]}</StatusBadge>
                  <Button variant="ghost" size="sm" onClick={() => openJob(undefined)} disabled={busy}>Anderes Dokument</Button>
                </div>
              </div>

              {(job.status === "pending" || job.status === "failed" || job.status === "processing") && (
                <div className="mt-4 space-y-3">
                  {job.status === "failed" && job.error_message && (
                    <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{job.error_message}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Die KI liest nur die Speisen-Struktur (Kategorien, Gerichte, Varianten, Add-ons, Preise). Getränke werden ignoriert. Das Ergebnis erscheint zur Prüfung; nichts wird automatisch gespeichert.
                  </p>
                  <Button onClick={() => analyzeM.mutate(job.id)} disabled={busy || job.status === "processing"}>
                    {analyzeM.isPending || job.status === "processing" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                    {job.status === "failed" ? "Analyse erneut starten" : "Analyse starten"}
                  </Button>
                  {(analyzeM.isPending || job.status === "processing") && <p className="text-xs text-muted-foreground">Die Analyse dauert je nach Dokument 10–40 Sekunden.</p>}
                </div>
              )}

              {job.status === "review" && review && (
                <div className="mt-4 space-y-4">
                  <ReviewEditor value={review} onChange={(r) => { setReview(r); setDirty(true); }} disabled={busy} />
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
                    {dirty && <span className="mr-auto text-xs text-muted-foreground">Ungespeicherte Korrekturen</span>}
                    <Button variant="outline" onClick={() => saveM.mutate(review)} disabled={busy || !dirty}>Zwischenstand speichern</Button>
                    <Button onClick={() => setConfirmOpen(true)} disabled={busy || errors.length > 0} title={errors[0]?.message}>Speisekarte übernehmen</Button>
                  </div>
                </div>
              )}
              {job.status === "review" && !review && <p className="mt-4 text-sm text-destructive">Das gespeicherte Prüfergebnis ist unlesbar. Bitte Analyse erneut starten.</p>}
              {job.status === "review" && !review && <Button className="mt-2" variant="outline" onClick={() => analyzeM.mutate(job.id)} disabled={busy}>Analyse erneut starten</Button>}

              {job.status === "confirmed" && (
                <div className="mt-4 space-y-3 text-sm">
                  <p>
                    Übernommen am {formatDateTime(job.confirmed_at)}. {confirmResult && <>{confirmResult.dishes_created} Gerichte neu, {confirmResult.dishes_updated} aktualisiert, {confirmResult.dishes_skipped} übersprungen, {confirmResult.variants_created} Varianten und {confirmResult.add_ons_created} Add-ons angelegt.</>}
                  </p>
                  <p className="text-muted-foreground">Alle neuen Varianten stehen auf «geschätzt» mit Verkaufsmenge 1 pro Öffnungstag – bitte in den Verkaufsmengen anpassen. <Link to="/gerichte" className="underline">Zu den Gerichten</Link></p>
                </div>
              )}
            </section>
          )}

          {job?.status === "confirmed" && (
            <section className="surface p-5">
              <h2 className="text-base font-semibold">5 · Zutaten und Mengen schätzen (optional)</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Separater, manuell ausgelöster Schritt: Die KI schlägt Rezeptkomponenten, Mengen und Einkaufspreise als Annahmen vor. Varianten, die bereits Positionen haben, werden nicht angetastet. Gespeichert wird erst nach Ihrer Bestätigung.
              </p>

              {job.estimation_confirmed_at && !estimation && (
                <p className="mt-3 text-sm">Kalkulationsvorschlag übernommen am {formatDateTime(job.estimation_confirmed_at)}. Alle Werte sind als geschätzt markiert.</p>
              )}

              {!estimation && (
                <div className="mt-4 space-y-3">
                  {candidateDishes.length > 0 ? (
                    <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                      {candidateDishes.map((d) => (
                        <label key={d.id} className="flex items-center gap-2 text-sm">
                          <Checkbox checked={estimationDishes[d.id] ?? false} onCheckedChange={(v) => setEstimationDishes((s) => ({ ...s, [d.id]: !!v }))} disabled={busy} />
                          {d.name}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Keine importierten Gerichte auf dieser Karte gefunden.</p>
                  )}
                  <Button
                    onClick={() => estimateM.mutate(Object.entries(estimationDishes).filter(([, v]) => v).map(([k]) => k))}
                    disabled={busy || !Object.values(estimationDishes).some(Boolean)}
                  >
                    {estimateM.isPending ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />} Zutaten und Mengen schätzen
                  </Button>
                  {estimateM.isPending && <p className="text-xs text-muted-foreground">Der Vorschlag dauert je nach Anzahl Gerichte 20–60 Sekunden.</p>}
                </div>
              )}

              {estimation && (
                <div className="mt-4 space-y-4">
                  <EstimationReview value={estimation} onChange={setEstimation} disabled={busy} />
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
                    <Button variant="outline" onClick={() => setEstimation(null)} disabled={busy}>Vorschlag verwerfen</Button>
                    <Button onClick={() => setConfirmEstOpen(true)} disabled={busy || !estimation.rows.some((r) => !r.excluded)}>Kalkulationsvorschlag übernehmen</Button>
                  </div>
                </div>
              )}
            </section>
          )}

          <section>
            <h2 className="mb-3 text-base font-semibold">Import-Verlauf · {card.name}</h2>
            {isPending ? <Skeleton className="h-24 w-full" /> : <ImportHistory jobs={jobs ?? []} activeId={job?.id ?? null} onOpen={openJob} />}
          </section>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Speisekarte übernehmen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die geprüften Kategorien, Gerichte, Varianten und Add-ons werden in «{card?.name}» gespeichert. Die Übernahme erfolgt in einem Schritt: schlägt etwas fehl, wird nichts geschrieben. Neue Varianten erhalten den Status «geschätzt».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmM.isPending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); if (review) confirmM.mutate(review); }} disabled={confirmM.isPending}>
              {confirmM.isPending && <Loader2 className="size-4 animate-spin" />} Übernehmen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmEstOpen} onOpenChange={setConfirmEstOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kalkulationsvorschlag übernehmen?</AlertDialogTitle>
            <AlertDialogDescription>
              Ausgewählte Positionen werden als geschätzte Kalkulationspositionen gespeichert; neue Zutaten entstehen mit Preisstatus «geschätzt» und Quelle «KI-Schätzung». Mengen bleiben unbestätigt, bis die Küche sie prüft.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmEstM.isPending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); if (estimation) confirmEstM.mutate(estimation); }} disabled={confirmEstM.isPending}>
              {confirmEstM.isPending && <Loader2 className="size-4 animate-spin" />} Übernehmen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
