import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  Copy,
  GitCompareArrows,
  Info,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { DishDialog } from "@/components/dishes/DishDialog";
import { VariantDialog } from "@/components/dishes/VariantDialog";
import { CalculationItemDialog } from "@/components/dishes/CalculationItemDialog";
import { VariantComparisonDialog } from "@/components/dishes/VariantComparison";
import { MetricValue } from "@/components/dishes/Metric";
import { useAppContext } from "@/lib/app-route";
import {
  categoriesQuery,
  deleteItem,
  deleteVariant,
  dishItemsQuery,
  dishQuery,
  dishVariantsQuery,
  reorderItems,
  setDefaultVariant,
  updateItem,
  updateVariant,
  type CalculationItem,
  type Variant,
} from "@/lib/dishes";
import { ingredientsQuery } from "@/lib/ingredients";
import { activeMenuCardQuery } from "@/lib/menu-cards";
import {
  calculateVariant,
  reviewBlockers,
  suggestedStatus,
  type CalculationStatus,
  type ItemResult,
} from "@/lib/costing";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_app/gerichte/$dishId")({
  head: () => ({
    meta: [
      { title: "Gericht kalkulieren – KundiCalc" },
      { name: "description", content: "Varianten, Kalkulationspositionen und Live-Wareneinsatz eines Gerichts." },
      { property: "og:title", content: "Gericht kalkulieren – KundiCalc" },
      { property: "og:description", content: "Live-Kalkulation von Wareneinsatz und DB I je Variante." },
    ],
  }),
  component: DishDetailPage,
});

const statusTone: Record<CalculationStatus, "warning" | "neutral" | "success"> = {
  estimated: "warning",
  partially_reviewed: "neutral",
  reviewed: "success",
};

type Dialogs =
  | { kind: "none" }
  | { kind: "dish" }
  | { kind: "variant"; mode: "create" | "edit" | "duplicate"; variant?: Variant }
  | { kind: "item"; item?: CalculationItem }
  | { kind: "compare" }
  | { kind: "deleteVariant"; variant: Variant }
  | { kind: "deleteItem"; item: CalculationItem; name: string };

