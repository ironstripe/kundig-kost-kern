import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Power, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { CalculationItemDialog } from "@/components/dishes/CalculationItemDialog";
import { CalculationItemsTable, LiveSummary, ReviewPanel, statusTone } from "@/components/dishes/CalculationPanels";
import { AddOnDialog } from "@/components/add-ons/AddOnDialog";
import { addOnLinksQuery, addOnQuery, updateAddOn } from "@/lib/add-ons";
import { allItemsQuery, allVariantsQuery, deleteItem, dishesQuery, reorderItems, updateItem, type CalculationItem } from "@/lib/dishes";
import { ingredientsQuery } from "@/lib/ingredients";
import { useMenuCardFor } from "@/lib/selected-menu-card";
import { calculateVariant, type CalculationStatus } from "@/lib/costing";
import { addOnSalesWarning, expectedTotalSales, openDaysCount } from "@/lib/sales";
import { calculationStatusLabels } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

export const Route = createFileRoute("/_authenticated/_app/gerichte/add-ons/$addOnId")({
  head: () => ({
    meta: [
      { title: "Add-on kalkulieren – KundiCalc" },
      { name: "description", content: "Kalkulationspositionen, Wareneinsatz und DB I eines Add-ons." },
      { property: "og:title", content: "Add-on kalkulieren – KundiCalc" },
      { property: "og:description", content: "Live-Kalkulation eines Add-ons." },
    ],
  }),
  component: AddOnDetailPage,
});

type Dialogs =
  | { kind: "none" }
  | { kind: "edit" }
  | { kind: "item"; item?: CalculationItem }
  | { kind: "deleteItem"; item: CalculationItem; name: string };

