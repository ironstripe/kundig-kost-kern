import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import type { EstimationRow, EstimationState } from "@/lib/import-schema";
import { COMPONENT_GROUPS, componentGroupLabels } from "@/lib/labels";
import { formatCHF, parseDecimal } from "@/lib/format";
import { PACKAGE_TO_BASE } from "@/lib/costing";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Props = { value: EstimationState; onChange: (next: EstimationState) => void; disabled?: boolean };

const BASE_UNITS = ["g", "ml", "piece"] as const;
const PACKAGE_UNITS = ["kg", "g", "l", "ml", "piece"] as const;
const unitLabel: Record<string, string> = { g: "g", ml: "ml", piece: "Stk.", kg: "kg", l: "l" };

function NumberCell({ value, onCommit, disabled, min = 0 }: { value: number; onCommit: (n: number) => void; disabled?: boolean; min?: number }) {
  return (
    <Input
      inputMode="decimal"
      className="h-8 w-20 text-right tabular"
      defaultValue={String(value)}
      key={value}
      disabled={disabled}
      onBlur={(e) => {
        const n = parseDecimal(e.target.value);
        if (Number.isFinite(n) && n >= min && n !== value) onCommit(n);
      }}
    />
  );
}

/** Estimated food cost per portion for one row (same formula as the costing engine, informational). */
function rowCost(r: EstimationRow): number {
  const base = PACKAGE_TO_BASE[r.est_package_unit];
  const factor = r.est_package_unit === "kg" || r.est_package_unit === "l" ? 1000 : 1;
  if (base !== r.quantity_unit) return 0;
  const unitPrice = r.est_package_price / (r.est_package_quantity * factor);
  return (unitPrice * r.net_quantity) / (r.yield_percent / 100);
}

