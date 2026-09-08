import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Copy, GitCompareArrows, Link2Off, Pencil, Plus, PlusCircle, Star, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { DishDialog } from "@/components/dishes/DishDialog";
import { VariantDialog } from "@/components/dishes/VariantDialog";
import { CalculationItemDialog } from "@/components/dishes/CalculationItemDialog";
import { VariantComparisonDialog } from "@/components/dishes/VariantComparison";
import { MetricValue } from "@/components/dishes/Metric";
import { CalculationItemsTable, LiveSummary, ReviewPanel, SummaryRow, statusTone } from "@/components/dishes/CalculationPanels";
import { AddOnDialog } from "@/components/add-ons/AddOnDialog";
import { AssignAddOnDialog } from "@/components/add-ons/AssignAddOnDialog";
import { useAppContext } from "@/lib/app-route";
import {
  allItemsQuery,
  categoriesQuery,
  deleteItem,
  deleteVariant,
  dishQuery,
  dishVariantsQuery,
  dishesQuery,
  reorderItems,
  setDefaultVariant,
  updateItem,
  updateVariant,
  type CalculationItem,
  type Variant,
} from "@/lib/dishes";
import { addOnLinksQuery, addOnsQuery, unlinkAddOn, type AddOn } from "@/lib/add-ons";
import { ingredientsQuery } from "@/lib/ingredients";
import { useMenuCardFor } from "@/lib/selected-menu-card";
import { calculateVariant, combineResults, type CalculationStatus, type VariantResult } from "@/lib/costing";
import { formatCHF } from "@/lib/format";
import { calculationStatusLabels } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export const Route = createFileRoute("/_authenticated/_app/gerichte/$dishId")({
  head: () => ({
    meta: [
      { title: "Gericht kalkulieren – KundiCalc" },
      { name: "description", content: "Varianten, Add-ons, Kalkulationspositionen und Live-Wareneinsatz eines Gerichts." },
      { property: "og:title", content: "Gericht kalkulieren – KundiCalc" },
      { property: "og:description", content: "Live-Kalkulation von Wareneinsatz und DB I je Variante und Add-on." },
    ],
  }),
  component: DishDetailPage,
});

type Dialogs =
  | { kind: "none" }
  | { kind: "dish" }
  | { kind: "variant"; mode: "create" | "edit" | "duplicate"; variant?: Variant }
  | { kind: "item"; item?: CalculationItem }
  | { kind: "compare" }
  | { kind: "assignAddOn" }
  | { kind: "addOn"; addOn?: AddOn }
  | { kind: "unlinkAddOn"; addOn: AddOn }
  | { kind: "deleteVariant"; variant: Variant }
  | { kind: "deleteItem"; item: CalculationItem; name: string };

