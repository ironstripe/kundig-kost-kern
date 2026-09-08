import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Carrot, Pencil, Plus, Search, Trash2, ArchiveRestore, Archive } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { IngredientDialog } from "@/components/ingredients/IngredientDialog";
import {
  deleteIngredient,
  ingredientUsageQuery,
  ingredientsQuery,
  updateIngredient,
  type Ingredient,
} from "@/lib/ingredients";
import { unitPrice } from "@/lib/costing";
import { formatCHF, formatDate, formatQuantity, formatUnitPrice } from "@/lib/format";
import { baseUnitLabels, packageUnitLabels, priceStatusLabels } from "@/lib/labels";
import { useAppContext } from "@/lib/app-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export const Route = createFileRoute("/_authenticated/_app/zutaten")({
  head: () => ({
    meta: [
      { title: "Zutaten & EK – KundiCalc" },
      { name: "description", content: "Zutaten und aktuelle Einkaufspreise zentral pflegen." },
      { property: "og:title", content: "Zutaten & EK – KundiCalc" },
      { property: "og:description", content: "Zutaten und Einkaufspreise." },
    ],
  }),
  component: IngredientsPage,
});

type PriceFilter = "all" | "estimated" | "confirmed";
type ActiveFilter = "active" | "inactive" | "all";

