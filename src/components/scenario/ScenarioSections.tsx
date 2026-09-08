import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { MenuCardData } from "@/lib/menu-cards";
import type { MenuLine, MenuTotals } from "@/lib/menu-totals";
import { applyOverrides, overrideKey, type useScenario } from "@/lib/scenario";
import { ingredientUnitPrice } from "@/lib/scenario-compare";
import { baseUnitLabels, packageUnitLabels, smallMaterialModeLabels } from "@/lib/labels";
import { formatQuantity, formatUnitPrice } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { CompareCell, ScenarioCells, ScenarioField } from "./ScenarioInput";

type Scenario = ReturnType<typeof useScenario>;

type Props = { data: MenuCardData; base: MenuTotals; scen: MenuTotals; scenario: Scenario };

type FilterState = { q: string; category: string; dish: string; line: string; ingredient: string; changedOnly: boolean };
const EMPTY_FILTER: FilterState = { q: "", category: "all", dish: "all", line: "all", ingredient: "all", changedOnly: false };

type Filterable = { text: string; categoryKey: string; dishIds: string[]; lineKeys: string[]; ingredientIds: string[]; changed: boolean };

function matches(f: FilterState, r: Filterable) {
  if (f.q && !r.text.toLowerCase().includes(f.q.toLowerCase())) return false;
  if (f.category !== "all" && r.categoryKey !== f.category) return false;
  if (f.dish !== "all" && !r.dishIds.includes(f.dish)) return false;
  if (f.line !== "all" && !r.lineKeys.includes(f.line)) return false;
  if (f.ingredient !== "all" && !r.ingredientIds.includes(f.ingredient)) return false;
  if (f.changedOnly && !r.changed) return false;
  return true;
}

const catKey = (l: MenuLine) => (l.kind === "add_on" ? "add_ons" : (l.categoryId ?? "none"));

function FilterBar({
  f,
  set,
  options,
  show,
  id,
}: {
  f: FilterState;
  set: (p: Partial<FilterState>) => void;
  options: { categories: [string, string][]; dishes: [string, string][]; lines: [string, string][]; ingredients: [string, string][] };
  show: { ingredient?: boolean };
  id: string;
}) {
  const sel = (value: string, onChange: (v: string) => void, all: string, items: [string, string][], label: string) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-44 bg-background" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{all}</SelectItem>
        {items.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
      <div className="relative">
        <Search className="pointer-events-none absolute top-2 left-2.5 size-3.5 text-muted-foreground" />
        <Input value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder="Suchen …" className="h-8 w-48 bg-background pl-8" aria-label="Suchen" />
      </div>
      {sel(f.category, (v) => set({ category: v }), "Alle Kategorien", options.categories, "Kategorie")}
      {sel(f.dish, (v) => set({ dish: v }), "Alle Gerichte", options.dishes, "Gericht")}
      {sel(f.line, (v) => set({ line: v }), "Alle Varianten/Add-ons", options.lines, "Variante oder Add-on")}
      {show.ingredient && sel(f.ingredient, (v) => set({ ingredient: v }), "Alle Zutaten", options.ingredients, "Zutat")}
      <div className="flex items-center gap-2">
        <Checkbox id={`${id}-changed`} checked={f.changedOnly} onCheckedChange={(v) => set({ changedOnly: v === true })} />
        <Label htmlFor={`${id}-changed`} className="text-xs font-normal">
          Nur geänderte
        </Label>
      </div>
    </div>
  );
}

function useFilter() {
  const [f, setF] = useState<FilterState>(EMPTY_FILTER);
  return { f, set: (p: Partial<FilterState>) => setF((s) => ({ ...s, ...p })) };
}

const KindBadge = ({ kind }: { kind: MenuLine["kind"] }) =>
  kind === "add_on" ? <StatusBadge tone="warning">Add-on</StatusBadge> : <StatusBadge tone="muted">Variante</StatusBadge>;

const EmptyRow = ({ cols }: { cols: number }) => (
  <TableRow>
    <TableCell colSpan={cols} className="py-8 text-center text-sm text-muted-foreground">
      Keine Positionen für diese Filter.
    </TableCell>
  </TableRow>
);