function DishDetailPage() {
  const { dishId } = Route.useParams();
  const { profile } = useAppContext();
  const queryClient = useQueryClient();

  const { data: dish, isPending: dishPending } = useQuery(dishQuery(dishId));
  const { data: dishes } = useQuery(dishesQuery);
  const { data: categories } = useQuery(categoriesQuery);
  const { data: variants } = useQuery(dishVariantsQuery(dishId));
  const { data: allItems } = useQuery(allItemsQuery);
  const { data: ingredients } = useQuery(ingredientsQuery);
  const { data: card } = useMenuCardFor(dish?.menu_card_id);
  const { data: addOns } = useQuery(addOnsQuery);
  const { data: links } = useQuery(addOnLinksQuery);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialogs>({ kind: "none" });
  const [previewVariantId, setPreviewVariantId] = useState<string | null>(null);
  const [previewAddOnIds, setPreviewAddOnIds] = useState<string[]>([]);

  useEffect(() => {
    if (!variants || variants.length === 0) return;
    if (!selectedId || !variants.some((v) => v.id === selectedId)) {
      setSelectedId((variants.find((v) => v.is_default) ?? variants[0]!).id);
    }
  }, [variants, selectedId]);

  const ingById = useMemo(() => new Map((ingredients ?? []).map((i) => [i.id, i])), [ingredients]);
  const items = useMemo(() => (allItems ?? []).filter((it) => it.variant_id && variants?.some((v) => v.id === it.variant_id)), [allItems, variants]);

  const results = useMemo(() => {
    if (!variants) return [];
    return variants.map((v) => calculateVariant(v, items.filter((it) => it.variant_id === v.id), ingById, card ?? null));
  }, [variants, items, ingById, card]);

  const assignedAddOns = useMemo(() => {
    if (!addOns || !links) return [];
    const ids = new Set(links.filter((l) => l.dish_id === dishId).map((l) => l.add_on_id));
    return addOns.filter((a) => ids.has(a.id)).sort((a, b) => a.name.localeCompare(b.name, "de-CH"));
  }, [addOns, links, dishId]);

  const addOnResults = useMemo(
    () => assignedAddOns.map((a) => calculateVariant(a, (allItems ?? []).filter((it) => it.add_on_id === a.id), ingById, card ?? null)),
    [assignedAddOns, allItems, ingById, card],
  );

  const selected = variants?.find((v) => v.id === selectedId) ?? null;
  const result = results.find((r) => r.variant.id === selectedId) ?? null;
  const selectedItems = useMemo(
    () => items.filter((it) => it.variant_id === selectedId).sort((a, b) => a.sort_order - b.sort_order),
    [items, selectedId],
  );

  const previewVariant = previewVariantId ?? selectedId;
  const combined = useMemo(() => {
    const base = results.find((r) => r.variant.id === previewVariant);
    if (!base) return null;
    const extras = addOnResults.filter((r) => previewAddOnIds.includes(r.variant.id));
    return combineResults([base, ...extras]);
  }, [results, addOnResults, previewVariant, previewAddOnIds]);

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
    mutationFn: (status: CalculationStatus) => updateVariant(selected!.id, { calculation_status: status, updated_by: profile.id }),
    onSuccess: async (_, status) => {
      await invalidate();
      toast.success(`Kalkulationsstatus: ${calculationStatusLabels[status]}.`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Aktualisierung fehlgeschlagen."),
  });

  const unlink = useMutation({
    mutationFn: (addOnId: string) => unlinkAddOn(dishId, addOnId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["add_on_links"] });
      toast.success("Zuordnung entfernt. Das Add-on bleibt bestehen.");
      setDialog({ kind: "none" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Entfernen fehlgeschlagen."),
  });

  if (dishPending || !variants || !allItems || !ingredients || !addOns || !links) {
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
  const cardSmallMaterial = { mode: card?.small_material_mode ?? "percent", value: card ? Number(card.small_material_value) : 0.03 } as const;

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
      <div className="mb-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
      <p className="mb-6 text-xs text-muted-foreground">
        Varianten sind alternative Ausführungen desselben Gerichts (ein Gast wählt eine davon) – auch mit gleichem Verkaufspreis, aber anderer Kalkulation. Add-ons werden zusätzlich dazu bestellt.
      </p>

      {selected && result && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
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

            <CalculationItemsTable
              result={result}
              items={selectedItems}
              emptyHint="Noch keine Kalkulationspositionen. Fügen Sie Zutaten mit Nettomenge pro Portion hinzu."
              onAdd={() => setDialog({ kind: "item" })}
              onEdit={(it) => setDialog({ kind: "item", item: it })}
              onDelete={(it, name) => setDialog({ kind: "deleteItem", item: it, name })}
              onToggle={(it) => toggleConfirm.mutate(it)}
              onMove={(id, dir) => move.mutate({ id, dir })}
            />
            {selected.notes && <p className="text-sm text-muted-foreground">Notiz zur Variante: {selected.notes}</p>}

            {/* Add-ons */}
            <section className="mt-8 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">Add-ons zu diesem Gericht</h2>
                  <p className="text-xs text-muted-foreground">Zusätzlich verkaufte Positionen mit eigenem Aufpreis und eigener Kalkulation – keine Varianten.</p>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => setDialog({ kind: "assignAddOn" })}>
                    <Plus className="size-4" /> Zuordnen
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setDialog({ kind: "addOn" })}>
                    <PlusCircle className="size-4" /> Neues Add-on
                  </Button>
                </div>
              </div>
              {addOnResults.length === 0 ? (
                <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                  Keine Add-ons zugeordnet.
                </div>
              ) : (
                <div className="surface overflow-x-auto border-l-4 border-l-primary/50">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Add-on</TableHead>
                        <TableHead className="text-right">Aufpreis brutto</TableHead>
                        <TableHead className="text-right">Wareneinsatz</TableHead>
                        <TableHead className="text-right">DB I</TableHead>
                        <TableHead className="text-right">DB-I-Marge</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {addOnResults.map((r) => {
                        const a = r.variant as AddOn;
                        return (
                          <TableRow key={a.id}>
                            <TableCell>
                              <Link to="/gerichte/add-ons/$addOnId" params={{ addOnId: a.id }} className="font-medium hover:underline">{a.name}</Link>
                              {!a.is_active && <span className="ml-1 text-xs text-muted-foreground">(inaktiv)</span>}
                            </TableCell>
                            <TableCell className="text-right"><MetricValue value={r.grossPrice} kind="chf" problems={r.problems} /></TableCell>
                            <TableCell className="text-right"><MetricValue value={r.foodCost} kind="chf" problems={r.problems} /></TableCell>
                            <TableCell className="text-right"><MetricValue value={r.contributionMargin1} kind="chf" problems={r.problems} className="font-medium" /></TableCell>
                            <TableCell className="text-right"><MetricValue value={r.contributionMarginRatio} kind="percent" problems={r.problems} /></TableCell>
                            <TableCell><StatusBadge tone={statusTone[a.calculation_status]}>{calculationStatusLabels[a.calculation_status]}</StatusBadge></TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-1">
                                <Button size="icon" variant="ghost" className="size-8" aria-label="Add-on bearbeiten" onClick={() => setDialog({ kind: "addOn", addOn: a })}>
                                  <Pencil className="size-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive" aria-label="Zuordnung entfernen" onClick={() => setDialog({ kind: "unlinkAddOn", addOn: a })}>
                                  <Link2Off className="size-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>

            {/* Combined order preview */}
            {addOnResults.length > 0 && (
              <section className="surface mt-6 p-4">
                <h2 className="text-base font-semibold">Bestellvorschau: Variante + Add-ons</h2>
                <p className="mb-3 text-xs text-muted-foreground">Nur zur Information – es wird keine neue Variante angelegt oder gespeichert.</p>
                <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium">Variante</p>
                      <Select value={previewVariant ?? ""} onValueChange={setPreviewVariantId}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {variants.map((v) => <SelectItem key={v.id} value={v.id}>{v.name} · {formatCHF(Number(v.gross_price))}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium">Add-ons</p>
                      {addOnResults.map((r) => (
                        <label key={r.variant.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={previewAddOnIds.includes(r.variant.id)}
                            onCheckedChange={(c) => setPreviewAddOnIds((prev) => (c === true ? [...prev, r.variant.id] : prev.filter((x) => x !== r.variant.id)))}
                          />
                          {r.variant.name} <span className="text-xs text-muted-foreground">+{formatCHF(Number(r.variant.gross_price))}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  {combined && (
                    <dl className="space-y-2 text-sm">
                      <SummaryRow label="Brutto-VK gesamt" value={<MetricValue value={combined.grossPrice} kind="chf" problems={combined.problems} />} />
                      <SummaryRow label="Netto-VK gesamt" value={<MetricValue value={combined.netPrice} kind="chf" problems={combined.problems} />} />
                      <SummaryRow label="Wareneinsatz gesamt" value={<MetricValue value={combined.foodCost} kind="chf" problems={combined.problems} />} />
                      <SummaryRow label="Wareneinsatzquote" value={<MetricValue value={combined.foodCostRatio} kind="percent" problems={combined.problems} />} />
                      <div className="my-1 border-t" />
                      <SummaryRow label="DB I gesamt" value={<MetricValue value={combined.contributionMargin1} kind="chf" problems={combined.problems} className="text-base font-semibold" />} />
                      <SummaryRow label="DB-I-Marge gesamt" value={<MetricValue value={combined.contributionMarginRatio} kind="percent" problems={combined.problems} />} />
                      <p className="pt-1 text-xs text-muted-foreground">
                        {combined.parts.map((p) => p.variant.name).join(" + ")}. DB I nach Wareneinsatz, kein Gewinn. Enthält ggf. Annahmen.
                      </p>
                    </dl>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* Right: live summary */}
          <aside className="space-y-4">
            <LiveSummary result={result} />
            <ReviewPanel result={result} status={selected.calculation_status} updatedAt={selected.updated_at} pending={setStatus.isPending} onSetStatus={(s) => setStatus.mutate(s)} />
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
          owner={{ variant_id: selected.id }}
          item={dialog.item ?? null}
          ingredients={ingredients}
          nextSortOrder={(selectedItems.at(-1)?.sort_order ?? 0) + 1}
          open
          onOpenChange={() => setDialog({ kind: "none" })}
        />
      )}
      {dialog.kind === "compare" && (
        <VariantComparisonDialog
          results={[...results].sort((a: VariantResult, b: VariantResult) => (a.variant.id === selectedId ? -1 : b.variant.id === selectedId ? 1 : 0))}
          open
          onOpenChange={() => setDialog({ kind: "none" })}
        />
      )}
      {dialog.kind === "assignAddOn" && (
        <AssignAddOnDialog
          dishId={dishId}
          addOns={addOns}
          links={links}
          open
          onOpenChange={() => setDialog({ kind: "none" })}
          onCreateNew={() => setDialog({ kind: "addOn" })}
        />
      )}
      {dialog.kind === "addOn" && card && (
        <AddOnDialog
          addOn={dialog.addOn ?? null}
          menuCardId={card.id}
          dishes={dishes ?? []}
          links={links}
          presetDishId={dishId}
          cardSmallMaterial={cardSmallMaterial}
          open
          onOpenChange={() => setDialog({ kind: "none" })}
        />
      )}
      <AlertDialog open={dialog.kind === "unlinkAddOn"} onOpenChange={(o) => !o && setDialog({ kind: "none" })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zuordnung entfernen?</AlertDialogTitle>
            <AlertDialogDescription>
              {dialog.kind === "unlinkAddOn" && <>«{dialog.addOn.name}» wird von diesem Gericht entfernt. Das Add-on und seine Kalkulation bleiben erhalten.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => dialog.kind === "unlinkAddOn" && unlink.mutate(dialog.addOn.id)}>Entfernen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
