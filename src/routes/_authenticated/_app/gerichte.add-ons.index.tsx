import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, PackagePlus, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { MetricValue } from "@/components/dishes/Metric";
import { statusTone } from "@/components/dishes/CalculationPanels";
import { AddOnDialog } from "@/components/add-ons/AddOnDialog";
import { addOnLinksQuery, addOnsQuery } from "@/lib/add-ons";
import { allItemsQuery, allVariantsQuery, dishesQuery } from "@/lib/dishes";
import { ingredientsQuery } from "@/lib/ingredients";
import { activeMenuCardQuery } from "@/lib/menu-cards";
import { calculateVariant } from "@/lib/costing";
import { addOnSalesWarning, openDaysCount } from "@/lib/sales";
import { calculationStatusLabels } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_app/gerichte/add-ons/")({
  head: () => ({
    meta: [
      { title: "Add-ons – KundiCalc" },
      { name: "description", content: "Add-ons mit Aufpreis, Wareneinsatz und DB I, zugeordnet zu Gerichten." },
      { property: "og:title", content: "Add-ons – KundiCalc" },
      { property: "og:description", content: "Zusätzlich verkaufte Positionen mit eigener Kalkulation." },
    ],
  }),
  component: AddOnsPage,
});

function AddOnsPage() {
  const navigate = useNavigate();
  const { data: card } = useQuery(activeMenuCardQuery);
  const { data: addOns, isPending } = useQuery(addOnsQuery);
  const { data: links } = useQuery(addOnLinksQuery);
  const { data: dishes } = useQuery(dishesQuery);
  const { data: variants } = useQuery(allVariantsQuery);
  const { data: items } = useQuery(allItemsQuery);
  const { data: ingredients } = useQuery(ingredientsQuery);

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"active" | "all" | "inactive">("active");
  const [dialogOpen, setDialogOpen] = useState(false);

  const ingById = useMemo(() => new Map((ingredients ?? []).map((i) => [i.id, i])), [ingredients]);
  const openDays = useMemo(() => openDaysCount(card ?? null), [card]);

  const rows = useMemo(() => {
    if (!addOns || !items || !links || !dishes || !variants) return [];
    const q = search.trim().toLowerCase();
    return addOns
      .filter((a) => (activeFilter === "all" ? true : activeFilter === "active" ? a.is_active : !a.is_active))
      .filter((a) => !q || a.name.toLowerCase().includes(q))
      .map((a) => {
        const dishIds = links.filter((l) => l.add_on_id === a.id).map((l) => l.dish_id);
        const dishNames = dishes.filter((d) => dishIds.includes(d.id)).map((d) => d.name);
        const dishVariants = variants.filter((v) => dishIds.includes(v.dish_id) && v.is_active);
        return {
          addOn: a,
          dishNames,
          result: calculateVariant(a, items.filter((it) => it.add_on_id === a.id), ingById, card ?? null),
          warning: addOnSalesWarning(a, dishVariants, openDays),
        };
      })
      .sort((x, y) => x.addOn.name.localeCompare(y.addOn.name, "de-CH"));
  }, [addOns, items, links, dishes, variants, ingById, card, search, activeFilter, openDays]);

  const loading = isPending || !items || !ingredients || !links || !dishes;

  return (
    <>
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link to="/gerichte"><ArrowLeft className="size-4" /> Gerichte</Link>
        </Button>
      </div>
      <PageHeader
        title="Add-ons"
        description="Zusätzlich zu einem Gericht verkaufte Positionen (z. B. Pommes frites, 2 cl Spirituose) mit eigenem Aufpreis, eigener Kalkulation und eigenem DB I. Add-ons sind keine Varianten."
        actions={
          <Button onClick={() => setDialogOpen(true)} disabled={!card}>
            <Plus className="size-4" /> Add-on anlegen
          </Button>
        }
      />

      {loading && <Skeleton className="h-64 w-full" />}

      {!loading && (addOns?.length ?? 0) === 0 && (
        <EmptyState icon={PackagePlus} title="Noch keine Add-ons" description="Legen Sie das erste Add-on an und ordnen Sie es einem oder mehreren Gerichten zu.">
          <Button onClick={() => setDialogOpen(true)} disabled={!card}><Plus className="size-4" /> Add-on anlegen</Button>
        </EmptyState>
      )}

      {!loading && (addOns?.length ?? 0) > 0 && (
        <>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-8" placeholder="Add-on suchen …" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={activeFilter} onValueChange={(v) => setActiveFilter(v as typeof activeFilter)}>
              <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Nur aktive</SelectItem>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="inactive">Nur inaktive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="surface overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Add-on</TableHead>
                  <TableHead>Gerichte</TableHead>
                  <TableHead className="text-right">Aufpreis brutto</TableHead>
                  <TableHead className="text-right">Netto</TableHead>
                  <TableHead className="text-right">Wareneinsatz</TableHead>
                  <TableHead className="text-right">WE-Quote</TableHead>
                  <TableHead className="text-right">DB I</TableHead>
                  <TableHead className="text-right">DB-I-Marge</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">Keine Add-ons für diesen Filter.</TableCell></TableRow>
                )}
                {rows.map(({ addOn, dishNames, result, warning }) => (
                  <TableRow
                    key={addOn.id}
                    className={cn("cursor-pointer", !addOn.is_active && "opacity-60")}
                    onClick={() => navigate({ to: "/gerichte/add-ons/$addOnId", params: { addOnId: addOn.id } })}
                  >
                    <TableCell>
                      <div className="font-medium">{addOn.name}</div>
                      <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                        {!addOn.is_active && <span>Inaktiv</span>}
                        {(result.hasEstimatedPrices || result.hasUnconfirmedQuantities) && <span>Annahmen enthalten</span>}
                        {warning && <span className="text-warning-foreground">Absatz prüfen</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{dishNames.length ? dishNames.join(", ") : <span className="italic">nicht zugeordnet</span>}</TableCell>
                    <TableCell className="text-right"><MetricValue value={result.grossPrice} kind="chf" problems={result.problems} /></TableCell>
                    <TableCell className="text-right"><MetricValue value={result.netPrice} kind="chf" problems={result.problems} /></TableCell>
                    <TableCell className="text-right"><MetricValue value={result.foodCost} kind="chf" problems={result.problems} /></TableCell>
                    <TableCell className="text-right"><MetricValue value={result.foodCostRatio} kind="percent" problems={result.problems} /></TableCell>
                    <TableCell className="text-right"><MetricValue value={result.contributionMargin1} kind="chf" problems={result.problems} className="font-medium" /></TableCell>
                    <TableCell className="text-right"><MetricValue value={result.contributionMarginRatio} kind="percent" problems={result.problems} /></TableCell>
                    <TableCell><StatusBadge tone={statusTone[addOn.calculation_status]}>{calculationStatusLabels[addOn.calculation_status]}</StatusBadge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Netto ohne 8.1 % MWST. Wareneinsatz = Zutaten + Kleinmaterial. DB I nach Wareneinsatz, kein Gewinn. Werte werden live aus den aktuellen Einkaufspreisen berechnet.
          </p>
        </>
      )}

      {dialogOpen && card && (
        <AddOnDialog
          menuCardId={card.id}
          dishes={dishes ?? []}
          links={links ?? []}
          cardSmallMaterial={{ mode: card.small_material_mode, value: Number(card.small_material_value) }}
          open
          onOpenChange={setDialogOpen}
          onSaved={(id) => navigate({ to: "/gerichte/add-ons/$addOnId", params: { addOnId: id } })}
        />
      )}
    </>
  );
}
