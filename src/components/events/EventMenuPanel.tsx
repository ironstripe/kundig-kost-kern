import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCHF, formatDateTime, formatQuantity } from "@/lib/format";
import { courseLabels } from "@/lib/event-labels";
import { menuPositionsQuery, menuQuery, menuVariantsQuery } from "@/lib/menus";
import { useMenuCostingContext } from "@/lib/menu-costing-context";
import { buildMenuSnapshot, calculateMenu, type MenuSnapshot } from "@/lib/menu-costing";
import {
  isSnapshotLocked,
  linkMenuToEvent,
  setEventMenuVariant,
  unlinkMenuFromEvent,
  type Event,
  type EventMenuLink,
  type EventMenuVariantRow,
} from "@/lib/events";

type Props = {
  event: Event;
  link: EventMenuLink | null;
  variants: EventMenuVariantRow[];
  userId: string;
};

export function EventMenuPanel({ event, link, variants, userId }: Props) {
  const qc = useQueryClient();
  const locked = isSnapshotLocked(event.status);
  const snapshot = (link?.snapshot ?? null) as MenuSnapshot | null;
  const { data: menu } = useQuery({ ...menuQuery(link?.menu_id ?? ""), enabled: Boolean(link?.menu_id) });
  const { data: menuVariants } = useQuery(menuVariantsQuery);
  const { data: positions } = useQuery(menuPositionsQuery);
  const { ctx, isPending: ctxPending } = useMenuCostingContext();
  const [busy, setBusy] = useState(false);

  if (!link || !snapshot) {
    return (
      <section className="surface px-5 py-5">
        <h2 className="section-title">Menü</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Für diesen Event ist kein Menü verknüpft. Verknüpfen Sie ein Menü unter{" "}
          <Link to="/menues" className="underline">
            Menüs
          </Link>
          . Beim Verknüpfen wird ein unveränderlicher Snapshot der Menükalkulation gespeichert.
        </p>
      </section>
    );
  }

  const refresh = async () => {
    if (!menu || !menuVariants || !positions || ctxPending) return;
    setBusy(true);
    try {
      const results = calculateMenu(menu, menuVariants, positions, ctx);
      await linkMenuToEvent(event.id, menu.id, buildMenuSnapshot(menu, results), userId);
      await qc.invalidateQueries({ queryKey: ["event_menu_links"] });
      toast.success("Snapshot wurde bewusst aktualisiert.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Aktualisieren fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    setBusy(true);
    try {
      await unlinkMenuFromEvent(event.id);
      await qc.invalidateQueries({ queryKey: ["event_menu_links"] });
      await qc.invalidateQueries({ queryKey: ["event_menu_variants"] });
      toast.success("Menü-Verknüpfung entfernt.");
    } finally {
      setBusy(false);
    }
  };

  const setGuests = async (menuVariantId: string, value: string, field: "planned_guests" | "actual_guests") => {
    const n = value.trim() === "" ? null : Number(value);
    if (n !== null && (!Number.isInteger(n) || n < 0)) {
      toast.error("Gästezahl muss eine ganze Zahl ab 0 sein.");
      return;
    }
    await setEventMenuVariant(event.id, menuVariantId, { [field]: n });
    await qc.invalidateQueries({ queryKey: ["event_menu_variants"] });
  };

  return (
    <section className="surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold">Menü: {snapshot.menu.name}</h2>
          <p className="text-xs text-muted-foreground">
            Snapshot vom {formatDateTime(link.snapshot_at)} · historisch, ändert sich nicht mit dem Menü
          </p>
        </div>
        <div className="flex gap-2">
          {locked ? (
            <StatusBadge tone="muted" title="Der Event ist durchgeführt oder abgeschlossen – der Snapshot bleibt historisch.">
              Snapshot gesperrt
            </StatusBadge>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={refresh} disabled={busy}>
                Snapshot bewusst aktualisieren
              </Button>
              <Button size="sm" variant="ghost" onClick={unlink} disabled={busy}>
                Verknüpfung lösen
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Menüvariante</TableHead>
              <TableHead className="text-right">Brutto pro Person</TableHead>
              <TableHead className="text-right">Wareneinsatz pro Gast</TableHead>
              <TableHead className="text-right">DB I pro Gast</TableHead>
              <TableHead className="w-32 text-right">Gäste geplant</TableHead>
              <TableHead className="w-32 text-right">Gäste effektiv</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {snapshot.variants.map((v) => {
              const row = variants.find((x) => x.menu_variant_id === v.id);
              return (
                <TableRow key={v.id}>
                  <TableCell>
                    <div className="font-medium">{v.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {v.positions
                        .map((p) => `${courseLabels[p.course] ?? p.course}: ${p.dishName ?? "?"}${p.quantityPerGuest !== 1 ? ` (${formatQuantity(p.quantityPerGuest)}×)` : ""}`)
                        .join(" · ")}
                    </div>
                    {!v.complete && (
                      <div className="mt-1 text-xs text-warning-foreground">Unvollständig: {v.problems.join(", ")}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular">{v.grossPrice === null ? "–" : formatCHF(v.grossPrice)}</TableCell>
                  <TableCell className="text-right tabular">{v.foodCost === null ? "–" : formatCHF(v.foodCost)}</TableCell>
                  <TableCell className="text-right tabular">
                    {v.contributionMargin1 === null ? "–" : formatCHF(v.contributionMargin1)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      className="h-8 text-right"
                      defaultValue={row?.planned_guests === null || row === undefined ? "" : String(row.planned_guests)}
                      onBlur={(e) => setGuests(v.id, e.target.value, "planned_guests")}
                      aria-label={`Geplante Gäste ${v.name}`}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      className="h-8 text-right"
                      defaultValue={row?.actual_guests === null || row === undefined ? "" : String(row.actual_guests)}
                      onBlur={(e) => setGuests(v.id, e.target.value, "actual_guests")}
                      aria-label={`Effektive Gäste ${v.name}`}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
