import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, BarChart3, RotateCcw, Save } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { MenuCardSelector } from "@/components/menu-cards/MenuCardSelector";
import { menuCardDataQuery } from "@/lib/menu-cards";
import { calculateMenuTotals, type MenuLine } from "@/lib/menu-totals";
import { useSelectedMenuCard } from "@/lib/selected-menu-card";
import { useAppContext } from "@/lib/app-route";
import { bulkSetSales, DEMO_SALES, isDemoAssumption, saveSalesPatches, type SalesInputMode, type SalesPatch } from "@/lib/sales-planning";
import { formatDate, formatNumber, parseDecimal } from "@/lib/format";
import { calculationStatusLabels } from "@/lib/labels";
import type { CalculationStatus } from "@/lib/costing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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

export const Route = createFileRoute("/_authenticated/_app/verkaufsmengen")({
  head: () => ({
    meta: [
      { title: "Verkaufsmengen – KundiCalc" },
      { name: "description", content: "Erwartete Verkaufsmengen pro Öffnungstag oder über die Laufzeit für Varianten und Add-ons." },
      { property: "og:title", content: "Verkaufsmengen – KundiCalc" },
      { property: "og:description", content: "Verkaufsmengen planen." },
    ],
  }),
  component: SalesPlanningPage,
});

type Draft = { mode: SalesInputMode; perDay: string; total: string };
type Bulk =
  | { kind: "none" }
  | { kind: "zero" }
  | { kind: "category"; categoryKey: string; value: string }
  | { kind: "reset" };

const DEMO_LABEL = "Demo-Annahme – noch nicht betrieblich bestätigt";

function fmtQty(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "–";
  return Number.isInteger(v) ? formatNumber(v, 0) : formatNumber(v, 1);
}