/** Step 5 – review the AI's ingredient/quantity proposal before anything is stored. */
export function EstimationReview({ value, onChange, disabled }: Props) {
  const groups = useMemo(() => {
    const m = new Map<string, EstimationRow[]>();
    for (const r of value.rows) {
      const k = `${r.dish_name} · ${r.variant_name}`;
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return [...m.entries()];
  }, [value.rows]);

  const setRow = (key: string, fn: (r: EstimationRow) => EstimationRow) =>
    onChange({ ...value, rows: value.rows.map((r) => (r.key === key ? fn(r) : r)) });

  const selected = value.rows.filter((r) => !r.excluded);
  const newCount = new Set(selected.filter((r) => !r.match_id).map((r) => r.ingredient_name.trim().toLowerCase())).size;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <StatusBadge tone="warning">KI-Schätzung – alle Werte sind Annahmen</StatusBadge>
        <span>{selected.length} Positionen ausgewählt · {newCount} neue geschätzte Zutat{newCount === 1 ? "" : "en"} · {selected.length - selected.filter((r) => !r.match_id).length} verknüpft mit bestehenden Zutaten</span>
      </div>
      {value.skipped_variants.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Übersprungen (bereits kalkuliert): {value.skipped_variants.map((s) => s.label).join(", ")}
        </p>
      )}

      {groups.map(([label, rows]) => {
        const total = rows.filter((r) => !r.excluded).reduce((s, r) => s + rowCost(r), 0);
        return (
          <section key={label} className="surface overflow-x-auto">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
              <h3 className="font-semibold">{label}</h3>
              <span className="text-xs text-muted-foreground tabular">Geschätzter Wareneinsatz ≈ {formatCHF(total)} (ohne Kleinmaterial)</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Gruppe</TableHead>
                  <TableHead>Zutat</TableHead>
                  <TableHead>Verknüpfung</TableHead>
                  <TableHead className="text-right">Menge</TableHead>
                  <TableHead>Einheit</TableHead>
                  <TableHead className="text-right">Ausbeute %</TableHead>
                  <TableHead>Gebinde (Schätzung)</TableHead>
                  <TableHead className="text-right">EK CHF</TableHead>
                  <TableHead className="text-right">≈ Kosten</TableHead>
                  <TableHead>Begründung</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const linked = !!r.match_id;
                  const off = disabled || r.excluded;
                  return (
                    <TableRow key={r.key} className={cn(r.excluded && "opacity-50")}>
                      <TableCell><Checkbox checked={!r.excluded} disabled={disabled} onCheckedChange={(v) => setRow(r.key, (x) => ({ ...x, excluded: !v }))} aria-label="Position übernehmen" /></TableCell>
                      <TableCell>
                        <Select value={r.component_group} disabled={off} onValueChange={(v) => setRow(r.key, (x) => ({ ...x, component_group: v }))}>
                          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>{COMPONENT_GROUPS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input className="h-8 w-44" value={r.ingredient_name} disabled={off || linked} onChange={(e) => setRow(r.key, (x) => ({ ...x, ingredient_name: e.target.value }))} aria-label="Zutatenname" />
                        {!linked && <Input className="mt-1 h-7 w-44 text-xs" value={r.ingredient_category} disabled={off} onChange={(e) => setRow(r.key, (x) => ({ ...x, ingredient_category: e.target.value }))} aria-label="Zutatenkategorie" placeholder="Kategorie" />}
                      </TableCell>
                      <TableCell>
                        <Select value={r.match_id ?? "__new"} disabled={off} onValueChange={(v) => setRow(r.key, (x) => ({ ...x, match_id: v === "__new" ? null : v }))}>
                          <SelectTrigger className="h-8 w-52" aria-label="Zutat verknüpfen"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__new">Neue Zutat (geschätzt)</SelectItem>
                            {r.candidates.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} · {Math.round(c.score * 100)} %</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {linked && <p className="mt-1 text-[11px] text-muted-foreground">Bestehender EK wird verwendet</p>}
                      </TableCell>
                      <TableCell className="text-right"><NumberCell value={r.net_quantity} disabled={off} onCommit={(n) => setRow(r.key, (x) => ({ ...x, net_quantity: n }))} /></TableCell>
                      <TableCell>
                        <Select value={r.quantity_unit} disabled={off} onValueChange={(v) => setRow(r.key, (x) => ({ ...x, quantity_unit: v as EstimationRow["quantity_unit"], est_base_unit: linked ? x.est_base_unit : (v as EstimationRow["est_base_unit"]) }))}>
                          <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                          <SelectContent>{BASE_UNITS.map((u) => <SelectItem key={u} value={u}>{unitLabel[u]}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right"><NumberCell value={r.yield_percent} min={1} disabled={off} onCommit={(n) => setRow(r.key, (x) => ({ ...x, yield_percent: Math.min(100, n) }))} /></TableCell>
                      <TableCell>
                        {linked ? <span className="text-xs text-muted-foreground">–</span> : (
                          <div className="flex items-center gap-1">
                            <NumberCell value={r.est_package_quantity} disabled={off} onCommit={(n) => setRow(r.key, (x) => ({ ...x, est_package_quantity: n }))} />
                            <Select value={r.est_package_unit} disabled={off} onValueChange={(v) => setRow(r.key, (x) => ({ ...x, est_package_unit: v as EstimationRow["est_package_unit"], est_base_unit: PACKAGE_TO_BASE[v as EstimationRow["est_package_unit"]] as EstimationRow["est_base_unit"], quantity_unit: PACKAGE_TO_BASE[v as EstimationRow["est_package_unit"]] as EstimationRow["quantity_unit"] }))}>
                              <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                              <SelectContent>{PACKAGE_UNITS.map((u) => <SelectItem key={u} value={u}>{unitLabel[u]}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{linked ? <span className="text-xs text-muted-foreground">–</span> : <NumberCell value={r.est_package_price} disabled={off} onCommit={(n) => setRow(r.key, (x) => ({ ...x, est_package_price: n }))} />}</TableCell>
                      <TableCell className="text-right tabular text-muted-foreground">{linked ? "–" : formatCHF(rowCost(r))}</TableCell>
                      <TableCell className="max-w-56">
                        <p className="text-xs text-muted-foreground">{r.note}</p>
                        {r.warnings.map((w, i) => <p key={i} className="flex items-center gap-1 text-xs text-warning-foreground"><AlertTriangle className="size-3" /> {w}</p>)}
                        <p className="text-[11px] text-muted-foreground">{componentGroupLabels[r.component_group] ?? r.component_group}</p>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </section>
        );
      })}
    </div>
  );
}