function IngredientsPage() {
  const { user } = useAppContext();
  const queryClient = useQueryClient();
  const { data: ingredients, isPending } = useQuery(ingredientsQuery);
  const { data: usage } = useQuery(ingredientUsageQuery);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("all");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("active");
  const [dialog, setDialog] = useState<{ open: boolean; ingredient: Ingredient | null }>({ open: false, ingredient: null });
  const [confirm, setConfirm] = useState<{ kind: "deactivate" | "delete"; ingredient: Ingredient } | null>(null);

  const categories = useMemo(
    () => Array.from(new Set((ingredients ?? []).map((i) => i.category))).sort((a, b) => a.localeCompare(b, "de-CH")),
    [ingredients],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (ingredients ?? []).filter((i) => {
      if (activeFilter === "active" && !i.is_active) return false;
      if (activeFilter === "inactive" && i.is_active) return false;
      if (category !== "all" && i.category !== category) return false;
      if (priceFilter !== "all" && i.price_status !== priceFilter) return false;
      if (q && !`${i.name} ${i.category} ${i.supplier ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [ingredients, search, category, priceFilter, activeFilter]);

  const toggleActive = useMutation({
    mutationFn: (ing: Ingredient) => updateIngredient(ing.id, { is_active: !ing.is_active, updated_by: user.id }),
    onSuccess: async (_, ing) => {
      await queryClient.invalidateQueries({ queryKey: ["ingredients"] });
      toast.success(ing.is_active ? `«${ing.name}» deaktiviert.` : `«${ing.name}» reaktiviert.`);
    },
    onError: () => toast.error("Status konnte nicht geändert werden."),
  });

  const remove = useMutation({
    mutationFn: (ing: Ingredient) => deleteIngredient(ing.id),
    onSuccess: async (_, ing) => {
      await queryClient.invalidateQueries({ queryKey: ["ingredients"] });
      toast.success(`«${ing.name}» gelöscht.`);
    },
    onError: () => toast.error("Zutat wird in Kalkulationen verwendet und kann nur deaktiviert werden."),
  });

  const hasAny = (ingredients?.length ?? 0) > 0;

  return (
    <>
      <PageHeader
        title="Zutaten & EK"
        description="Zentrale Zutatenliste mit Gebinde, Gebindepreis und automatisch berechnetem Einkaufspreis je Basiseinheit (g, ml, Stück). Kalkulationen greifen immer auf den aktuellen Preis zu."
        actions={
          <Button onClick={() => setDialog({ open: true, ingredient: null })}>
            <Plus className="size-4" /> Zutat hinzufügen
          </Button>
        }
      />

      {isPending && <Skeleton className="h-64 w-full" />}

      {!isPending && !hasAny && (
        <EmptyState
          icon={Carrot}
          title="Noch keine Zutaten erfasst"
          description="Legen Sie die erste Zutat mit Gebindegrösse, Gebindepreis und Basiseinheit an. Der EK je Basiseinheit wird automatisch berechnet."
        >
          <Button onClick={() => setDialog({ open: true, ingredient: null })}>
            <Plus className="size-4" /> Zutat hinzufügen
          </Button>
        </EmptyState>
      )}

      {hasAny && (
        <>
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Zutat, Kategorie oder Lieferant suchen …"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 md:flex">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="md:w-44"><SelectValue placeholder="Kategorie" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Kategorien</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priceFilter} onValueChange={(v) => setPriceFilter(v as PriceFilter)}>
                <SelectTrigger className="md:w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Preisstatus</SelectItem>
                  <SelectItem value="estimated">Geschätzt</SelectItem>
                  <SelectItem value="confirmed">Bestätigt</SelectItem>
                </SelectContent>
              </Select>
              <Select value={activeFilter} onValueChange={(v) => setActiveFilter(v as ActiveFilter)}>
                <SelectTrigger className="md:w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Aktiv</SelectItem>
                  <SelectItem value="inactive">Inaktiv</SelectItem>
                  <SelectItem value="all">Alle</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="surface px-6 py-10 text-center text-sm text-muted-foreground">
              Keine Zutaten entsprechen den aktuellen Filtern.
            </div>
          ) : (
            <div className="surface overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zutat</TableHead>
                    <TableHead>Kategorie</TableHead>
                    <TableHead>Lieferant</TableHead>
                    <TableHead>Gebinde</TableHead>
                    <TableHead className="text-right">Gebindepreis</TableHead>
                    <TableHead className="text-right">EK je Basiseinheit</TableHead>
                    <TableHead>Preisstand</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Eigene Produktion</TableHead>
                    <TableHead>Zuletzt geändert</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((ing) => {
                    const up = unitPrice(ing);
                    const used = (usage?.[ing.id] ?? 0) > 0;
                    return (
                      <TableRow key={ing.id} className={!ing.is_active ? "opacity-60" : undefined}>
                        <TableCell className="font-medium">
                          {ing.name}
                          {ing.source_type === "ai_estimate" && (
                            <span className="ml-2 text-xs text-muted-foreground">Annahme</span>
                          )}
                        </TableCell>
                        <TableCell>{ing.category}</TableCell>
                        <TableCell className="text-muted-foreground">{ing.supplier ?? "–"}</TableCell>
                        <TableCell className="tabular">
                          {formatQuantity(Number(ing.package_quantity), packageUnitLabels[ing.package_unit])}
                          {ing.package_label && <span className="block text-xs text-muted-foreground">{ing.package_label}</span>}
                        </TableCell>
                        <TableCell className="tabular text-right">{formatCHF(Number(ing.package_price))}</TableCell>
                        <TableCell className="tabular text-right">
                          {up !== null ? formatUnitPrice(up, baseUnitLabels[ing.base_unit]) : "Unvollständig"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge tone={ing.price_status === "confirmed" ? "success" : "warning"}>
                            {priceStatusLabels[ing.price_status]}
                          </StatusBadge>
                          {ing.price_date && <span className="ml-2 text-xs text-muted-foreground">{formatDate(ing.price_date)}</span>}
                        </TableCell>
                        <TableCell>
                          <StatusBadge tone={ing.is_active ? "success" : "muted"}>{ing.is_active ? "Aktiv" : "Inaktiv"}</StatusBadge>
                        </TableCell>
                        <TableCell>{ing.is_own_production ? "Ja" : "Nein"}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(ing.updated_at)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button variant="ghost" size="sm" onClick={() => setDialog({ open: true, ingredient: ing })}>
                            <Pencil className="size-3.5" /> Bearbeiten
                          </Button>
                          {ing.is_active ? (
                            <Button variant="ghost" size="sm" onClick={() => setConfirm({ kind: "deactivate", ingredient: ing })}>
                              <Archive className="size-3.5" /> Deaktivieren
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm" onClick={() => toggleActive.mutate(ing)}>
                              <ArchiveRestore className="size-3.5" /> Reaktivieren
                            </Button>
                          )}
                          {!used && (
                            <Button variant="ghost" size="sm" onClick={() => setConfirm({ kind: "delete", ingredient: ing })}>
                              <Trash2 className="size-3.5" /> Löschen
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Zutaten, die in Kalkulationen verwendet werden, können nur deaktiviert, nicht gelöscht werden.
          </p>
        </>
      )}

      {dialog.open && (
        <IngredientDialog
          key={dialog.ingredient?.id ?? "new"}
          ingredient={dialog.ingredient}
          existing={ingredients ?? []}
          userId={user.id}
          open={dialog.open}
          onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        />
      )}

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "delete" ? "Zutat löschen?" : "Zutat deaktivieren?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "delete"
                ? `«${confirm.ingredient.name}» wird unwiderruflich gelöscht. Sie wird in keiner Kalkulation verwendet.`
                : `«${confirm?.ingredient.name}» bleibt in bestehenden Kalkulationen erhalten, kann aber nicht mehr für neue Positionen gewählt werden.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirm) return;
                if (confirm.kind === "delete") remove.mutate(confirm.ingredient);
                else toggleActive.mutate(confirm.ingredient);
                setConfirm(null);
              }}
            >
              {confirm?.kind === "delete" ? "Löschen" : "Deaktivieren"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
