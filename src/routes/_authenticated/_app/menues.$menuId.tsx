import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, CalendarPlus, Copy, Pencil, Plus, Trash2, Utensils } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { MetricValue } from "@/components/dishes/Metric";
import { MenuDialog } from "@/components/menus/MenuDialog";
import { MenuVariantDialog } from "@/components/menus/MenuVariantDialog";
import { MenuPositionDialog } from "@/components/menus/MenuPositionDialog";
import { DishPickerDialog } from "@/components/menus/DishPickerDialog";
import { LinkEventDialog } from "@/components/menus/LinkEventDialog";
import {
  deleteMenuPosition,
  deleteMenuVariant,
  duplicateMenuVariant,
  ensureDefaultMenuVariant,
  menuPositionsQuery,
  menuQuery,
  menuVariantsQuery,
  reorderMenuPositions,
  type MenuPosition,
  type MenuVariant,
} from "@/lib/menus";
import { calculateMenu } from "@/lib/menu-costing";
import { MENU_POSITION_INACTIVE_NOTE } from "@/lib/menu-totals";
import { useMenuCostingContext } from "@/lib/menu-costing-context";
import { courseLabels, courseOrder, menuStatusLabels } from "@/lib/event-labels";
import { formatCHF, formatDate, formatQuantity } from "@/lib/format";
import { useAppContext } from "@/lib/app-route";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/_app/menues/$menuId")({
  validateSearch: (search: Record<string, unknown>): { add?: boolean } =>
    search["add"] === true || search["add"] === "true" ? { add: true } : {},
  head: () => ({
    meta: [
      { title: "Menü – KundiCalc" },
      { name: "description", content: "Menükalkulation: Gänge, Wareneinsatz und DB I pro Person." },
      { property: "og:title", content: "Menü – KundiCalc" },
      { property: "og:description", content: "Wiederverwendbares Menü aus bestehenden Gericht-Varianten." },
    ],
  }),
  component: MenuDetailPage,
  errorComponent: () => (
    <div className="surface px-6 py-5 text-sm text-muted-foreground">
      Das Menü konnte nicht geladen werden. Bitte laden Sie die Seite neu.
    </div>
  ),
  notFoundComponent: () => (
    <div className="surface px-6 py-5 text-sm text-muted-foreground">Dieses Menü existiert nicht.</div>
  ),
});

