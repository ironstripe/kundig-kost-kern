import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Download, FileSpreadsheet, Loader2, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { ImportSteps } from "@/components/import/ImportSteps";
import { PreviewTable } from "@/components/ingredient-import/PreviewTable";
import { RowEditDialog } from "@/components/ingredient-import/RowEditDialog";
import { ingredientsQuery, type Ingredient } from "@/lib/ingredients";
import { unitPrice } from "@/lib/costing";
import { ingredientImportJobsQuery, IMPORT_RESULT_KEYS } from "@/lib/import-jobs";
import { executeIngredientImport, type IngredientImportResult } from "@/lib/ingredient-import.functions";
import {
  INGREDIENT_IMPORT_STEPS,
  MAX_ROWS,
  MAX_XLSX_BYTES,
  TEMPLATE_FILE_NAME,
  rowUnitPrice,
  type ParsedValues,
  type RowAction,
} from "@/lib/ingredient-import-schema";
import { buildPreview, evaluateRows, revalidate, toPayloadRows, withMatch, type PreviewRow } from "@/lib/ingredient-import-state";
import { importJobStatusLabels, formatBytes, type ImportJob } from "@/lib/import-schema";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

export const Route = createFileRoute("/_authenticated/_app/zutaten/importieren")({
  head: () => ({
    meta: [
      { title: "Excel-Import Zutaten – KundiCalc" },
      { name: "description", content: "Zutaten und Einkaufspreise über die KundiCalc-Excel-Vorlage prüfen, abgleichen und kontrolliert übernehmen." },
      { property: "og:title", content: "Excel-Import Zutaten – KundiCalc" },
      { property: "og:description", content: "Zutaten per Excel-Vorlage kontrolliert importieren." },
    ],
  }),
  component: IngredientImportPage,
});

type Phase = "select" | "checking" | "preview" | "result";
type BulkKind = "create" | "update" | "skip";

const jobTone: Record<ImportJob["status"], "neutral" | "success" | "warning" | "muted"> = { pending: "muted", processing: "neutral", review: "warning", confirmed: "success", failed: "warning" };

function IngredientImportPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: ingredients, isPending: ingPending } = useQuery(ingredientsQuery);
  const { data: jobs, isPending: jobsPending } = useQuery(ingredientImportJobsQuery);
  const existing: Ingredient[] = ingredients ?? [];

  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("select");
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileWarnings, setFileWarnings] = useState<string[]>([]);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editRow, setEditRow] = useState<number | null>(null);
  const [bulk, setBulk] = useState<BulkKind | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<IngredientImportResult | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const evaluations = useMemo(
    () => evaluateRows(rows, existing, rowUnitPrice, (i) => unitPrice(i)),
    [rows, existing],
  );
  const summary = useMemo(() => {
    let created = 0, updated = 0, skipped = 0, blocking = 0, warnings = 0;
    for (const r of rows) {
      const ev = evaluations.get(r.row)!;
      if (r.action === "skip") skipped++;
      else if (ev.blocking.length) blocking++;
      else if (r.action === "create") created++;
      else updated++;
      warnings += ev.warnings.length;
    }
    return { created, updated, skipped, blocking, warnings };
  }, [rows, evaluations]);

  const stepIndex = phase === "select" ? 0 : phase === "checking" ? 1 : phase === "preview" ? (confirmOpen ? 3 : 2) : 4;

  const downloadTemplate = useMutation({
    mutationFn: async () => {
      const { buildTemplate, downloadBlob } = await import("@/lib/ingredient-import-xlsx");
      downloadBlob(await buildTemplate(), TEMPLATE_FILE_NAME);
    },
    onError: () => toast.error("Die Vorlage konnte nicht erstellt werden."),
  });

  const check = useMutation({
    mutationFn: async (f: File) => {
      if (f.size > MAX_XLSX_BYTES) throw new Error("Die Datei ist grösser als 5 MB.");
      if (!/\.xlsx$/i.test(f.name)) throw new Error("Nur XLSX-Dateien werden unterstützt. Bitte die KundiCalc-Vorlage verwenden.");
      const { readWorkbook } = await import("@/lib/ingredient-import-xlsx");
      return readWorkbook(f);
    },
    onMutate: () => { setPhase("checking"); setFileError(null); setFailure(null); },
    onSuccess: (parsed) => {
      setFileWarnings(parsed.warnings);
      setRows(buildPreview(parsed.rows, existing));
      setSelected(new Set());
      setPhase("preview");
    },
    onError: (e) => { setFileError(e instanceof Error ? e.message : "Die Datei konnte nicht geprüft werden."); setPhase("select"); },
  });

  const run = useServerFn(executeIngredientImport);
  const execute = useMutation({
    mutationFn: () => run({ data: { fileName: file!.name, fileSize: file!.size, rowCount: rows.length, rows: toPayloadRows(rows) } }),
    onSuccess: async (res) => {
      setConfirmOpen(false);
      setResult(res);
      setPhase("result");
      await Promise.all(IMPORT_RESULT_KEYS.map((k) => queryClient.invalidateQueries({ queryKey: [...k] })));
      toast.success(`Import abgeschlossen: ${res.created} neu, ${res.updated} aktualisiert.`);
    },
    onError: async (e) => {
      setConfirmOpen(false);
      setFailure(e instanceof Error ? e.message : "Der Import ist fehlgeschlagen.");
      await queryClient.invalidateQueries({ queryKey: ["import_jobs"] });
    },
  });

  const update = (rowNo: number, fn: (r: PreviewRow) => PreviewRow) => setRows((rs) => rs.map((r) => (r.row === rowNo ? fn(r) : r)));
  const onAction = (rowNo: number, action: RowAction) => update(rowNo, (r) => ({ ...r, action, approved: action === "update" ? r.approved : false, matchId: action === "update" ? (r.matchId ?? (r.candidates.length === 1 ? r.candidates[0]!.id : null)) : r.matchId }));
  const onMatch = (rowNo: number, id: string | null) => update(rowNo, (r) => ({ ...r, matchId: id, action: id ? "update" : r.action === "update" ? "skip" : r.action, approved: false }));
  const onApprove = (rowNo: number, on: boolean) => update(rowNo, (r) => ({ ...r, approved: on }));
  const onSaveEdit = (rowNo: number, v: ParsedValues) =>
    update(rowNo, (r) => {
      const nameChanged = v.name !== r.values.name;
      const next = revalidate({ ...r, values: v, edited: true });
      return withMatch(next, existing, nameChanged);
    });

  const applyBulk = (kind: BulkKind) => {
    setRows((rs) =>
      rs.map((r) => {
        const ev = evaluations.get(r.row)!;
        const hasErrors = r.issues.some((i) => i.level === "error");
        if (kind === "create" && r.matchLevel === "none" && !hasErrors) return { ...r, action: "create", approved: false };
        if (kind === "update" && r.matchLevel === "exact" && !hasErrors && ev.target && ev.target.price_status !== "confirmed") return { ...r, action: "update", matchId: r.matchId ?? ev.target.id };
        if (kind === "skip" && selected.has(r.row)) return { ...r, action: "skip", approved: false };
        return r;
      }),
    );
    setBulk(null);
    if (kind === "skip") setSelected(new Set());
  };

  const reset = () => { setFile(null); setRows([]); setResult(null); setFailure(null); setFileError(null); setFileWarnings([]); setPhase("select"); if (fileRef.current) fileRef.current.value = ""; };

  const bulkCounts = {
    create: rows.filter((r) => r.matchLevel === "none" && !r.issues.some((i) => i.level === "error") && r.action !== "create").length,
    update: rows.filter((r) => r.matchLevel === "exact" && !r.issues.some((i) => i.level === "error") && evaluations.get(r.row)?.target?.price_status !== "confirmed" && r.action !== "update").length,
    skip: selected.size,
  };

  return (
    <>
      <PageHeader
        title="Excel-Import Zutaten"
        description="Zutaten und Einkaufspreise aus der KundiCalc-Vorlage prüfen, mit bestehenden Zutaten abgleichen und erst nach ausdrücklicher Bestätigung übernehmen. Andere Tabellen müssen zuerst in die Vorlage übertragen werden."
        actions={
          <>
            <Button variant="outline" asChild><Link to="/zutaten"><ArrowLeft className="size-4" /> Zu Zutaten & EK</Link></Button>
            <Button variant="outline" onClick={() => downloadTemplate.mutate()} disabled={downloadTemplate.isPending}>
              {downloadTemplate.isPending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Excel-Vorlage herunterladen
            </Button>
          </>
        }
      />

      <div className="mb-6"><ImportSteps current={stepIndex} steps={INGREDIENT_IMPORT_STEPS} /></div>

      {(phase === "select" || phase === "checking") && (
        <section className="surface space-y-4 p-6">
          <div>
            <h2 className="font-medium">1. Datei wählen</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              XLSX-Datei aus der KundiCalc-Vorlage, maximal 5 MB und {MAX_ROWS.toLocaleString("de-CH")} Zutatenzeilen. Gelesen wird ausschliesslich das Blatt «KundiCalc Import».
              Es wird nichts importiert, bevor Sie die Vorschau ausdrücklich bestätigen.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              ref={fileRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="max-w-md"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setFileError(null); }}
              disabled={phase === "checking"}
            />
            <Button onClick={() => file && check.mutate(file)} disabled={!file || phase === "checking" || ingPending}>
              {phase === "checking" ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />} Datei prüfen
            </Button>
          </div>
          {file && <p className="text-xs text-muted-foreground">{file.name} · {formatBytes(file.size)}</p>}
          {fileError && (
            <Alert variant="destructive"><AlertTitle>Datei kann nicht importiert werden</AlertTitle><AlertDescription className="whitespace-pre-line">{fileError}</AlertDescription></Alert>
          )}
        </section>
      )}

      {phase === "preview" && (
        <div className="space-y-4">
          {fileWarnings.length > 0 && (
            <Alert><AlertTitle>Hinweise zur Datei</AlertTitle><AlertDescription><ul className="list-disc pl-4">{fileWarnings.map((w) => <li key={w}>{w}</li>)}</ul></AlertDescription></Alert>
          )}
          {failure && (
            <Alert variant="destructive">
              <AlertTitle>Import fehlgeschlagen</AlertTitle>
              <AlertDescription className="whitespace-pre-line">{failure}{"\n"}Die geprüfte Vorschau bleibt erhalten. Korrigieren Sie die Zeilen und führen Sie den Import erneut aus.</AlertDescription>
            </Alert>
          )}
          <section className="surface flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="text-sm">
              <span className="font-medium">{file?.name}</span> · {rows.length} Zeilen ·{" "}
              <span className="text-muted-foreground">{summary.created} neu, {summary.updated} aktualisieren, {summary.skipped} überspringen, {summary.warnings} Warnungen, </span>
              <span className={summary.blocking ? "text-destructive" : "text-muted-foreground"}>{summary.blocking} blockierende Fehler</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setBulk("create")} disabled={!bulkCounts.create}>Alle neuen Zeilen → Neu anlegen ({bulkCounts.create})</Button>
              <Button variant="outline" size="sm" onClick={() => setBulk("update")} disabled={!bulkCounts.update}>Exakte Treffer (geschätzter Preis) → Aktualisieren ({bulkCounts.update})</Button>
              <Button variant="outline" size="sm" onClick={() => setBulk("skip")} disabled={!bulkCounts.skip}>Ausgewählte → Überspringen ({bulkCounts.skip})</Button>
            </div>
          </section>
          <p className="text-xs text-muted-foreground">
            Bestätigte Preise werden nie per Sammelaktion überschrieben – dafür ist eine Freigabe in der jeweiligen Zeile nötig. Korrekturen gelten nur für diesen Import.
          </p>
          <PreviewTable
            rows={rows}
            evaluations={evaluations}
            existing={existing}
            selected={selected}
            onToggleSelect={(row, on) => setSelected((s) => { const n = new Set(s); if (on) n.add(row); else n.delete(row); return n; })}
            onToggleAll={(on) => setSelected(on ? new Set(rows.map((r) => r.row)) : new Set())}
            onAction={onAction}
            onMatch={onMatch}
            onApprove={onApprove}
            onEdit={setEditRow}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="ghost" onClick={reset}>Andere Datei wählen</Button>
            <Button onClick={() => setConfirmOpen(true)} disabled={summary.blocking > 0 || summary.created + summary.updated === 0}>
              <ShieldCheck className="size-4" /> Weiter zur Bestätigung
            </Button>
          </div>
        </div>
      )}

      {phase === "result" && result && (
        <section className="surface space-y-4 p-6">
          <h2 className="font-medium">Import abgeschlossen</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><dt className="text-muted-foreground">Neu angelegt</dt><dd className="tabular text-lg font-semibold">{result.created}</dd></div>
            <div><dt className="text-muted-foreground">Aktualisiert</dt><dd className="tabular text-lg font-semibold">{result.updated}</dd></div>
            <div><dt className="text-muted-foreground">Übersprungen</dt><dd className="tabular text-lg font-semibold">{result.skipped}</dd></div>
            <div><dt className="text-muted-foreground">Fehlgeschlagen</dt><dd className="tabular text-lg font-semibold">{result.failed}</dd></div>
          </dl>
          <div className="text-sm">
            <p className="font-medium">Betroffene Kalkulationen</p>
            {result.affectedVariants.length === 0 && result.affectedAddOns.length === 0 ? (
              <p className="text-muted-foreground">Keine bestehende Kalkulation verwendet die importierten Zutaten.</p>
            ) : (
              <ul className="mt-1 columns-1 space-y-0.5 sm:columns-2">
                {result.affectedVariants.map((v) => (
                  <li key={v.id}><Link className="underline-offset-2 hover:underline" to="/gerichte/$dishId" params={{ dishId: v.dishId }}>{v.dishName} – {v.name}</Link></li>
                ))}
                {result.affectedAddOns.map((a) => (
                  <li key={a.id}><Link className="underline-offset-2 hover:underline" to="/gerichte/add-ons/$addOnId" params={{ addOnId: a.id }}>Add-on: {a.name}</Link></li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-muted-foreground">Wareneinsatz, DB I, Gerichtsvergleich und Übersicht rechnen ab sofort mit den neuen Einkaufspreisen. Ein neues Szenario startet mit den gespeicherten Werten.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => navigate({ to: "/zutaten" })}>Zu Zutaten & EK</Button>
            <Button variant="outline" onClick={reset}>Importübersicht schliessen</Button>
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="mb-3 font-medium">Importverlauf</h2>
        {jobsPending && <Skeleton className="h-24 w-full" />}
        {!jobsPending && (jobs?.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">Es wurde noch keine Excel-Datei importiert.</p>}
        {!jobsPending && (jobs?.length ?? 0) > 0 && (
          <div className="surface overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datei</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Zeilen</TableHead>
                  <TableHead className="text-right">Neu</TableHead>
                  <TableHead className="text-right">Aktualisiert</TableHead>
                  <TableHead className="text-right">Übersprungen</TableHead>
                  <TableHead className="text-right">Fehlgeschlagen</TableHead>
                  <TableHead>Erstellt</TableHead>
                  <TableHead>Bestätigt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs!.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell><div className="max-w-xs truncate font-medium" title={j.source_name ?? undefined}>{j.source_name}</div><div className="text-xs text-muted-foreground">{formatBytes(j.file_size)}</div></TableCell>
                    <TableCell>
                      <StatusBadge tone={jobTone[j.status]}>{j.status === "confirmed" ? "Importiert" : j.status === "processing" ? "In Verarbeitung" : importJobStatusLabels[j.status]}</StatusBadge>
                      {j.status === "failed" && <div className="mt-1 max-w-xs text-xs text-destructive">{j.failed_stage ? `${j.failed_stage}: ` : ""}{j.error_message}</div>}
                    </TableCell>
                    <TableCell className="tabular text-right">{j.row_count ?? "–"}</TableCell>
                    <TableCell className="tabular text-right">{j.created_count ?? "–"}</TableCell>
                    <TableCell className="tabular text-right">{j.updated_count ?? "–"}</TableCell>
                    <TableCell className="tabular text-right">{j.skipped_count ?? "–"}</TableCell>
                    <TableCell className="tabular text-right">{j.failed_count ?? "–"}</TableCell>
                    <TableCell className="tabular text-muted-foreground">{formatDateTime(j.created_at)}</TableCell>
                    <TableCell className="tabular text-muted-foreground">{formatDateTime(j.confirmed_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {editRow !== null && (() => {
        const r = rows.find((x) => x.row === editRow);
        return r ? <RowEditDialog key={r.row} row={r.row} values={r.values} open onOpenChange={(o) => !o && setEditRow(null)} onSave={(v) => onSaveEdit(r.row, v)} /> : null;
      })()}

      <AlertDialog open={bulk !== null} onOpenChange={(o) => !o && setBulk(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sammelaktion anwenden?</AlertDialogTitle>
            <AlertDialogDescription>
              {bulk === "create" && `${bulkCounts.create} gültige Zeilen ohne Übereinstimmung werden auf «Neu anlegen» gesetzt.`}
              {bulk === "update" && `${bulkCounts.update} exakte Treffer mit geschätztem Preis werden auf «Bestehende Zutat aktualisieren» gesetzt. Zutaten mit bestätigtem Preis sind ausgenommen.`}
              {bulk === "skip" && `${bulkCounts.skip} ausgewählte Zeilen werden auf «Überspringen» gesetzt.`}
              {" "}Es wird noch nichts gespeichert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => bulk && applyBulk(bulk)}>Anwenden</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !execute.isPending && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import verbindlich ausführen?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <ul className="list-disc pl-4">
                  <li>{summary.created} neue Zutaten</li>
                  <li>{summary.updated} aktualisierte Zutaten{rows.some((r) => r.action === "update" && evaluations.get(r.row)?.confirmedOverwrite) && ` (davon ${rows.filter((r) => r.action === "update" && evaluations.get(r.row)?.confirmedOverwrite).length} mit freigegebenem bestätigtem Preis)`}</li>
                  <li>{summary.skipped} übersprungene Zeilen</li>
                  <li>{summary.warnings} Warnungen</li>
                  <li>{summary.blocking} blockierende Fehler</li>
                </ul>
                <p>Importierte Preise erhalten den Status «Bestätigt» (Quelle Excel-Import). Alle betroffenen Gerichte, Add-ons und die Übersicht rechnen sofort mit den neuen Werten.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={execute.isPending}>Zurück zur Vorschau</AlertDialogCancel>
            <Button onClick={() => execute.mutate()} disabled={summary.blocking > 0 || execute.isPending}>
              {execute.isPending && <Loader2 className="size-4 animate-spin" />} Import verbindlich ausführen
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
