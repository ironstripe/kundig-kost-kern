import { importJobStatusLabels, formatBytes, type ImportJob } from "@/lib/import-schema";
import { formatDateTime } from "@/lib/format";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const tone: Record<ImportJob["status"], "neutral" | "success" | "warning" | "muted"> = {
  pending: "muted",
  processing: "neutral",
  review: "warning",
  confirmed: "success",
  failed: "warning",
};

export function ImportHistory({ jobs, activeId, onOpen }: { jobs: ImportJob[]; activeId: string | null; onOpen: (id: string) => void }) {
  if (jobs.length === 0) return <p className="text-sm text-muted-foreground">Für diese Speisekarte wurde noch nichts importiert.</p>;
  return (
    <div className="surface overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Quelle</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Erstellt</TableHead>
            <TableHead>Übernommen</TableHead>
            <TableHead>Kalkulationsvorschlag</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((j) => (
            <TableRow key={j.id} className={cn(j.id === activeId && "bg-accent/30")}>
              <TableCell>
                <div className="max-w-md truncate font-medium" title={j.source_name ?? undefined}>{j.source_name ?? "Dokument"}</div>
                <div className="text-xs text-muted-foreground">{j.source_kind === "url" ? "Link" : "Datei"} · {j.content_type ?? "–"} · {formatBytes(j.file_size)}</div>
              </TableCell>
              <TableCell>
                <StatusBadge tone={tone[j.status]} title={j.error_message ?? undefined}>{importJobStatusLabels[j.status]}</StatusBadge>
                {j.status === "failed" && j.error_message && <div className="mt-1 max-w-xs text-xs text-destructive">{j.error_message}</div>}
              </TableCell>
              <TableCell className="tabular text-muted-foreground">{formatDateTime(j.created_at)}</TableCell>
              <TableCell className="tabular text-muted-foreground">{formatDateTime(j.confirmed_at)}</TableCell>
              <TableCell className="text-muted-foreground">
                {j.estimation_confirmed_at ? `Übernommen ${formatDateTime(j.estimation_confirmed_at)}` : j.estimation_payload ? "Vorschlag offen" : "–"}
              </TableCell>
              <TableCell>
                <Button variant="outline" size="sm" onClick={() => onOpen(j.id)} disabled={j.id === activeId}>Öffnen</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