function AddOnDetailPage() {
  const { addOnId } = Route.useParams();
  const queryClient = useQueryClient();

  const { data: addOn, isPending } = useQuery(addOnQuery(addOnId));
  const { data: links } = useQuery(addOnLinksQuery);
  const { data: dishes } = useQuery(dishesQuery);
  const { data: variants } = useQuery(allVariantsQuery);
  const { data: allItems } = useQuery(allItemsQuery);
  const { data: ingredients } = useQuery(ingredientsQuery);
  const { data: card } = useMenuCardFor(addOn?.menu_card_id);
  const [dialog, setDialog] = useState<Dialogs>({ kind: "none" });

  const ingById = useMemo(() => new Map((ingredients ?? []).map((i) => [i.id, i])), [ingredients]);
  const items = useMemo(
    () => (allItems ?? []).filter((it) => it.add_on_id === addOnId).sort((a, b) => a.sort_order - b.sort_order),
    [allItems, addOnId],
  );
  const result = useMemo(() => (addOn ? calculateVariant(addOn, items, ingById, card ?? null) : null), [addOn, items, ingById, card]);

  const assignedDishes = useMemo(() => {
    const ids = new Set((links ?? []).filter((l) => l.add_on_id === addOnId).map((l) => l.dish_id));
    return (dishes ?? []).filter((d) => ids.has(d.id));
  }, [links, dishes, addOnId]);

  const openDays = useMemo(() => openDaysCount(card ?? null), [card]);
  const warning = useMemo(() => {
    if (!addOn || !variants) return null;
    const dishIds = new Set(assignedDishes.map((d) => d.id));
    return addOnSalesWarning(addOn, variants.filter((v) => dishIds.has(v.dish_id) && v.is_active), openDays);
  }, [addOn, variants, assignedDishes, openDays]);

  const invalidateItems = () => queryClient.invalidateQueries({ queryKey: ["calculation_items"] });

  const toggleConfirm = useMutation({
    mutationFn: (it: CalculationItem) => updateItem(it.id, { quantity_confirmed: !it.quantity_confirmed }),
    onSuccess: invalidateItems,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Aktualisierung fehlgeschlagen."),
  });
  const move = useMutation({
    mutationFn: async ({ id, dir }: { id: string; dir: -1 | 1 }) => {
      const idx = items.findIndex((i) => i.id === id);
      const other = items[idx + dir];
      if (!other) return;
      const reordered = [...items];
      reordered[idx] = other;
      reordered[idx + dir] = items[idx]!;
      await reorderItems(reordered.map((it, i) => ({ id: it.id, sort_order: i + 1 })));
    },
    onSuccess: invalidateItems,
  });
  const removeItem = useMutation({
    mutationFn: (id: string) => deleteItem(id),
    onSuccess: async () => {
      await invalidateItems();
      toast.success("Position entfernt.");
      setDialog({ kind: "none" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Löschen fehlgeschlagen."),
  });
  const setStatus = useMutation({
    mutationFn: (status: CalculationStatus) => updateAddOn(addOnId, { calculation_status: status }),
    onSuccess: async (_, status) => {
      await queryClient.invalidateQueries({ queryKey: ["add_ons"] });
      toast.success(`Kalkulationsstatus: ${calculationStatusLabels[status]}.`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Aktualisierung fehlgeschlagen."),
  });
  const toggleActive = useMutation({
    mutationFn: () => updateAddOn(addOnId, { is_active: !addOn!.is_active }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["add_ons"] });
      toast.success(addOn!.is_active ? "Add-on deaktiviert. Zuordnungen und Kalkulation bleiben erhalten." : "Add-on reaktiviert.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Aktualisierung fehlgeschlagen."),
  });

  if (isPending || !allItems || !ingredients || !links) return <Skeleton className="h-96 w-full" />;
  if (!addOn || !result) {
    return (
      <div className="surface px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">Dieses Add-on wurde nicht gefunden.</p>
        <Button asChild variant="outline" className="mt-4"><Link to="/gerichte/add-ons"><ArrowLeft className="size-4" /> Zurück zu den Add-ons</Link></Button>
      </div>
    );
  }

  const expectedTotal = expectedTotalSales(addOn, openDays);

  return (
    <>
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link to="/gerichte/add-ons"><ArrowLeft className="size-4" /> Add-ons</Link>
        </Button>
      </div>
      <PageHeader
        title={addOn.name}
        description={`Add-on · Aufpreis ${new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(Number(addOn.gross_price))}${addOn.is_active ? "" : " · Inaktiv"}`}
        actions={
          <>
            <Button variant="outline" onClick={() => toggleActive.mutate()} disabled={toggleActive.isPending}>
              <Power className="size-4" /> {addOn.is_active ? "Deaktivieren" : "Reaktivieren"}
            </Button>
            <Button variant="outline" onClick={() => setDialog({ kind: "edit" })}>
              <Pencil className="size-4" /> Add-on bearbeiten
            </Button>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
        <StatusBadge tone={statusTone[addOn.calculation_status]}>{calculationStatusLabels[addOn.calculation_status]}</StatusBadge>
        <span className="text-muted-foreground">Zugeordnet zu:</span>
        {assignedDishes.length === 0 && <span className="text-muted-foreground italic">keinem Gericht</span>}
        {assignedDishes.map((d) => (
          <Link key={d.id} to="/gerichte/$dishId" params={{ dishId: d.id }} className="rounded-md border px-2 py-0.5 hover:bg-muted/50">{d.name}</Link>
        ))}
      </div>

      {warning && (
        <div className="mb-6 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
          <div>
            <p className="font-medium">Hinweis zur Absatzplausibilität</p>
            <p className="text-muted-foreground">{warning}</p>
          </div>
        </div>
      )}

      {addOn.notes && <p className="mb-6 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">{addOn.notes}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <h2 className="text-base font-semibold">Kalkulation pro verkauftem Add-on</h2>
          <CalculationItemsTable
            result={result}
            items={items}
            emptyHint="Noch keine Kalkulationspositionen. Fügen Sie die Zutaten hinzu, die pro verkauftem Add-on anfallen."
            onAdd={() => setDialog({ kind: "item" })}
            onEdit={(it) => setDialog({ kind: "item", item: it })}
            onDelete={(it, name) => setDialog({ kind: "deleteItem", item: it, name })}
            onToggle={(it) => toggleConfirm.mutate(it)}
            onMove={(id, dir) => move.mutate({ id, dir })}
          />
          <div className="surface p-4 text-sm">
            <h3 className="mb-1 font-semibold">Erwarteter Absatz <span className="text-xs font-normal text-muted-foreground">(Annahme)</span></h3>
            <p className="text-muted-foreground">
              {addOn.sales_input_mode === "per_open_day"
                ? `${Number(addOn.expected_per_open_day).toLocaleString("de-CH")} pro Öffnungstag · ${openDays} Öffnungstage im Zeitraum`
                : "Gesamt im Zeitraum"}
              {expectedTotal !== null && ` · gesamt ${Math.round(expectedTotal).toLocaleString("de-CH")} Stück`}
            </p>
          </div>
        </div>
        <aside className="space-y-4">
          <LiveSummary result={result} ownerLabel="Add-on" />
          <ReviewPanel result={result} status={addOn.calculation_status} updatedAt={addOn.updated_at} pending={setStatus.isPending} onSetStatus={(s) => setStatus.mutate(s)} />
        </aside>
      </div>

      {dialog.kind === "edit" && card && (
        <AddOnDialog
          addOn={addOn}
          menuCardId={card.id}
          dishes={dishes ?? []}
          links={links}
          cardSmallMaterial={{ mode: card.small_material_mode, value: Number(card.small_material_value) }}
          open
          onOpenChange={() => setDialog({ kind: "none" })}
        />
      )}
      {dialog.kind === "item" && (
        <CalculationItemDialog
          owner={{ add_on_id: addOnId }}
          item={dialog.item ?? null}
          ingredients={ingredients}
          nextSortOrder={(items.at(-1)?.sort_order ?? 0) + 1}
          open
          onOpenChange={() => setDialog({ kind: "none" })}
        />
      )}
      <AlertDialog open={dialog.kind === "deleteItem"} onOpenChange={(o) => !o && setDialog({ kind: "none" })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Position entfernen?</AlertDialogTitle>
            <AlertDialogDescription>
              {dialog.kind === "deleteItem" && <>«{dialog.name}» wird aus der Kalkulation dieses Add-ons entfernt. Die Zutat bleibt im Zutatenstamm erhalten.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => dialog.kind === "deleteItem" && removeItem.mutate(dialog.item.id)}>
              Entfernen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
