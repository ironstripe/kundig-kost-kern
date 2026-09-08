import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowUpDown, Plus, Search, UtensilsCrossed } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { DishDialog } from "@/components/dishes/DishDialog";
import { MetricValue } from "@/components/dishes/Metric";
import { allItemsQuery, allVariantsQuery, categoriesQuery, dishesQuery } from "@/lib/dishes";
import { ingredientsQuery } from "@/lib/ingredients";
import { activeMenuCardQuery } from "@/lib/menu-cards";
import { calculateVariant, type CalculationStatus, type VariantResult } from "@/lib/costing";
import { calculationStatusLabels } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_app/gerichte/")({
  head: () => ({
    meta: [
      { title: "Gerichte – KundiCalc" },
      { name: "description", content: "Gerichte und Portionsvarianten mit Wareneinsatz und DB I." },
      { property: "og:title", content: "Gerichte – KundiCalc" },
      { property: "og:description", content: "Gerichte, Varianten, Wareneinsatz und DB I." },
    ],
  }),
  component: DishesPage,
});

type Row = {
  dishId: string;
  dishName: string;
  dishActive: boolean;
  category: string;
  variantName: string;
  isDefault: boolean;
  variantActive: boolean;
  status: CalculationStatus;
  result: VariantResult;
  firstOfDish: boolean;
  variantCount: number;
};

type SortKey = "dish" | "category" | "gross" | "foodCost" | "ratio" | "db1" | "margin" | "status";

const statusTone: Record<CalculationStatus, "warning" | "neutral" | "success"> = {
  estimated: "warning",
  partially_reviewed: "neutral",
  reviewed: "success",
};