function DishDetailPage() {
  const { dishId } = Route.useParams();
  const { profile } = useAppContext();
  const queryClient = useQueryClient();

  const { data: dish, isPending: dishPending } = useQuery(dishQuery(dishId));
  const { data: categories } = useQuery(categoriesQuery);
  const { data: variants } = useQuery(dishVariantsQuery(dishId));
  const variantIds = useMemo(() => (variants ?? []).map((v) => v.id), [variants]);
  const { data: items } = useQuery({ ...dishItemsQuery(dishId, variantIds), enabled: Boolean(variants) });
  const { data: ingredients } = useQuery(ingredientsQuery);
  const { data: card } = useQuery(activeMenuCardQuery);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialogs>({ kind: "none" });

  useEffect(() => {
    if (!variants || variants.length === 0) return;
    if (!selectedId || !variants.some((v) => v.id === selectedId)) {
      setSelectedId((variants.find((v) => v.is_default) ?? variants[0]!).id);
    }
  }, [variants, selectedId]);

  const ingById = useMemo(() => new Map((ingredients ?? []).map((i) => [i.id, i])), [ingredients]);
  const results = useMemo(() => {
    if (!variants || !items) return [];
    return variants.map((v) =>
      calculateVariant(v, items.filter((it) => it.variant_id === v.id), ingById, card ?? null),
    );
  }, [variants, items, ingById, card]);

  const selected = variants?.find((v) => v.id === selectedId) ?? null;
  const result = results.find((r) => r.variant.id === selectedId) ?? null;
  const selectedItems = useMemo(
    () => (items ?? []).filter((it) => it.variant_id === selectedId).sort((a, b) => a.sort_order - b.sort_order),
    [items, selectedId],
  );

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["variants"] }),
      queryClient.invalidateQueries({ queryKey: ["calculation_items"] }),
    ]);

  const toggleConfirm = useMutation({
    mutationFn: (it: CalculationItem) => updateItem(it.id, { quantity_confirmed: !it.quantity_confirmed }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["calculation_items"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Aktualisierung fehlgeschlagen."),
  });

  const move = useMutation({
    mutationFn: async ({ id, dir }: { id: string; dir: -1 | 1 }) => {
      const idx = selectedItems.findIndex((i) => i.id === id);
      const other = selectedItems[idx + dir];
      if (!other) return;
      const reordered = [...selectedItems];
      reordered[idx] = other;
      reordered[idx + dir] = selectedItems[idx]!;
      await reorderItems(reordered.map((it, i) => ({ id: it.id, sort_order: i + 1 })));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["calculation_items"] }),
  });

  const removeItem = useMutation({
    mutationFn: (id: string) => deleteItem(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["calculation_items"] });
      toast.success("Position entfernt.");
      setDialog({ kind: "none" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Löschen fehlgeschlagen."),
  });

  const removeVariant = useMutation({
    mutationFn: (id: string) => deleteVariant(id),
    onSuccess: async () => {
      await invalidate();
      toast.success("Variante gelöscht.");
      setSelectedId(null);
      setDialog({ kind: "none" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Löschen fehlgeschlagen."),
  });

  const makeDefault = useMutation({
    mutationFn: (id: string) => setDefaultVariant(dishId, id),
    onSuccess: async () => {
      await invalidate();
      toast.success("Standardvariante gesetzt.");
    },
  });

  const setStatus = useMutation({
    mutationFn: (status: CalculationStatus) =>
      updateVariant(selected!.id, { calculation_status: status, updated_by: profile.id }),
    onSuccess: async (_, status) => {
      await invalidate();
      toast.success(`Kalkulationsstatus: ${calculationStatusLabels[status]}.`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Aktualisierung fehlgeschlagen."),
  });

  if (dishPending || !variants || !items || !ingredients) {
    return <Skeleton className="h-96 w-full" />;
  }
  if (!dish) {
    return (
      <div className="surface px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">Dieses Gericht wurde nicht gefunden.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/gerichte"><ArrowLeft className="size-4" /> Zurück zu den Gerichten</Link>
        </Button>
      </div>
    );
  }

  const category = categories?.find((c) => c.id === dish.category_id)?.name;
  const blockers = result ? reviewBlockers(result) : [];
  const suggestion = result ? suggestedStatus(result) : "estimated";
  const cardSmallMaterial = { mode: card?.small_material_mode ?? "percent", value: card ? Number(card.small_material_value) : 0.03 } as const;

  // Group items by component
  const grouped = new Map<string, ItemResult[]>();
  for (const r of result?.items ?? []) {
    const g = r.item.component_group;
    if (!grouped.has(g)) grouped.set(g, []);
    grouped.get(g)!.push(r);
  }
  const groupKeys = Array.from(grouped.keys()).sort((a, b) => (componentGroupOrder[a] ?? 99) - (componentGroupOrder[b] ?? 99));

  return (
    <>
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link to="/gerichte"><ArrowLeft className="size-4" /> Gerichte</Link>
        </Button>
      </div>
      <PageHeader
        title={dish.name}
        description={[category, dish.description, !dish.is_active ? "Inaktiv" : null].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            {variants.length >= 2 && (
              <Button variant="outline" onClick={() => setDialog({ kind: "compare" })}>
                <GitCompareArrows className="size-4" /> Varianten vergleichen
              </Button>
            )}
            <Button variant="outline" onClick={() => setDialog({ kind: "dish" })}>
              <Pencil className="size-4" /> Gericht bearbeiten
            </Button>
          </>
        }
      />

      {dish.notes && <p className="mb-6 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">{dish.notes}</p>}

      {/* Variant tabs */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {variants.length > 0 ? (
          <Tabs value={selectedId ?? ""} onValueChange={setSelectedId}>
            <TabsList className="h-auto flex-wrap">
              {variants.map((v) => (
                <TabsTrigger key={v.id} value={v.id} className="gap-1.5">
                  {v.is_default && <Star className="size-3 fill-current" />}
                  {v.name}
                  <span className="text-xs text-muted-foreground">{formatCHF(Number(v.gross_price))}</span>
                  {!v.is_active && <span className="text-xs text-muted-foreground">(inaktiv)</span>}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : (
          <p className="text-sm text-muted-foreground">Dieses Gericht hat noch keine Variante.</p>
        )}
        <Button variant="outline" size="sm" onClick={() => setDialog({ kind: "variant", mode: "create" })}>
          <Plus className="size-4" /> Variante
        </Button>
      </div>

      {selected && result && (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Left: items */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold">Kalkulation «{selected.name}»</h2>
                <StatusBadge tone={statusTone[selected.calculation_status]}>{calculationStatusLabels[selected.calculation_status]}</StatusBadge>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: "variant", mode: "edit", variant: selected })}>
                  <Pencil className="size-4" /> Bearbeiten
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: "variant", mode: "duplicate", variant: selected })}>
                  <Copy className="size-4" /> Duplizieren
                </Button>
                {!selected.is_default && (
                  <Button size="sm" variant="ghost" onClick={() => makeDefault.mutate(selected.id)}>
                    <Star className="size-4" /> Als Standard
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={variants.length <= 1}
                  onClick={() => setDialog({ kind: "deleteVariant", variant: selected })}
                >
                  <Trash2 className="size-4" /> Löschen
                </Button>
              </div>
            </div>

            {result.items.length === 0 ? (
              <div className="surface px-6 py-10 text-center">
                <p className="text-sm text-muted-foreground">Noch keine Kalkulationspositionen. Fügen Sie Zutaten mit Nettomenge pro Portion hinzu.</p>
                <Button className="mt-4" onClick={() => setDialog({ kind: "item" })}>
                  <Plus className="size-4" /> Position hinzufügen
                </Button>
              </div>
            ) : (
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
                        allItems={selectedItems}
                        onEdit={(it) => setDialog({ kind: "item", item: it })}
                        onDelete={(it, name) => setDialog({ kind: "deleteItem", item: it, name })}
                        onToggle={(it) => toggleConfirm.mutate(it)}
                        onMove={(id, dir) => move.mutate({ id, dir })}
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
            )}
            {result.items.length > 0 && (
              <Button variant="outline" onClick={() => setDialog({ kind: "item" })}>
                <Plus className="size-4" /> Position hinzufügen
              </Button>
            )}
            {selected.notes && <p className="text-sm text-muted-foreground">Notiz zur Variante: {selected.notes}</p>}
          </div>

          {/* Right: live summary */}
          <aside className="space-y-4">
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
                        {result.smallMaterial.source === "variant" ? ", Variante" : ", Speisekarte"})
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

            <div className="surface p-4">
              <h3 className="mb-2 text-sm font-semibold">Prüfung</h3>
              <p className="mb-2 text-xs text-muted-foreground">
                Aktuell: <strong>{calculationStatusLabels[selected.calculation_status]}</strong> · Empfohlen aufgrund der Daten: {calculationStatusLabels[suggestion]}
              </p>
              {blockers.length > 0 ? (
                <ul className="mb-3 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                  {blockers.map((b) => <li key={b}>{b}</li>)}
                </ul>
              ) : (
                <p className="mb-3 text-xs text-muted-foreground">Alle Preise bestätigt und alle Mengen geprüft.</p>
              )}
              <div className="flex flex-col gap-2">
                <Button
                  size="sm"
                  disabled={blockers.length > 0 || selected.calculation_status === "reviewed" || setStatus.isPending}
                  onClick={() => setStatus.mutate("reviewed")}
                >
                  <CheckCircle2 className="size-4" /> Als geprüft markieren
                </Button>
                {selected.calculation_status !== suggestion && suggestion !== "reviewed" && (
                  <Button size="sm" variant="outline" disabled={setStatus.isPending} onClick={() => setStatus.mutate(suggestion)}>
                    Status auf «{calculationStatusLabels[suggestion]}» setzen
                  </Button>
                )}
                {selected.calculation_status === "reviewed" && blockers.length > 0 && (
                  <p className="text-xs text-warning-foreground">
                    Der Status «Geprüft» passt nicht mehr zu den aktuellen Daten.
                  </p>
                )}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Zuletzt geändert: {formatDateTime(selected.updated_at)}</p>
            </div>
          </aside>
        </div>
      )}

      {/* Dialogs */}
      {dialog.kind === "dish" && card && (
        <DishDialog dish={dish} categories={categories ?? []} menuCardId={card.id} open onOpenChange={() => setDialog({ kind: "none" })} />
      )}
      {dialog.kind === "variant" && (
        <VariantDialog
          mode={dialog.mode}
          dishId={dishId}
          userId={profile.id}
          variant={dialog.variant ?? null}
          sourceItems={dialog.mode === "duplicate" ? selectedItems : []}
          cardSmallMaterial={cardSmallMaterial}
          open
          onOpenChange={() => setDialog({ kind: "none" })}
          onSaved={(id) => setSelectedId(id)}
        />
      )}
      {dialog.kind === "item" && selected && (
        <CalculationItemDialog
          variantId={selected.id}
          item={dialog.item ?? null}
          ingredients={ingredients}
          nextSortOrder={(selectedItems.at(-1)?.sort_order ?? 0) + 1}
          open
          onOpenChange={() => setDialog({ kind: "none" })}
        />
      )}
      {dialog.kind === "compare" && (
        <VariantComparisonDialog
          results={[...results].sort((a, b) => (a.variant.id === selectedId ? -1 : b.variant.id === selectedId ? 1 : 0))}
          open
          onOpenChange={() => setDialog({ kind: "none" })}
        />
      )}
      <AlertDialog open={dialog.kind === "deleteVariant"} onOpenChange={(o) => !o && setDialog({ kind: "none" })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Variante löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {dialog.kind === "deleteVariant" && (
                <>«{dialog.variant.name}» wird mit allen {items.filter((i) => i.variant_id === dialog.variant.id).length} Kalkulationspositionen unwiderruflich gelöscht.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => dialog.kind === "deleteVariant" && removeVariant.mutate(dialog.variant.id)}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={dialog.kind === "deleteItem"} onOpenChange={(o) => !o && setDialog({ kind: "none" })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Position entfernen?</AlertDialogTitle>
            <AlertDialogDescription>
              {dialog.kind === "deleteItem" && <>«{dialog.name}» wird aus der Kalkulation dieser Variante entfernt. Die Zutat bleibt im Zutatenstamm erhalten.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => dialog.kind === "deleteItem" && removeItem.mutate(dialog.item.id)}
            >
              Entfernen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SummaryRow({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function Explained({ text, hint }: { text: string; hint: string }) {
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