function SalesPlanningPage() {
  const { user } = useAppContext();
  const queryClient = useQueryClient();
  const { data: card, isPending: cardsPending } = useSelectedMenuCard();
  const { data, isPending, error } = useQuery({ ...menuCardDataQuery(card?.id ?? ""), enabled: !!card });

  const totals = useMemo(() => (data ? calculateMenuTotals(data) : null), [data]);
  const lines = useMemo(() => (totals ? totals.lines.filter((l) => l.isActive) : []), [totals]);
  const sellingDays = totals?.sellingDays ?? 0;

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState("all");
  const [type, setType] = useState<"all" | "variant" | "add_on">("all");
  const [status, setStatus] = useState<"all" | CalculationStatus>("all");
  const [bulk, setBulk] = useState<Bulk>({ kind: "none" });

  // Reset drafts whenever fresh data arrives
  useEffect(() => {
    setDrafts({});
    setSelectedKeys(new Set());
  }, [data]);

  const sourceOf = (l: MenuLine) => (l.kind === "variant" ? data!.variants.find((v) => v.id === l.id)! : data!.addOns.find((a) => a.id === l.id)!);

  function draftFor(l: MenuLine): Draft {
    const d = drafts[l.key];
    if (d) return d;
    const src = sourceOf(l);
    return {
      mode: src.sales_input_mode,
      perDay: String(Number(src.expected_per_open_day)),
      total: src.expected_total === null ? "" : String(Number(src.expected_total)),
    };
  }

  function setDraft(l: MenuLine, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [l.key]: { ...draftFor(l), ...patch } }));
  }

  function derived(d: Draft): { perDay: number | null; total: number | null; valid: boolean } {
    if (d.mode === "per_open_day") {
      const p = parseDecimal(d.perDay);
      if (!Number.isFinite(p) || p < 0) return { perDay: null, total: null, valid: false };
      return { perDay: p, total: sellingDays > 0 ? p * sellingDays : null, valid: true };
    }
    const t = parseDecimal(d.total);
    if (!Number.isFinite(t) || t < 0) return { perDay: null, total: null, valid: false };
    return { total: t, perDay: sellingDays > 0 ? t / sellingDays : null, valid: true };
  }

  const dirtyPatches = useMemo<SalesPatch[]>(() => {
    if (!data) return [];
    const out: SalesPatch[] = [];
    for (const l of lines) {
      const d = drafts[l.key];
      if (!d) continue;
      const src = sourceOf(l);
      const der = derived(d);
      if (!der.valid) continue;
      const patch: SalesPatch = {
        kind: l.kind,
        id: l.id,
        sales_input_mode: d.mode,
        expected_per_open_day: d.mode === "per_open_day" ? der.perDay! : Number(src.expected_per_open_day),
        expected_total: d.mode === "total" ? der.total : null,
      };
      const changed =
        patch.sales_input_mode !== src.sales_input_mode ||
        patch.expected_per_open_day !== Number(src.expected_per_open_day) ||
        (patch.expected_total ?? null) !== (src.expected_total === null ? null : Number(src.expected_total));
      if (changed) out.push(patch);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafts, lines, data, sellingDays]);

  const invalidCount = lines.filter((l) => drafts[l.key] && !derived(drafts[l.key]!).valid).length;

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["menu_card_data"] }),
      queryClient.invalidateQueries({ queryKey: ["variants"] }),
      queryClient.invalidateQueries({ queryKey: ["add_ons"] }),
    ]);

  const save = useMutation({
    mutationFn: () => saveSalesPatches(dirtyPatches, user.id),
    onSuccess: async () => {
      await invalidate();
      toast.success(`${dirtyPatches.length} ${dirtyPatches.length === 1 ? "Verkaufsmenge" : "Verkaufsmengen"} gespeichert.`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen."),
  });

  const bulkMutation = useMutation({
    mutationFn: async (b: Bulk) => {
      if (b.kind === "zero") {
        await bulkSetSales(lines.map((l) => ({ kind: l.kind, id: l.id })), { sales_input_mode: "per_open_day", expected_per_open_day: 0, expected_total: null }, user.id);
      } else if (b.kind === "category") {
        const v = parseDecimal(b.value);
        if (!Number.isFinite(v) || v < 0) throw new Error("Ungültiger Wert pro Öffnungstag.");
        const targets = lines.filter((l) => categoryKey(l) === b.categoryKey).map((l) => ({ kind: l.kind, id: l.id }));
        await bulkSetSales(targets, { sales_input_mode: "per_open_day", expected_per_open_day: v, expected_total: null }, user.id);
      } else if (b.kind === "reset") {
        const targets = lines.filter((l) => selectedKeys.has(l.key)).map((l) => ({ kind: l.kind, id: l.id }));
        await bulkSetSales(targets, DEMO_SALES, user.id);
      }
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("Massenaktion ausgeführt.");
      setBulk({ kind: "none" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Aktion fehlgeschlagen."),
  });

  const categoryKey = (l: MenuLine) => (l.kind === "add_on" ? "add_ons" : (l.categoryId ?? "none"));
  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of lines) map.set(categoryKey(l), l.categoryName);
    return Array.from(map.entries());
  }, [lines]);

  const filtered = [...lines].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "variant" ? -1 : 1) || a.categoryName.localeCompare(b.categoryName, "de-CH") || a.dishName.localeCompare(b.dishName, "de-CH")).filter((l) => {
    if (category !== "all" && categoryKey(l) !== category) return false;
    if (type !== "all" && l.kind !== type) return false;
    if (status !== "all" && l.status !== status) return false;
    return true;
  });

  const activeFilters = [
    category !== "all" ? `Kategorie: ${categoryOptions.find(([k]) => k === category)?.[1]}` : null,
    type !== "all" ? `Typ: ${type === "variant" ? "Variante" : "Add-on"}` : null,
    status !== "all" ? `Status: ${calculationStatusLabels[status]}` : null,
  ].filter(Boolean) as string[];

  const allFilteredSelected = filtered.length > 0 && filtered.every((l) => selectedKeys.has(l.key));
  const demoCount = lines.filter((l) => isDemoAssumption(sourceOf(l))).length;

  return (
    <>
      <PageHeader
        title="Verkaufsmengen"
        description="Erwartete Verkäufe je Variante und Add-on. Der eingegebene Wert (pro Öffnungstag oder Gesamtmenge) wird als Quelle gespeichert; der andere Wert wird aus den Verkaufstagen abgeleitet."
        actions={
          <Button onClick={() => save.mutate()} disabled={dirtyPatches.length === 0 || invalidCount > 0 || save.isPending}>
            <Save className="size-4" /> {dirtyPatches.length > 0 ? `${dirtyPatches.length} Änderungen speichern` : "Speichern"}
          </Button>
        }
      />

      <MenuCardSelector className="mb-4" />

      {(cardsPending || (card && isPending)) && <Skeleton className="h-64 w-full" />}
      {!cardsPending && !card && (
        <EmptyState icon={BarChart3} title="Keine Speisekarte" description="Legen Sie zuerst eine Speisekarte an, um Verkaufsmengen zu planen.">
          <Button asChild><Link to="/speisekarten">Zu den Speisekarten</Link></Button>
        </EmptyState>
      )}
      {error && <p className="text-sm text-destructive">Verkaufsmengen konnten nicht geladen werden.</p>}

      {card && data && totals && (
        <div className="space-y-4">
          <div className="surface flex flex-col gap-3 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <span><span className="text-muted-foreground">Laufzeit</span> <span className="tabular">{formatDate(card.valid_from)} – {formatDate(card.valid_to)}</span></span>
              <span><span className="text-muted-foreground">Verkaufstage</span> <span className="tabular font-semibold">{sellingDays}</span></span>
              <span><span className="text-muted-foreground">Positionen</span> <span className="tabular">{lines.length}</span></span>
            </div>
            {demoCount > 0 && <StatusBadge tone="warning">{demoCount} × {DEMO_LABEL}</StatusBadge>}
          </div>

          {sellingDays === 0 && (
            <p className="rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
              Diese Karte hat keine Verkaufstage. Gesamtmengen können nicht abgeleitet werden – bitte Laufzeit, Öffnungstage oder Schliesstage unter{" "}
              <Link to="/speisekarten/$menuCardId" params={{ menuCardId: card.id }} className="underline">Speisekarte</Link> prüfen.
            </p>
          )}

          {lines.length === 0 ? (
            <EmptyState icon={BarChart3} title="Keine aktiven Varianten oder Add-ons" description="Sobald Gerichte mit Varianten oder Add-ons erfasst sind, können hier Verkaufsmengen geplant werden.">
              <Button asChild variant="outline"><Link to="/gerichte">Zu den Gerichten</Link></Button>
            </EmptyState>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Kategorien</SelectItem>
                    {categoryOptions.map(([k, name]) => <SelectItem key={k} value={k}>{name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                  <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Varianten & Add-ons</SelectItem>
                    <SelectItem value="variant">Nur Varianten</SelectItem>
                    <SelectItem value="add_on">Nur Add-ons</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                  <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Status</SelectItem>
                    {(Object.keys(calculationStatusLabels) as CalculationStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{calculationStatusLabels[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="ml-auto flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setBulk({ kind: "zero" })}>Alle auf 0 setzen</Button>
                  <Button variant="outline" size="sm" onClick={() => setBulk({ kind: "category", categoryKey: category === "all" ? (categoryOptions[0]?.[0] ?? "") : category, value: "1" })} disabled={categoryOptions.length === 0}>
                    Kategorie auf Wert setzen
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setBulk({ kind: "reset" })} disabled={selectedKeys.size === 0}>
                    <RotateCcw className="size-4" /> Auswahl auf Demo-Annahme ({selectedKeys.size})
                  </Button>
                </div>
              </div>
              {activeFilters.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Aktive Filter: {activeFilters.join(" · ")} – {filtered.length} von {lines.length} Positionen. Filter ändern keine gespeicherten Werte.
                </p>
              )}

              <div className="surface overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">
                        <Checkbox
                          aria-label="Alle sichtbaren auswählen"
                          checked={allFilteredSelected}
                          onCheckedChange={(c) =>
                            setSelectedKeys((prev) => {
                              const next = new Set(prev);
                              filtered.forEach((l) => (c === true ? next.add(l.key) : next.delete(l.key)));
                              return next;
                            })
                          }
                        />
                      </TableHead>
                      <TableHead>Kategorie</TableHead>
                      <TableHead>Gericht</TableHead>
                      <TableHead>Variante oder Add-on</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead>Eingabemodus</TableHead>
                      <TableHead className="text-right">Pro Öffnungstag</TableHead>
                      <TableHead className="text-right">Gesamt über Laufzeit</TableHead>
                      <TableHead>Status der Annahme</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((l) => {
                      const d = draftFor(l);
                      const der = derived(d);
                      const src = sourceOf(l);
                      const dirty = !!drafts[l.key];
                      const demo = !dirty && isDemoAssumption(src);
                      return (
                        <TableRow key={l.key} className={cn(dirty && "bg-accent/20", l.kind === "add_on" && "bg-secondary/40")}>
                          <TableCell>
                            <Checkbox
                              aria-label={`${l.name} auswählen`}
                              checked={selectedKeys.has(l.key)}
                              onCheckedChange={(c) =>
                                setSelectedKeys((prev) => {
                                  const next = new Set(prev);
                                  c === true ? next.add(l.key) : next.delete(l.key);
                                  return next;
                                })
                              }
                            />
                          </TableCell>
                          <TableCell className="text-muted-foreground">{l.categoryName}</TableCell>
                          <TableCell className="max-w-56 truncate">{l.dishName}</TableCell>
                          <TableCell className="font-medium">{l.name}</TableCell>
                          <TableCell>
                            <StatusBadge tone={l.kind === "add_on" ? "neutral" : "muted"}>{l.kind === "add_on" ? "Add-on" : "Variante"}</StatusBadge>
                          </TableCell>
                          <TableCell>
                            <Select value={d.mode} onValueChange={(v) => setDraft(l, { mode: v as SalesInputMode, perDay: d.perDay || "0", total: d.total || (der.total !== null ? String(Math.round(der.total)) : "0") })}>
                              <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="per_open_day">Pro Öffnungstag</SelectItem>
                                <SelectItem value="total">Gesamtmenge</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right">
                            {d.mode === "per_open_day" ? (
                              <Input
                                inputMode="decimal"
                                aria-label="Pro Öffnungstag"
                                className={cn("ml-auto h-8 w-24 text-right tabular", !der.valid && "border-destructive")}
                                value={d.perDay}
                                onChange={(e) => setDraft(l, { perDay: e.target.value })}
                              />
                            ) : (
                              <span className="tabular text-muted-foreground" title="Abgeleitet aus Gesamtmenge">{fmtQty(der.perDay)}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {d.mode === "total" ? (
                              <Input
                                inputMode="decimal"
                                aria-label="Gesamtmenge"
                                className={cn("ml-auto h-8 w-24 text-right tabular", !der.valid && "border-destructive")}
                                value={d.total}
                                onChange={(e) => setDraft(l, { total: e.target.value })}
                              />
                            ) : (
                              <span className="tabular text-muted-foreground" title="Abgeleitet aus Wert pro Öffnungstag × Verkaufstage">{fmtQty(der.total)}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-1">
                              {dirty ? (
                                <StatusBadge tone="neutral">Ungespeichert</StatusBadge>
                              ) : demo ? (
                                <StatusBadge tone="warning" className="whitespace-nowrap" title={DEMO_LABEL}>Demo-Annahme</StatusBadge>
                              ) : (
                                <StatusBadge tone="success">Manuell erfasst</StatusBadge>
                              )}
                              {l.salesWarning && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex cursor-help items-center text-warning-foreground" aria-label="Plausibilitätshinweis">
                                      <AlertTriangle className="size-4" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs text-xs">{l.salesWarning}</TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {invalidCount > 0 && <p className="text-sm text-destructive">{invalidCount} Eingabe(n) ungültig – bitte nicht-negative Zahlen verwenden.</p>}
              <p className="text-xs text-muted-foreground">
                Add-on-Hinweise (⚠) erscheinen, wenn der erwartete Absatz eines Add-ons über dem Absatz aller zugeordneten Gerichte zusammen liegt. Sie blockieren nichts.
              </p>
            </>
          )}
        </div>
      )}

      <AlertDialog open={bulk.kind !== "none"} onOpenChange={(o) => !o && setBulk({ kind: "none" })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulk.kind === "zero" && "Alle Verkaufsmengen auf 0 setzen?"}
              {bulk.kind === "category" && "Kategorie auf einen Wert pro Öffnungstag setzen"}
              {bulk.kind === "reset" && "Auswahl auf Demo-Annahme zurücksetzen?"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                {bulk.kind === "zero" && <p>Alle {lines.length} aktiven Varianten und Add-ons dieser Karte erhalten 0 Verkäufe pro Öffnungstag. Ungespeicherte Eingaben gehen verloren.</p>}
                {bulk.kind === "reset" && <p>{selectedKeys.size} ausgewählte Positionen werden auf «1 Verkauf pro Öffnungstag» gesetzt ({DEMO_LABEL}).</p>}
                {bulk.kind === "category" && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">Kategorie</label>
                      <Select value={bulk.categoryKey} onValueChange={(v) => setBulk({ ...bulk, categoryKey: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {categoryOptions.map(([k, name]) => <SelectItem key={k} value={k}>{name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium" htmlFor="bulk-value">Verkäufe pro Öffnungstag</label>
                      <Input id="bulk-value" inputMode="decimal" value={bulk.value} onChange={(e) => setBulk({ ...bulk, value: e.target.value })} />
                    </div>
                    <p>Betrifft {lines.filter((l) => categoryKey(l) === bulk.categoryKey).length} Positionen. Eingabemodus wird auf «Pro Öffnungstag» gesetzt.</p>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); bulkMutation.mutate(bulk); }} disabled={bulkMutation.isPending}>
              Anwenden
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