function DishesPage() {
  const navigate = useNavigate();
  const { data: card } = useQuery(activeMenuCardQuery);
  const { data: dishes, isPending } = useQuery(dishesQuery);
  const { data: categories } = useQuery(categoriesQuery);
  const { data: variants } = useQuery(allVariantsQuery);
  const { data: items } = useQuery(allItemsQuery);
  const { data: ingredients } = useQuery(ingredientsQuery);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState<"all" | CalculationStatus>("all");
  const [active, setActive] = useState<"active" | "inactive" | "all">("active");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "dish", dir: 1 });
  const [dialogOpen, setDialogOpen] = useState(false);

  const rows = useMemo<Row[]>(() => {
    if (!dishes || !variants || !items || !ingredients) return [];
    const ingById = new Map(ingredients.map((i) => [i.id, i]));
    const catById = new Map((categories ?? []).map((c) => [c.id, c.name]));
    const out: Row[] = [];
    for (const d of dishes) {
      const vs = variants.filter((v) => v.dish_id === d.id);
      vs.forEach((v, idx) => {
        const its = items.filter((it) => it.variant_id === v.id);
        out.push({
          dishId: d.id,
          dishName: d.name,
          dishActive: d.is_active,
          category: d.category_id ? (catById.get(d.category_id) ?? "–") : "–",
          variantName: v.name,
          isDefault: v.is_default,
          variantActive: v.is_active,
          status: v.calculation_status,
          result: calculateVariant(v, its, ingById, card ?? null),
          firstOfDish: idx === 0,
          variantCount: vs.length,
        });
      });
      if (vs.length === 0) {
        out.push({
          dishId: d.id,
          dishName: d.name,
          dishActive: d.is_active,
          category: d.category_id ? (catById.get(d.category_id) ?? "–") : "–",
          variantName: "–",
          isDefault: false,
          variantActive: true,
          status: "estimated",
          result: calculateVariant(
            { id: "", name: "", gross_price: 0, small_material_override_mode: null, small_material_override_value: null, calculation_status: "estimated" },
            [],
            ingById,
            card ?? null,
          ),
          firstOfDish: true,
          variantCount: 0,
        });
      }
    }
    return out;
  }, [dishes, variants, items, ingredients, categories, card]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (active === "active" && !(r.dishActive && r.variantActive)) return false;
      if (active === "inactive" && r.dishActive && r.variantActive) return false;
      if (category !== "all" && r.category !== category) return false;
      if (status !== "all" && r.status !== status) return false;
      if (q && !r.dishName.toLowerCase().includes(q)) return false;
      return true;
    });
    const num = (v: number | null) => (v === null ? Number.NEGATIVE_INFINITY : v);
    const cmp = (a: Row, b: Row): number => {
      switch (sort.key) {
        case "dish": return a.dishName.localeCompare(b.dishName, "de-CH");
        case "category": return a.category.localeCompare(b.category, "de-CH");
        case "gross": return num(a.result.grossPrice) - num(b.result.grossPrice);
        case "foodCost": return num(a.result.foodCost) - num(b.result.foodCost);
        case "ratio": return num(a.result.foodCostRatio) - num(b.result.foodCostRatio);
        case "db1": return num(a.result.contributionMargin1) - num(b.result.contributionMargin1);
        case "margin": return num(a.result.contributionMarginRatio) - num(b.result.contributionMarginRatio);
        case "status": return a.status.localeCompare(b.status);
      }
    };
    // Keep variants of a dish together: sort by dish first, then by the chosen key.
    return [...list].sort((a, b) => {
      if (sort.key === "dish" || sort.key === "category") {
        const c = cmp(a, b) * sort.dir;
        if (c !== 0) return c;
        return a.dishName.localeCompare(b.dishName, "de-CH") || (a.isDefault ? -1 : 1);
      }
      const c = cmp(a, b) * sort.dir;
      return c !== 0 ? c : a.dishName.localeCompare(b.dishName, "de-CH");
    });
  }, [rows, search, category, status, active, sort]);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  }

  const SortHead = ({ k, children, right }: { k: SortKey; children: React.ReactNode; right?: boolean }) => (
    <TableHead className={cn(right && "text-right")}>
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className={cn("inline-flex items-center gap-1 hover:text-foreground", sort.key === k && "text-foreground")}
      >
        {children}
        <ArrowUpDown className="size-3 opacity-60" />
      </button>
    </TableHead>
  );

  const loading = isPending || !variants || !items || !ingredients;
  const hasAny = (dishes?.length ?? 0) > 0;
  const categoryNames = Array.from(new Set(rows.map((r) => r.category))).filter((c) => c !== "–").sort();

  return (
    <>
      <PageHeader
        title="Gerichte"
        description="Jede Variante wird einzeln kalkuliert: Netto-VK ohne 8.1 % MWST, Wareneinsatz aus zentralen Einkaufspreisen und DB I nach Wareneinsatz. Alle Werte werden live berechnet."
        actions={
          <Button onClick={() => setDialogOpen(true)} disabled={!card}>
            <Plus className="size-4" /> Gericht hinzufügen
          </Button>
        }
      />

      {loading && <Skeleton className="h-64 w-full" />}

      {!loading && !hasAny && (
        <EmptyState
          icon={UtensilsCrossed}
          title="Noch keine Gerichte erfasst"
          description="Legen Sie das erste Gericht mit einer Standardvariante an und erfassen Sie danach die Kalkulationspositionen."
        >
          <Button onClick={() => setDialogOpen(true)} disabled={!card}>
            <Plus className="size-4" /> Gericht hinzufügen
          </Button>
        </EmptyState>
      )}

      {!loading && hasAny && (
        <>
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-8" placeholder="Gericht suchen …" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-2 md:flex">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="md:w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Kategorien</SelectItem>
                  {categoryNames.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger className="md:w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  {(Object.keys(calculationStatusLabels) as CalculationStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{calculationStatusLabels[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={active} onValueChange={(v) => setActive(v as typeof active)}>
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
            <div className="surface px-6 py-10 text-center text-sm text-muted-foreground">Keine Gerichte entsprechen den aktuellen Filtern.</div>
          ) : (
            <div className="surface overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHead k="dish">Gericht</SortHead>
                    <SortHead k="category">Kategorie</SortHead>
                    <TableHead>Variante</TableHead>
                    <SortHead k="gross" right>Brutto-VK</SortHead>
                    <TableHead className="text-right">Netto-VK</TableHead>
                    <SortHead k="foodCost" right>Wareneinsatz</SortHead>
                    <SortHead k="ratio" right>WE-Quote</SortHead>
                    <SortHead k="db1" right>DB I</SortHead>
                    <SortHead k="margin" right>DB-I-Marge</SortHead>
                    <SortHead k="status">Kalkulationsstatus</SortHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r, i) => {
                    const prev = filtered[i - 1];
                    const sameDishAsPrev = prev?.dishId === r.dishId;
                    const p = r.result.problems;
                    return (
                      <TableRow
                        key={`${r.dishId}-${r.variantName}`}
                        className={cn("cursor-pointer", sameDishAsPrev && "border-t-0 [&>td]:pt-1", !(r.dishActive && r.variantActive) && "opacity-60")}
                        onClick={() => navigate({ to: "/gerichte/$dishId", params: { dishId: r.dishId } })}
                      >
                        <TableCell className={cn("font-medium", sameDishAsPrev && "text-transparent select-none")}>
                          <Link to="/gerichte/$dishId" params={{ dishId: r.dishId }} className={cn(!sameDishAsPrev && "hover:underline")}>
                            {r.dishName}
                          </Link>
                          {!sameDishAsPrev && r.variantCount > 1 && (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">{r.variantCount} Varianten</span>
                          )}
                        </TableCell>
                        <TableCell className={cn(sameDishAsPrev && "text-transparent select-none")}>{r.category}</TableCell>
                        <TableCell>
                          <span className={cn(sameDishAsPrev && "border-l-2 border-border pl-2")}>{r.variantName}</span>
                          {r.isDefault && <span className="ml-2 text-xs text-muted-foreground">Standard</span>}
                        </TableCell>
                        <TableCell className="text-right"><MetricValue value={r.result.grossPrice} kind="chf" problems={p} /></TableCell>
                        <TableCell className="text-right"><MetricValue value={r.result.netPrice} kind="chf" problems={p} /></TableCell>
                        <TableCell className="text-right"><MetricValue value={r.result.foodCost} kind="chf" problems={p} /></TableCell>
                        <TableCell className="text-right"><MetricValue value={r.result.foodCostRatio} kind="percent" problems={p} /></TableCell>
                        <TableCell className="text-right font-medium"><MetricValue value={r.result.contributionMargin1} kind="chf" problems={p} /></TableCell>
                        <TableCell className="text-right"><MetricValue value={r.result.contributionMarginRatio} kind="percent" problems={p} /></TableCell>
                        <TableCell>
                          <StatusBadge tone={statusTone[r.status]}>{calculationStatusLabels[r.status]}</StatusBadge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            DB I = Netto-VK minus Wareneinsatz (Zutaten + Kleinmaterial). Kein Gewinn – Personal- und Betriebskosten sind nicht enthalten. Werte mit Status «Geschätzt» beruhen auf Annahmen.
          </p>
        </>
      )}

      {dialogOpen && card && (
        <DishDialog
          categories={categories ?? []}
          menuCardId={card.id}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onCreated={(id) => navigate({ to: "/gerichte/$dishId", params: { dishId: id } })}
        />
      )}
    </>
  );
}