function MenuDetailPage() {
  const { menuId } = Route.useParams();
  const { add } = Route.useSearch();
  const { user } = useAppContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: menu, isPending } = useQuery(menuQuery(menuId));
  const { data: variants } = useQuery(menuVariantsQuery);
  const { data: positions } = useQuery(menuPositionsQuery);
  const { ctx, isPending: ctxPending, dishes, variants: dishVariants } = useMenuCostingContext();

  const [editOpen, setEditOpen] = useState(false);
  const [variantDialog, setVariantDialog] = useState<{ open: boolean; variant?: MenuVariant }>({ open: false });
  const [positionDialog, setPositionDialog] = useState<{ open: boolean; menuVariantId: string; position?: MenuPosition } | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  const results = useMemo(() => {
    if (!menu || !variants || !positions) return [];
    return calculateMenu(menu, variants, positions, ctx);
  }, [menu, variants, positions, ctx]);

  const ownVariants = useMemo(() => (variants ?? []).filter((v) => v.menu_id === menuId), [variants, menuId]);

  /** Creates the missing "Standard" variant on demand and opens dish selection. */
  const openPicker = async (menuVariantId?: string) => {
    if (preparing) return;
    if (menuVariantId) {
      setPickerFor(menuVariantId);
      return;
    }
    setPreparing(true);
    try {
      const target = await ensureDefaultMenuVariant(menuId);
      await qc.invalidateQueries({ queryKey: ["menu_variants"] });
      setPickerFor(target.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Die Standardvariante konnte nicht angelegt werden.");
    } finally {
      setPreparing(false);
    }
  };

  // Opened directly after menu creation – never writes just because a page loaded.
  useEffect(() => {
    if (!add || pickerFor || preparing || !variants) return;
    void navigate({ to: "/menues/$menuId", params: { menuId }, search: { add: false }, replace: true });
    void openPicker(ownVariants.find((v) => v.is_default)?.id ?? ownVariants[0]?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [add, variants]);

  if (isPending || !variants || !positions || ctxPending) return <Skeleton className="h-96 w-full" />;
  if (!menu) return <div className="surface px-6 py-5 text-sm text-muted-foreground">Dieses Menü existiert nicht.</div>;

  const singleVariant = results.length <= 1;

  const removeVariant = async (id: string) => {
    try {
      await deleteMenuVariant(id);
      await qc.invalidateQueries({ queryKey: ["menu_variants"] });
      await qc.invalidateQueries({ queryKey: ["menu_positions"] });
      toast.success("Menüvariante gelöscht.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Löschen fehlgeschlagen.");
    }
  };

  const removePosition = async (id: string) => {
    try {
      await deleteMenuPosition(id);
      await qc.invalidateQueries({ queryKey: ["menu_positions"] });
      toast.success("Position entfernt. Das Gericht und sein Rezept bleiben erhalten.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Löschen fehlgeschlagen.");
    }
  };

  const move = async (group: MenuPosition[], index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= group.length) return;
    const next = [...group];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    try {
      await reorderMenuPositions(next);
      await qc.invalidateQueries({ queryKey: ["menu_positions"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reihenfolge konnte nicht gespeichert werden.");
    }
  };

  const duplicate = async (variant: MenuVariant) => {
    try {
      await duplicateMenuVariant(variant, positions);
      await qc.invalidateQueries({ queryKey: ["menu_variants"] });
      await qc.invalidateQueries({ queryKey: ["menu_positions"] });
      toast.success("Menüvariante dupliziert.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Duplizieren fehlgeschlagen.");
    }
  };

  return (
    <>
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link to="/menues">
            <ArrowLeft className="size-4" /> Menüs
          </Link>
        </Button>
      </div>

      <PageHeader
        title={menu.name}
        description={
          menu.gross_price_per_person === null
            ? "Menüpreis noch offen. Der Wareneinsatz pro Person wird trotzdem berechnet; DB I und Marge folgen mit dem Preis."
            : `Brutto ${formatCHF(Number(menu.gross_price_per_person))} pro Person · MWST ${(Number(menu.vat_rate) * 100).toFixed(1)} %`
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setLinkOpen(true)}>
              <CalendarPlus className="size-4" /> Mit Event verknüpfen
            </Button>
            <Button variant="outline" onClick={() => setVariantDialog({ open: true })}>
              <Plus className="size-4" /> Weitere Menüvariante
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" /> Menü bearbeiten
            </Button>
            <Button onClick={() => openPicker(singleVariant ? ownVariants[0]?.id : undefined)} disabled={preparing}>
              <Plus className="size-4" /> Gerichte hinzufügen
            </Button>
          </>
        }
      />

      <div className="surface mb-6 flex flex-wrap items-center gap-3 px-5 py-4 text-sm">
        <StatusBadge tone={menu.status === "reviewed" ? "success" : "muted"}>{menuStatusLabels[menu.status]}</StatusBadge>
        {menu.demo_key && (
          <StatusBadge tone="warning" title="Demo-Daten, keine bestätigten Ist-Werte">
            Demo
          </StatusBadge>
        )}
        <span className="text-muted-foreground">
          Gültig: {menu.valid_from ? formatDate(menu.valid_from) : "–"} bis {menu.valid_to ? formatDate(menu.valid_to) : "–"}
        </span>
        <span className="text-muted-foreground">
          Dieses Menü ist eine eigenständige, wiederverwendbare Kalkulation – ein Event ist nicht erforderlich.
        </span>
      </div>

      {menu.notes && <p className="mb-6 text-sm text-muted-foreground">{menu.notes}</p>}

      {results.every((r) => r.positions.length === 0) && (
        <EmptyState
          icon={Utensils}
          title="Noch keine Gerichte"
          description="Stellen Sie Ihr Menü aus bestehenden Gerichten zusammen."
        >
          <Button onClick={() => openPicker(singleVariant ? ownVariants[0]?.id : undefined)} disabled={preparing}>
            <Plus className="size-4" /> Gerichte hinzufügen
          </Button>
        </EmptyState>
      )}

      {results.length > 1 && (
        <section className="surface mb-6 overflow-x-auto">
          <div className="px-5 pt-4">
            <h2 className="section-title">Vergleich der Menüvarianten</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Variante</TableHead>
                <TableHead className="text-right">Erwartete Gäste</TableHead>
                <TableHead className="text-right">Brutto / Person</TableHead>
                <TableHead className="text-right">Netto / Person</TableHead>
                <TableHead className="text-right">Wareneinsatz</TableHead>
                <TableHead className="text-right">Quote</TableHead>
                <TableHead className="text-right">DB I</TableHead>
                <TableHead className="text-right">DB-I-Marge</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((r) => (
                <TableRow key={r.menuVariant.id}>
                  <TableCell className="font-medium">{r.menuVariant.name}</TableCell>
                  <TableCell className="text-right tabular">{r.menuVariant.expected_guests ?? "–"}</TableCell>
                  <TableCell className="text-right"><MetricValue value={r.grossPrice} kind="chf" problems={r.problems} /></TableCell>
                  <TableCell className="text-right"><MetricValue value={r.netPrice} kind="chf" problems={r.problems} /></TableCell>
                  <TableCell className="text-right"><MetricValue value={r.foodCost} kind="chf" problems={r.costProblems} /></TableCell>
                  <TableCell className="text-right"><MetricValue value={r.foodCostRatio} kind="percent" problems={r.problems} /></TableCell>
                  <TableCell className="text-right"><MetricValue value={r.contributionMargin1} kind="chf" problems={r.problems} /></TableCell>
                  <TableCell className="text-right"><MetricValue value={r.contributionMarginRatio} kind="percent" problems={r.problems} /></TableCell>
                  <TableCell>
                    <StatusBadge tone={r.complete ? "success" : "warning"}>
                      {r.complete ? "Vollständig" : r.costComplete && r.priceMissing ? "Menüpreis noch offen" : "Unvollständig"}
                    </StatusBadge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      {results.map((r) => {
        const sorted = [...r.positions].sort(
          (a, b) =>
            (courseOrder[a.position.course] ?? 99) - (courseOrder[b.position.course] ?? 99) ||
            a.position.sort_order - b.position.sort_order,
        );
        const courses = [...new Set(sorted.map((p) => p.position.course))];
        return (
          <section key={r.menuVariant.id} className="surface mb-6">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
              <div>
                <h2 className="text-base font-semibold">
                  {singleVariant ? "Zusammenstellung" : r.menuVariant.name}
                  {!singleVariant && r.menuVariant.is_default && (
                    <StatusBadge className="ml-2" tone="neutral">
                      Standard
                    </StatusBadge>
                  )}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  1 = eine Portion der gewählten Gericht-Variante pro Gast.
                </p>
                {r.menuVariant.notes && <p className="mt-1 text-sm text-muted-foreground">{r.menuVariant.notes}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => openPicker(r.menuVariant.id)}>
                  <Plus className="size-4" /> Gerichte hinzufügen
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setVariantDialog({ open: true, variant: r.menuVariant })}>
                  <Pencil className="size-4" /> Variante
                </Button>
                {!singleVariant && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => duplicate(r.menuVariant)}>
                      <Copy className="size-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => removeVariant(r.menuVariant.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {!r.costComplete && (
              <p className="border-b bg-warning/10 px-5 py-2.5 text-xs text-warning-foreground">
                Der Wareneinsatz dieser Menüvariante ist nicht vollständig berechenbar: {r.costProblems.join(" · ")}
              </p>
            )}
            {r.costComplete && r.priceMissing && (
              <p className="border-b px-5 py-2.5 text-xs text-muted-foreground">
                Menüpreis noch offen – DB I und Marge werden erst mit dem Verkaufspreis ausgewiesen.
              </p>
            )}

            {sorted.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                Noch keine Gerichte. Stellen Sie Ihr Menü aus bestehenden Gerichten zusammen.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Gang</TableHead>
                      <TableHead>Gericht-Variante</TableHead>
                      <TableHead className="text-right">Menge / Gast</TableHead>
                      <TableHead className="text-right">Wareneinsatz / Gast</TableHead>
                      <TableHead className="w-40" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {courses.map((course) => {
                      const group = sorted.filter((p) => p.position.course === course);
                      const groupPositions = group.map((p) => p.position);
                      return group.map((p, i) => (
                        <TableRow key={p.position.id}>
                          <TableCell>{i === 0 ? (courseLabels[course] ?? course) : ""}</TableCell>
                          <TableCell>
                            {p.dishName ? `${p.dishName} – ${p.variantName}` : "Gericht nicht gefunden"}
                            {p.position.notes && <div className="text-xs text-muted-foreground">{p.position.notes}</div>}
                            {p.aLaCarteInactive && (
                              <div className="text-xs text-muted-foreground">{MENU_POSITION_INACTIVE_NOTE}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular">{formatQuantity(p.quantityPerGuest)}</TableCell>
                          <TableCell className="text-right">
                            <MetricValue
                              value={p.foodCostPerGuest}
                              kind="chf"
                              problems={p.problem ? [p.problem, ...(p.dish?.problems ?? [])] : undefined}
                            />
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label="Nach oben"
                              disabled={i === 0}
                              onClick={() => move(groupPositions, i, -1)}
                            >
                              <ArrowUp className="size-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label="Nach unten"
                              disabled={i === group.length - 1}
                              onClick={() => move(groupPositions, i, 1)}
                            >
                              <ArrowDown className="size-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label="Bearbeiten"
                              onClick={() => setPositionDialog({ open: true, menuVariantId: r.menuVariant.id, position: p.position })}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button size="sm" variant="ghost" aria-label="Entfernen" onClick={() => removePosition(p.position.id)}>
                              <Trash2 className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ));
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            <dl className="grid grid-cols-2 gap-4 border-t px-5 py-4 text-sm md:grid-cols-4">
              <div>
                <dt className="text-xs text-muted-foreground">Netto / Person</dt>
                <dd><MetricValue value={r.netPrice} kind="chf" problems={r.problems} /></dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Wareneinsatz / Person</dt>
                <dd><MetricValue value={r.foodCost} kind="chf" problems={r.costProblems} /></dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">DB I / Person</dt>
                <dd><MetricValue value={r.contributionMargin1} kind="chf" problems={r.problems} /></dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">DB-I-Marge</dt>
                <dd><MetricValue value={r.contributionMarginRatio} kind="percent" problems={r.problems} /></dd>
              </div>
            </dl>
          </section>
        );
      })}

      {editOpen && <MenuDialog open={editOpen} onOpenChange={setEditOpen} userId={user.id} menu={menu} />}
      {variantDialog.open && (
        <MenuVariantDialog
          open={variantDialog.open}
          onOpenChange={(o) => setVariantDialog({ open: o })}
          menuId={menu.id}
          variant={variantDialog.variant}
          sourceVariants={ownVariants}
          positions={positions}
          showDefaultSwitch={!singleVariant || Boolean(variantDialog.variant) === false}
        />
      )}
      {pickerFor && (
        <DishPickerDialog
          open
          onOpenChange={(o) => !o && setPickerFor(null)}
          menuVariantId={pickerFor}
          existingPositions={positions.filter((p) => p.menu_variant_id === pickerFor)}
          ctx={ctx}
          dishes={dishes}
          variants={dishVariants}
          onEditExisting={(position) => setPositionDialog({ open: true, menuVariantId: pickerFor, position })}
        />
      )}
      {positionDialog?.open && (
        <MenuPositionDialog
          open
          onOpenChange={(o) => !o && setPositionDialog(null)}
          menuVariantId={positionDialog.menuVariantId}
          dishes={dishes}
          variants={dishVariants}
          position={positionDialog.position}
        />
      )}
      {linkOpen && (
        <LinkEventDialog
          open={linkOpen}
          onOpenChange={setLinkOpen}
          menu={menu}
          results={results}
          userId={user.id}
          onLinked={(eventId) => navigate({ to: "/events/$eventId", params: { eventId } })}
        />
      )}
    </>
  );
}
