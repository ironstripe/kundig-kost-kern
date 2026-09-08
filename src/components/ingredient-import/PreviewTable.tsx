import { AlertTriangle, Pencil } from "lucide-react";
import type { Ingredient } from "@/lib/ingredients";
import { rowStatusLabels, type PreviewRow, type RowEvaluation } from "@/lib/ingredient-import-state";
import { matchLevelLabels, rowActionLabels, rowUnitPrice, type RowAction } from "@/lib/ingredient-import-schema";
import { formatCHF, formatDate, formatPercent, formatQuantity, formatUnitPrice } from "@/lib/format";
import { baseUnitLabels, packageUnitLabels } from "@/lib/labels";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Props = {
  rows: PreviewRow[];
  evaluations: Map<number, RowEvaluation>;
  existing: Ingredient[];
  selected: Set<number>;
  onToggleSelect: (row: number, on: boolean) => void;
  onToggleAll: (on: boolean) => void;
  onAction: (row: number, action: RowAction) => void;
  onMatch: (row: number, id: string | null) => void;
  onApprove: (row: number, on: boolean) => void;
  onEdit: (row: number) => void;
};

const statusTone = { valid: "success", warning: "warning", error: "warning" } as const;

export function PreviewTable({ rows, evaluations, existing, selected, onToggleSelect, onToggleAll, onAction, onMatch, onApprove, onEdit }: Props) {
  const byId = new Map(existing.map((i) => [i.id, i]));
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.row));
  return (
    <div className="surface overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8"><Checkbox aria-label="Alle auswählen" checked={allSelected} onCheckedChange={(c) => onToggleAll(c === true)} /></TableHead>
            <TableHead>Zeile</TableHead>
            <TableHead>Zutatenname</TableHead>
            <TableHead>Kategorie</TableHead>
            <TableHead>Lieferant</TableHead>
            <TableHead>Gebinde</TableHead>
            <TableHead className="text-right">Preis</TableHead>
            <TableHead className="text-right">EK je Basiseinheit</TableHead>
            <TableHead>Preisstand</TableHead>
            <TableHead>Eigene Produktion</TableHead>
            <TableHead>Erkannte Übereinstimmung</TableHead>
            <TableHead>Aktion</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const ev = evaluations.get(r.row)!;
            const v = r.values;
            const up = rowUnitPrice(v);
            const target = ev.target;
            return (
              <TableRow key={r.row} className={cn(ev.status === "error" && r.action !== "skip" && "bg-destructive/5", r.action === "skip" && "opacity-70")}>
                <TableCell><Checkbox aria-label={`Zeile ${r.row} auswählen`} checked={selected.has(r.row)} onCheckedChange={(c) => onToggleSelect(r.row, c === true)} /></TableCell>
                <TableCell className="tabular text-muted-foreground">{r.row}</TableCell>
                <TableCell className="font-medium">
                  {v.name || <span className="text-destructive">–</span>}
                  {r.edited && <span className="ml-2 text-xs text-muted-foreground">korrigiert</span>}
                </TableCell>
                <TableCell>{v.category || "–"}</TableCell>
                <TableCell className="text-muted-foreground">{v.supplier ?? "–"}</TableCell>
                <TableCell className="tabular whitespace-nowrap">
                  {v.package_quantity !== null && v.package_unit ? formatQuantity(v.package_quantity, packageUnitLabels[v.package_unit]) : "–"}
                  {v.package_label && <span className="block text-xs text-muted-foreground">{v.package_label}</span>}
                </TableCell>
                <TableCell className="tabular text-right whitespace-nowrap">{v.package_price !== null ? formatCHF(v.package_price) : "–"}</TableCell>
                <TableCell className="tabular text-right whitespace-nowrap">
                  {up !== null && v.base_unit ? formatUnitPrice(up, baseUnitLabels[v.base_unit]) : "–"}
                  {ev.priceDiff && ev.priceDiff.oldUnit !== null && v.base_unit && (
                    <span className="block text-xs text-muted-foreground">
                      bisher {formatUnitPrice(ev.priceDiff.oldUnit, baseUnitLabels[v.base_unit])}
                      {ev.priceDiff.chf !== null && ev.priceDiff.pct !== null && (
                        <> · {ev.priceDiff.chf >= 0 ? "+" : "−"}{formatUnitPrice(Math.abs(ev.priceDiff.chf), baseUnitLabels[v.base_unit])} ({ev.priceDiff.pct >= 0 ? "+" : "−"}{formatPercent(Math.abs(ev.priceDiff.pct))})</>
                      )}
                    </span>
                  )}
                </TableCell>
                <TableCell className="tabular">{v.price_date ? formatDate(v.price_date) : <span className="text-muted-foreground">Importdatum</span>}</TableCell>
                <TableCell>{v.is_own_production === null ? "–" : v.is_own_production ? "Ja" : "Nein"}</TableCell>
                <TableCell className="min-w-56">
                  <div className="text-xs text-muted-foreground">{matchLevelLabels[r.matchLevel]}</div>
                  {r.matchLevel === "exact" && target && (
                    <div className="text-sm">{target.name}</div>
                  )}
                  {r.matchLevel !== "exact" && (r.candidates.length > 0 || r.action === "update") && (
                    <Select value={r.matchId ?? "none"} onValueChange={(val) => onMatch(r.row, val === "none" ? null : val)}>
                      <SelectTrigger className="mt-1 h-8"><SelectValue placeholder="Zutat zuordnen" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Keine Zuordnung</SelectItem>
                        {r.candidates.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} ({Math.round(c.score * 100)} %)</SelectItem>)}
                        {r.matchId && !r.candidates.some((c) => c.id === r.matchId) && byId.get(r.matchId) && (
                          <SelectItem value={r.matchId}>{byId.get(r.matchId)!.name}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                  {ev.confirmedOverwrite && r.action === "update" && (
                    <label className="mt-2 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs">
                      <Checkbox className="mt-0.5" checked={r.approved} onCheckedChange={(c) => onApprove(r.row, c === true)} />
                      <span>
                        <AlertTriangle className="mr-1 inline size-3" />
                        Bestätigter Preis: {target && formatCHF(Number(target.package_price))} je {target && formatQuantity(Number(target.package_quantity), packageUnitLabels[target.package_unit])} → neu {v.package_price !== null ? formatCHF(v.package_price) : "–"}. Überschreiben ausdrücklich freigeben.
                      </span>
                    </label>
                  )}
                </TableCell>
                <TableCell className="min-w-44">
                  <Select value={r.action} onValueChange={(val) => onAction(r.row, val as RowAction)}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(rowActionLabels) as RowAction[]).map((a) => <SelectItem key={a} value={a}>{rowActionLabels[a]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="min-w-56">
                  <StatusBadge tone={statusTone[ev.status]}>{rowStatusLabels[ev.status]}</StatusBadge>
                  {(ev.blocking.length > 0 || ev.warnings.length > 0) && (
                    <ul className="mt-1 space-y-0.5 text-xs">
                      {ev.blocking.map((m) => <li key={m} className="text-destructive">{m}</li>)}
                      {ev.warnings.map((m) => <li key={m} className="text-muted-foreground">{m}</li>)}
                    </ul>
                  )}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" aria-label={`Zeile ${r.row} bearbeiten`} onClick={() => onEdit(r.row)}><Pencil className="size-3.5" /></Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