export function ScenarioSections({ data, base, scen, scenario }: Props) {
  const scenByKey = useMemo(() => new Map(scen.lines.map((l) => [l.key, l])), [scen]);
  const activeLines = useMemo(() => base.lines.filter((l) => l.isActive), [base]);
  const applied = useMemo(() => applyOverrides(data, scenario.overrides), [data, scenario.overrides]);

  const options = useMemo(() => {
    const cats = new Map<string, string>();
    activeLines.forEach((l) => cats.set(catKey(l), l.categoryName));
    const dishes: [string, string][] = data.dishes.filter((d) => d.is_active).map((d) => [d.id, d.name]);
    const lines: [string, string][] = activeLines.map((l) => [l.key, l.kind === "add_on" ? `${l.name} (Add-on)` : `${l.dishName} – ${l.name}`]);
    const usedIng = new Set(activeLines.flatMap((l) => l.result.items.map((r) => r.item.ingredient_id)));
    const ingredients: [string, string][] = data.ingredients
      .filter((i) => usedIng.has(i.id))
      .sort((a, b) => a.name.localeCompare(b.name, "de-CH"))
      .map((i) => [i.id, i.name]);
    return { categories: Array.from(cats.entries()), dishes, lines, ingredients };
  }, [activeLines, data]);

  const lineFilterable = (l: MenuLine, changed: boolean): Filterable => ({
    text: `${l.categoryName} ${l.dishName} ${l.name}`,
    categoryKey: catKey(l),
    dishIds: l.kind === "variant" && l.dishId ? [l.dishId] : data.links.filter((k) => k.add_on_id === l.id).map((k) => k.dish_id),
    lineKeys: [l.key],
    ingredientIds: l.result.items.map((r) => r.item.ingredient_id),
    changed,
  });
  const entityOf = (l: MenuLine): "variant" | "add_on" => (l.kind === "variant" ? "variant" : "add_on");
  const has = (k: string) => k in scenario.overrides;

  // Section 1 – Verkaufspreise
  const fPrice = useFilter();
  const priceRows = activeLines
    .map((l) => ({ l, s: scenByKey.get(l.key)!, changed: has(overrideKey(entityOf(l), l.id, "gross_price")) }))
    .filter((r) => matches(fPrice.f, lineFilterable(r.l, r.changed)));

  // Section 2 – Verkaufsmengen
  const fSales = useFilter();
  const salesRows = activeLines
    .map((l) => {
      const e = entityOf(l);
      const changed = has(overrideKey(e, l.id, "per_day")) || has(overrideKey(e, l.id, "total"));
      return { l, s: scenByKey.get(l.key)!, changed };
    })
    .filter((r) => matches(fSales.f, lineFilterable(r.l, r.changed)));

  // Section 3 – Einkaufspreise
  const fIng = useFilter();
  const ingRows = useMemo(() => {
    const usage = new Map<string, { lines: Set<string>; dishes: Set<string>; cats: Set<string> }>();
    for (const l of activeLines) {
      for (const r of l.result.items) {
        const u = usage.get(r.item.ingredient_id) ?? { lines: new Set(), dishes: new Set(), cats: new Set() };
        u.lines.add(l.key);
        if (l.kind === "variant" && l.dishId) u.dishes.add(l.dishId);
        else data.links.filter((k) => k.add_on_id === l.id).forEach((k) => u.dishes.add(k.dish_id));
        u.cats.add(catKey(l));
        usage.set(r.item.ingredient_id, u);
      }
    }
    return data.ingredients
      .filter((i) => usage.has(i.id))
      .map((i) => ({ i, usage: usage.get(i.id)! }))
      .sort((a, b) => a.i.name.localeCompare(b.i.name, "de-CH"));
  }, [activeLines, data]);
  const ingFiltered = ingRows.filter(({ i, usage }) => {
    const changed = has(overrideKey("ingredient", i.id, "package_price"));
    // category filter for ingredients: any using line's category
    const f = fIng.f;
    if (f.category !== "all" && !usage.cats.has(f.category)) return false;
    return matches({ ...f, category: "all" }, { text: `${i.name} ${i.category} ${i.supplier ?? ""}`, categoryKey: "", dishIds: [...usage.dishes], lineKeys: [...usage.lines], ingredientIds: [i.id], changed });
  });

  // Section 4 – Rezeptmengen
  const fItems = useFilter();
  const itemRows = activeLines.flatMap((l) => {
    const s = scenByKey.get(l.key)!;
    return l.result.items.map((r) => {
      const sr = s.result.items.find((x) => x.item.id === r.item.id) ?? r;
      const changed = has(overrideKey("item", r.item.id, "net_quantity")) || has(overrideKey("item", r.item.id, "yield_percent"));
      return { l, r, sr, changed };
    });
  });
  const itemFiltered = itemRows.filter(({ l, r, changed }) =>
    matches(fItems.f, { ...lineFilterable(l, changed), text: `${l.categoryName} ${l.dishName} ${l.name} ${r.ingredient?.name ?? ""}`, ingredientIds: [r.item.ingredient_id] }),
  );

  // Small material (card level)
  const smMode = applied.card.small_material_mode;
  const smBase = Number(data.card.small_material_value);
  const smScen = Number(applied.card.small_material_value);
  const smModeChanged = has(overrideKey("card", data.card.id, "small_material_mode"));
  const smValueChanged = has(overrideKey("card", data.card.id, "small_material_value"));

  return (
    <Tabs defaultValue="prices" className="surface">
      <TabsList className="m-3 flex h-auto w-auto flex-wrap justify-start bg-secondary">
        <TabsTrigger value="prices">Verkaufspreise</TabsTrigger>
        <TabsTrigger value="sales">Verkaufsmengen</TabsTrigger>
        <TabsTrigger value="purchase">Einkaufspreise</TabsTrigger>
        <TabsTrigger value="recipes">Rezeptmengen</TabsTrigger>
      </TabsList>

      {/* 1 – Verkaufspreise */}
      <TabsContent value="prices" className="mt-0">
        <div className="flex flex-wrap items-center gap-3 border-y border-border bg-secondary/30 px-4 py-2.5 text-sm">
          <span className="text-xs font-medium text-muted-foreground">Kleinmaterial (Karte)</span>
          <Select
            value={smMode}
            onValueChange={(v) => {
              scenario.set("card", data.card.id, "small_material_mode", v === data.card.small_material_mode ? null : v);
              scenario.set("card", data.card.id, "small_material_value", null);
            }}
          >
            <SelectTrigger className="h-8 w-40 bg-background" aria-label="Kleinmaterial-Modus">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["percent", "fixed"] as const).map((m) => (
                <SelectItem key={m} value={m}>
                  {smallMaterialModeLabels[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            Basis: {smallMaterialModeLabels[data.card.small_material_mode]} ·{" "}
            {data.card.small_material_mode === "percent" ? `${formatQuantity(smBase * 100)} %` : `CHF ${formatQuantity(smBase)}`}
          </span>
          <ScenarioField
            label="Kleinmaterial Szenario"
            kind={smMode === "percent" ? "quantity" : "chf"}
            unit={smMode === "percent" ? "%" : "CHF"}
            factor={smMode === "percent" ? 100 : 1}
            baseline={smModeChanged ? null : smBase}
            value={smScen}
            overridden={smValueChanged || smModeChanged}
            onChange={(v) => scenario.set("card", data.card.id, "small_material_value", v)}
          />
          {smModeChanged && (
            <button type="button" className="text-xs text-muted-foreground underline" onClick={() => { scenario.set("card", data.card.id, "small_material_mode", null); scenario.set("card", data.card.id, "small_material_value", null); }}>
              Modus zurücksetzen
            </button>
          )}
        </div>
        <FilterBar id="prices" f={fPrice.f} set={fPrice.set} options={options} show={{}} />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kategorie</TableHead>
                <TableHead>Gericht</TableHead>
                <TableHead>Variante/Add-on</TableHead>
                <TableHead className="text-right">Brutto-VK Basis</TableHead>
                <TableHead>Brutto-VK Szenario</TableHead>
                <TableHead className="text-right">Differenz</TableHead>
                <TableHead className="text-right">Netto-VK</TableHead>
                <TableHead className="text-right">DB I / Verkauf</TableHead>
                <TableHead className="text-right">DB-I-Marge</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {priceRows.length === 0 && <EmptyRow cols={9} />}
              {priceRows.map(({ l, s, changed }) => (
                <TableRow key={l.key} className={changed ? "bg-primary/5" : undefined}>
                  <TableCell className="text-muted-foreground">{l.categoryName}</TableCell>
                  <TableCell>{l.dishName}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      {l.name} <KindBadge kind={l.kind} />
                    </span>
                  </TableCell>
                  <ScenarioCells
                    label={`Brutto-VK ${l.dishName} ${l.name}`}
                    kind="chf"
                    unit="CHF"
                    baseline={Number(l.result.variant.gross_price)}
                    value={Number(s.result.variant.gross_price)}
                    overridden={changed}
                    onChange={(v) => scenario.set(entityOf(l), l.id, "gross_price", v)}
                  />
                  <CompareCell base={l.result.netPrice} scen={s.result.netPrice} kind="chf" />
                  <CompareCell base={l.result.contributionMargin1} scen={s.result.contributionMargin1} kind="chf" />
                  <CompareCell base={l.result.contributionMarginRatio} scen={s.result.contributionMarginRatio} kind="percent" />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      {/* 2 – Verkaufsmengen */}
      <TabsContent value="sales" className="mt-0 border-t border-border">
        <FilterBar id="sales" f={fSales.f} set={fSales.set} options={options} show={{}} />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kategorie</TableHead>
                <TableHead>Gericht</TableHead>
                <TableHead>Variante/Add-on</TableHead>
                <TableHead className="text-right">Pro Tag Basis</TableHead>
                <TableHead>Pro Tag Szenario</TableHead>
                <TableHead className="text-right">Differenz</TableHead>
                <TableHead className="text-right">Gesamt Basis</TableHead>
                <TableHead>Gesamt Szenario</TableHead>
                <TableHead className="text-right">Differenz</TableHead>
                <TableHead className="text-right">Gesamt-DB I</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salesRows.length === 0 && <EmptyRow cols={10} />}
              {salesRows.map(({ l, s, changed }) => {
                const e = entityOf(l);
                return (
                  <TableRow key={l.key} className={changed ? "bg-primary/5" : undefined}>
                    <TableCell className="text-muted-foreground">{l.categoryName}</TableCell>
                    <TableCell>{l.dishName}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        {l.name} <KindBadge kind={l.kind} />
                      </span>
                    </TableCell>
                    <ScenarioCells
                      label={`Verkäufe pro Tag ${l.dishName} ${l.name}`}
                      kind="count"
                      baseline={l.perDay}
                      value={s.perDay}
                      overridden={has(overrideKey(e, l.id, "per_day"))}
                      onChange={(v) => scenario.set(e, l.id, "per_day", v)}
                    />
                    <ScenarioCells
                      label={`Verkäufe gesamt ${l.dishName} ${l.name}`}
                      kind="count"
                      baseline={l.total}
                      value={s.total}
                      overridden={has(overrideKey(e, l.id, "total"))}
                      onChange={(v) => scenario.set(e, l.id, "total", v)}
                    />
                    <CompareCell base={l.contributionMargin1} scen={s.contributionMargin1} kind="chf" />
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <p className="px-4 py-2 text-xs text-muted-foreground">
          Pro Tag und Gesamt sind über die Verkaufstage ({base.sellingDays}) verknüpft; die zuletzt bearbeitete Grösse gilt als Eingabe. Mengen ändern die Gesamtwerte, nicht den DB I pro Verkauf.
        </p>
      </TabsContent>

      {/* 3 – Einkaufspreise */}
      <TabsContent value="purchase" className="mt-0 border-t border-border">
        <FilterBar id="purchase" f={fIng.f} set={fIng.set} options={options} show={{ ingredient: true }} />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zutat</TableHead>
                <TableHead>Warengruppe</TableHead>
                <TableHead>Gebinde</TableHead>
                <TableHead className="text-right">EK Basis</TableHead>
                <TableHead>EK Szenario</TableHead>
                <TableHead className="text-right">Differenz</TableHead>
                <TableHead className="text-right">Preis pro Einheit</TableHead>
                <TableHead className="text-right">Verwendet in</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ingFiltered.length === 0 && <EmptyRow cols={8} />}
              {ingFiltered.map(({ i, usage }) => {
                const key = overrideKey("ingredient", i.id, "package_price");
                const changed = has(key);
                const scenPrice = changed ? Number(scenario.overrides[key]!.value) : Number(i.package_price);
                const upB = ingredientUnitPrice(i);
                const upS = ingredientUnitPrice(i, scenPrice);
                const unit = baseUnitLabels[i.base_unit];
                return (
                  <TableRow key={i.id} className={changed ? "bg-primary/5" : undefined}>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        {i.name}
                        {i.price_status === "estimated" && <StatusBadge tone="warning">geschätzt</StatusBadge>}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{i.category}</TableCell>
                    <TableCell className="tabular text-muted-foreground">
                      {formatQuantity(Number(i.package_quantity))} {packageUnitLabels[i.package_unit]}
                    </TableCell>
                    <ScenarioCells
                      label={`Einkaufspreis ${i.name}`}
                      kind="chf"
                      unit="CHF"
                      baseline={Number(i.package_price)}
                      value={scenPrice}
                      overridden={changed}
                      onChange={(v) => scenario.set("ingredient", i.id, "package_price", v)}
                    />
                    <TableCell className="text-right tabular whitespace-nowrap">
                      {upB === null ? (
                        <span className="text-xs italic text-muted-foreground">Unvollständig</span>
                      ) : changed && upS !== null ? (
                        <span className="inline-flex flex-col items-end leading-tight">
                          <span className="text-xs text-muted-foreground line-through">{formatUnitPrice(upB, unit)}</span>
                          <span className="font-medium">{formatUnitPrice(upS, unit)}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{formatUnitPrice(upB, unit)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular text-muted-foreground">{usage.lines.size} Pos.</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <p className="px-4 py-2 text-xs text-muted-foreground">Ein geänderter Einkaufspreis wirkt auf alle Varianten und Add-ons, die diese Zutat verwenden.</p>
      </TabsContent>

      {/* 4 – Rezeptmengen */}
      <TabsContent value="recipes" className="mt-0 border-t border-border">
        <FilterBar id="recipes" f={fItems.f} set={fItems.set} options={options} show={{ ingredient: true }} />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Gericht</TableHead>
                <TableHead>Variante/Add-on</TableHead>
                <TableHead>Zutat</TableHead>
                <TableHead className="text-right">Menge Basis</TableHead>
                <TableHead>Menge Szenario</TableHead>
                <TableHead className="text-right">Differenz</TableHead>
                <TableHead className="text-right">Ausbeute Basis</TableHead>
                <TableHead>Ausbeute Szenario</TableHead>
                <TableHead className="text-right">Differenz</TableHead>
                <TableHead className="text-right">Kosten</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemFiltered.length === 0 && <EmptyRow cols={10} />}
              {itemFiltered.map(({ l, r, sr, changed }) => {
                const unit = baseUnitLabels[r.item.quantity_unit];
                return (
                  <TableRow key={r.item.id} className={changed ? "bg-primary/5" : undefined}>
                    <TableCell>
                      <span className="block">{l.dishName}</span>
                      <span className="text-xs text-muted-foreground">{l.categoryName}</span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        {l.name} <KindBadge kind={l.kind} />
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        {r.ingredient?.name ?? <span className="italic text-muted-foreground">Zutat fehlt</span>}
                        {!r.item.quantity_confirmed && <StatusBadge tone="warning">offen</StatusBadge>}
                      </span>
                    </TableCell>
                    <ScenarioCells
                      label={`Menge ${r.ingredient?.name ?? ""} ${l.name}`}
                      kind="quantity"
                      unit={unit}
                      baseline={Number(r.item.net_quantity)}
                      value={Number(sr.item.net_quantity)}
                      overridden={has(overrideKey("item", r.item.id, "net_quantity"))}
                      onChange={(v) => scenario.set("item", r.item.id, "net_quantity", v)}
                    />
                    <ScenarioCells
                      label={`Ausbeute ${r.ingredient?.name ?? ""} ${l.name}`}
                      kind="percent"
                      unit="%"
                      min={1}
                      max={100}
                      baseline={Number(r.item.yield_percent)}
                      value={Number(sr.item.yield_percent)}
                      overridden={has(overrideKey("item", r.item.id, "yield_percent"))}
                      onChange={(v) => scenario.set("item", r.item.id, "yield_percent", v)}
                    />
                    <CompareCell base={r.cost} scen={sr.cost} kind="chf" />
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <p className="px-4 py-2 text-xs text-muted-foreground">Eine geänderte Rezeptmenge wirkt nur auf die gewählte Variante bzw. das gewählte Add-on.</p>
      </TabsContent>
    </Tabs>
  );
}
