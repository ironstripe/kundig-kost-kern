import { RotateCcw } from "lucide-react";
import type { OverrideRow } from "@/lib/scenario-compare";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/layout/StatusBadge";

export function ChangedAssumptions({ rows, onReset }: { rows: OverrideRow[]; onReset: (key: string) => void }) {
  const groups = Array.from(new Set(rows.map((r) => r.group)));
  return (
    <section className="surface">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold">Geänderte Annahmen</h2>
          <p className="text-xs text-muted-foreground">Jede temporäre Änderung einzeln – zurücksetzen ohne das ganze Szenario zu verwerfen.</p>
        </div>
        <StatusBadge tone={rows.length ? "neutral" : "muted"}>{rows.length} Änderungen</StatusBadge>
      </header>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Noch keine temporären Änderungen. Das Szenario entspricht der gespeicherten Basis.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Typ</TableHead>
                <TableHead>Gericht / Zutat</TableHead>
                <TableHead>Variante/Add-on</TableHead>
                <TableHead>Feld</TableHead>
                <TableHead className="text-right">Basis</TableHead>
                <TableHead className="text-right">Szenario</TableHead>
                <TableHead className="text-right">Differenz</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((g) => (
                <GroupRows key={g} group={g} rows={rows.filter((r) => r.group === g)} onReset={onReset} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

function GroupRows({ group, rows, onReset }: { group: string; rows: OverrideRow[]; onReset: (key: string) => void }) {
  return (
    <>
      <TableRow className="bg-secondary/40 hover:bg-secondary/40">
        <TableCell colSpan={8} className="py-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {group}
        </TableCell>
      </TableRow>
      {rows.map((r) => (
        <TableRow key={r.key}>
          <TableCell className="text-muted-foreground">{r.entityLabel}</TableCell>
          <TableCell>{r.subject}</TableCell>
          <TableCell>{r.target}</TableCell>
          <TableCell className="text-muted-foreground">{r.fieldLabel}</TableCell>
          <TableCell className="text-right tabular text-muted-foreground">{r.baseText}</TableCell>
          <TableCell className="text-right tabular font-medium">{r.scenText}</TableCell>
          <TableCell className="text-right tabular">{r.diffText}</TableCell>
          <TableCell className="text-right">
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => onReset(r.key)} aria-label={`${r.fieldLabel} zurücksetzen`}>
              <RotateCcw className="size-3.5" /> Zurücksetzen
            </Button>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
