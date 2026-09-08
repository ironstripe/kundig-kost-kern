/**
 * Shared calculation UI used by dish variants and add-ons:
 * - CalculationItemsTable: grouped positions with edit/reorder/confirm actions
 * - LiveSummary: financial summary of one VariantResult
 * - ReviewPanel: review blockers and status actions
 */
import { ArrowDown, ArrowUp, CheckCircle2, Info, Pencil, Plus, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { MetricValue } from "@/components/dishes/Metric";
import type { CalculationItem } from "@/lib/dishes";
import { reviewBlockers, suggestedStatus, type CalculationStatus, type ItemResult, type VariantResult } from "@/lib/costing";
import { formatCHF, formatDateTime, formatPercent, formatQuantity, formatUnitPrice } from "@/lib/format";
import {
  baseUnitLabels,
  calculationStatusLabels,
  componentGroupLabels,
  componentGroupOrder,
  metricExplanations,
  priceStatusLabels,
  quantitySourceLabels,
} from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export const statusTone: Record<CalculationStatus, "warning" | "neutral" | "success"> = {
  estimated: "warning",
  partially_reviewed: "neutral",
  reviewed: "success",
};

// ---------------------------------------------------------------------------
// Items table
// ---------------------------------------------------------------------------

type TableProps = {
  result: VariantResult;
  items: CalculationItem[];
  emptyHint: string;
  onAdd: () => void;
  onEdit: (it: CalculationItem) => void;
  onDelete: (it: CalculationItem, name: string) => void;
  onToggle: (it: CalculationItem) => void;
  onMove: (id: string, dir: -1 | 1) => void;
};

export function CalculationItemsTable({ result, items, emptyHint, onAdd, onEdit, onDelete, onToggle, onMove }: TableProps) {
  const grouped = new Map<string, ItemResult[]>();
  for (const r of result.items) {
    const g = r.item.component_group;
    if (!grouped.has(g)) grouped.set(g, []);
    grouped.get(g)!.push(r);
  }
  const groupKeys = Array.from(grouped.keys()).sort((a, b) => (componentGroupOrder[a] ?? 99) - (componentGroupOrder[b] ?? 99));

  if (result.items.length === 0) {
    return (
      <div className="surface px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">{emptyHint}</p>
        <Button className="mt-4" onClick={onAdd}>
          <Plus className="size-4" /> Position hinzufügen
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="surface overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Zutat</TableHead>
              <TableHead className="text-right">Netto</TableHead>
              <TableHead className="text-right">Ausbeute</TableHead>
              <TableHead className="text-right">Brutto</TableHead>
              <TableHead className="text-right">EK/Einheit</TableHead>
              <TableHead className="text-right">Kosten</TableHead>
              <TableHead>Quelle</TableHead>
              <TableHead className="text-center">Bestätigt</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupKeys.map((g) => (
              <GroupRows
                key={g}
                label={componentGroupLabels[g] ?? g}
                rows={grouped.get(g)!}
                allItems={items}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggle={onToggle}
                onMove={onMove}
              />
            ))}
            <TableRow className="bg-muted/30 font-medium">
              <TableCell colSpan={6}>Warenkosten Zutaten</TableCell>
              <TableCell className="text-right"><MetricValue value={result.ingredientCost} kind="chf" problems={result.problems} /></TableCell>
              <TableCell colSpan={3} />
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <Button variant="outline" onClick={onAdd}>
        <Plus className="size-4" /> Position hinzufügen
      </Button>
    </>
  );
}

function GroupRows({
  label,
  rows,
  allItems,
  onEdit,
  onDelete,
  onToggle,
  onMove,
}: {
  label: string;
  rows: ItemResult[];
  allItems: CalculationItem[];
  onEdit: (it: CalculationItem) => void;
  onDelete: (it: CalculationItem, name: string) => void;
  onToggle: (it: CalculationItem) => void;
  onMove: (id: string, dir: -1 | 1) => void;
}) {
  return (
    <>
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={10} className="bg-muted/20 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {label}
        </TableCell>
      </TableRow>
      {rows.map((r) => {
        const it = allItems.find((i) => i.id === r.item.id)!;
        const idx = allItems.findIndex((i) => i.id === it.id);
        const ing = r.ingredient;
        const unit = ing ? baseUnitLabels[ing.base_unit] : baseUnitLabels[it.quantity_unit];
        const estimatedPrice = ing?.price_status === "estimated";
        return (
          <TableRow key={it.id} className={cn(r.problem && "bg-warning/5")}>
            <TableCell className="px-1">
              <div className="flex flex-col">
                <button type="button" className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={idx === 0} onClick={() => onMove(it.id, -1)} aria-label="Nach oben">
                  <ArrowUp className="size-3" />
                </button>
                <button type="button" className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={idx === allItems.length - 1} onClick={() => onMove(it.id, 1)} aria-label="Nach unten">
                  <ArrowDown className="size-3" />
                </button>
              </div>
            </TableCell>
            <TableCell>
              <div className="font-medium">{ing?.name ?? <span className="text-destructive">Zutat fehlt</span>}</div>
              <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                {ing && (
                  <StatusBadge tone={estimatedPrice ? "warning" : "success"} className="px-1.5 py-0 text-[10px]">
                    EK {priceStatusLabels[ing.price_status]}
                  </StatusBadge>
                )}
                {ing && !ing.is_active && <StatusBadge tone="muted" className="px-1.5 py-0 text-[10px]">Zutat inaktiv</StatusBadge>}
                {r.problem && <span className="text-warning-foreground">{r.problem}</span>}
                {it.notes && <span>{it.notes}</span>}
              </div>
            </TableCell>
            <TableCell className="text-right tabular">{formatQuantity(Number(it.net_quantity), unit)}</TableCell>
            <TableCell className="text-right tabular">{formatPercent(Number(it.yield_percent) / 100, 0)}</TableCell>
            <TableCell className="text-right tabular">{r.grossQuantity !== null ? formatQuantity(r.grossQuantity, unit) : "–"}</TableCell>
            <TableCell className="text-right tabular text-muted-foreground">{r.unitPrice !== null && ing ? formatUnitPrice(r.unitPrice, unit) : "–"}</TableCell>
            <TableCell className="text-right tabular font-medium">{r.cost !== null ? formatCHF(r.cost) : <span className="text-xs text-muted-foreground italic">Unvollständig</span>}</TableCell>
            <TableCell className="text-xs text-muted-foreground">{quantitySourceLabels[it.quantity_source]}</TableCell>
            <TableCell className="text-center">
              <Checkbox checked={it.quantity_confirmed} onCheckedChange={() => onToggle(it)} aria-label="Menge bestätigt" />
            </TableCell>
            <TableCell>
              <div className="flex justify-end gap-1">
                <Button size="icon" variant="ghost" className="size-8" onClick={() => onEdit(it)} aria-label="Bearbeiten">
                  <Pencil className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive" onClick={() => onDelete(it, ing?.name ?? "Position")} aria-label="Entfernen">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Live summary
// ---------------------------------------------------------------------------

export function SummaryRow({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

export function Explained({ text, hint }: { text: string; hint: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-help items-center gap-1">
          {text} <Info className="size-3 opacity-60" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{hint}</TooltipContent>
    </Tooltip>
  );
}

export function LiveSummary({ result, ownerLabel = "Variante" }: { result: VariantResult; ownerLabel?: string }) {
  return (
    <div className="surface p-4">
      <h3 className="mb-3 text-sm font-semibold">Live-Kalkulation</h3>
      <dl className="space-y-2 text-sm">
        <SummaryRow label="Brutto-VK (inkl. 8.1 % MWST)" value={<MetricValue value={result.grossPrice} kind="chf" problems={result.problems} />} />
        <SummaryRow label="Netto-VK" value={<MetricValue value={result.netPrice} kind="chf" problems={result.problems} />} />
        <SummaryRow label="Warenkosten Zutaten" value={<MetricValue value={result.ingredientCost} kind="chf" problems={result.problems} />} />
        <SummaryRow
          label={
            <span>
              Kleinmaterial{" "}
              <span className="text-xs text-muted-foreground">
                ({result.smallMaterial.mode === "percent" ? formatPercent(result.smallMaterial.value) : formatCHF(result.smallMaterial.value)}
                {result.smallMaterial.source === "variant" ? `, ${ownerLabel}` : ", Speisekarte"})
              </span>
            </span>
          }
          value={<MetricValue value={result.smallMaterialCost} kind="chf" problems={result.problems} />}
        />
        <SummaryRow label={<Explained text="Wareneinsatz" hint={metricExplanations.foodCost} />} value={<MetricValue value={result.foodCost} kind="chf" problems={result.problems} className="font-medium" />} />
        <SummaryRow label="Wareneinsatzquote" value={<MetricValue value={result.foodCostRatio} kind="percent" problems={result.problems} />} />
        <div className="my-2 border-t" />
        <SummaryRow label={<Explained text="DB I" hint={metricExplanations.contributionMargin} />} value={<MetricValue value={result.contributionMargin1} kind="chf" problems={result.problems} className="text-base font-semibold" />} />
        <SummaryRow label={<Explained text="DB-I-Marge" hint={metricExplanations.margin} />} value={<MetricValue value={result.contributionMarginRatio} kind="percent" problems={result.problems} />} />
      </dl>
      {result.problems.length > 0 && (
        <ul className="mt-3 list-disc space-y-0.5 pl-4 text-xs text-warning-foreground">
          {result.problems.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        DB I nach Wareneinsatz – kein Gewinn. {result.hasEstimatedPrices || result.hasUnconfirmedQuantities ? "Enthält geschätzte Preise oder unbestätigte Mengen (Annahmen)." : ""}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review panel
// ---------------------------------------------------------------------------

export function ReviewPanel({
  result,
  status,
  updatedAt,
  pending,
  onSetStatus,
}: {
  result: VariantResult;
  status: CalculationStatus;
  updatedAt: string;
  pending: boolean;
  onSetStatus: (s: CalculationStatus) => void;
}) {
  const blockers = reviewBlockers(result);
  const suggestion = suggestedStatus(result);
  return (
    <div className="surface p-4">
      <h3 className="mb-2 text-sm font-semibold">Prüfung</h3>
      <p className="mb-2 text-xs text-muted-foreground">
        Aktuell: <strong>{calculationStatusLabels[status]}</strong> · Empfohlen aufgrund der Daten: {calculationStatusLabels[suggestion]}
      </p>
      {blockers.length > 0 ? (
        <ul className="mb-3 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
          {blockers.map((b) => <li key={b}>{b}</li>)}
        </ul>
      ) : (
        <p className="mb-3 text-xs text-muted-foreground">Alle Preise bestätigt und alle Mengen geprüft.</p>
      )}
      <div className="flex flex-col gap-2">
        <Button size="sm" disabled={blockers.length > 0 || status === "reviewed" || pending} onClick={() => onSetStatus("reviewed")}>
          <CheckCircle2 className="size-4" /> Als geprüft markieren
        </Button>
        {status !== suggestion && suggestion !== "reviewed" && (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => onSetStatus(suggestion)}>
            Status auf «{calculationStatusLabels[suggestion]}» setzen
          </Button>
        )}
        {status === "reviewed" && blockers.length > 0 && (
          <p className="text-xs text-warning-foreground">Der Status «Geprüft» passt nicht mehr zu den aktuellen Daten.</p>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Zuletzt geändert: {formatDateTime(updatedAt)}</p>
    </div>
  );
}
