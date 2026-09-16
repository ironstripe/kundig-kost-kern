import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ClipboardList, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { MetricValue } from "@/components/dishes/Metric";
import { MenuDialog } from "@/components/menus/MenuDialog";
import { NewCalculationDialog } from "@/components/common/NewCalculationDialog";
import { menuPositionsQuery, menuVariantsQuery, menusQuery } from "@/lib/menus";
import { calculateMenu, primaryMenuResult } from "@/lib/menu-costing";
import { useMenuCostingContext } from "@/lib/menu-costing-context";
import { menuStatusLabels } from "@/lib/event-labels";
import { useAppContext } from "@/lib/app-route";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/_app/menues/")({
  head: () => ({
    meta: [
      { title: "Menüs – KundiCalc" },
      { name: "description", content: "Wiederverwendbare Mehrgang-Menüs aus bestehenden Gericht-Varianten." },
      { property: "og:title", content: "Menüs – KundiCalc" },
      { property: "og:description", content: "Menükalkulation mit Wareneinsatz und DB I pro Person." },
    ],
  }),
  component: MenusPage,
});

function MenusPage() {
  const { user } = useAppContext();
  const navigate = useNavigate();
  const { data: menus, isPending, error } = useQuery(menusQuery);
  const { data: variants } = useQuery(menuVariantsQuery);
  const { data: positions } = useQuery(menuPositionsQuery);
  const { ctx, isPending: ctxPending } = useMenuCostingContext();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);

  const rows = useMemo(() => {
    if (!menus || !variants || !positions) return [];
    return menus.map((menu) => {
      const results = calculateMenu(menu, variants, positions, ctx);
      return { menu, results, primary: primaryMenuResult(results) };
    });
  }, [menus, variants, positions, ctx]);

  const loading = isPending || !variants || !positions || ctxPending;

  return (
    <>
      <PageHeader
        title="Menüs"
        description="Ein Menü ist eine wiederverwendbare Kombination bestehender Gericht-Varianten, die als Paket pro Person verkauft wird. Menüs funktionieren mit oder ohne Event."
        actions={
          <>
            <Button variant="outline" onClick={() => setChooserOpen(true)}>
              Neue Kalkulation
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="size-4" /> Menü anlegen
            </Button>
          </>
        }
      />

      {error && (
        <div className="surface px-6 py-5 text-sm text-muted-foreground">
          Die Menüs konnten nicht geladen werden. Bitte laden Sie die Seite neu.
        </div>
      )}

      {loading && !error && <Skeleton className="h-56 w-full" />}

      {!loading && !error && rows.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title="Noch keine Menüs"
          description="Legen Sie ein Menü an und ergänzen Sie Varianten und Gänge aus bestehenden Gericht-Varianten."
        >
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" /> Menü anlegen
          </Button>
        </EmptyState>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="surface overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Menü</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Varianten</TableHead>
                <TableHead className="text-right">Brutto / Person</TableHead>
                <TableHead className="text-right">Wareneinsatz</TableHead>
                <TableHead className="text-right">DB I / Person</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ menu, results, primary }) => (
                <TableRow key={menu.id}>
                  <TableCell>
                    <Link to="/menues/$menuId" params={{ menuId: menu.id }} className="font-medium hover:underline">
                      {menu.name}
                    </Link>
                    {menu.demo_key && (
                      <StatusBadge tone="warning" className="ml-2" title="Demo-Daten, keine bestätigten Ist-Werte">
                        Demo
                      </StatusBadge>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={menu.status === "reviewed" ? "success" : "muted"}>
                      {menuStatusLabels[menu.status]}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{results.length}</TableCell>
                  <TableCell className="text-right">
                    <MetricValue value={primary?.grossPrice ?? null} kind="chf" problems={primary?.problems} />
                  </TableCell>
                  <TableCell className="text-right">
                    <MetricValue value={primary?.foodCost ?? null} kind="chf" problems={primary?.problems} />
                  </TableCell>
                  <TableCell className="text-right">
                    <MetricValue
                      value={primary?.contributionMargin1 ?? null}
                      kind="chf"
                      problems={primary?.problems}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {dialogOpen && (
        <MenuDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          userId={user.id}
          onCreated={(menuId) => navigate({ to: "/menues/$menuId", params: { menuId }, search: { add: true } })}
        />
      )}
      <NewCalculationDialog
        open={chooserOpen}
        onOpenChange={setChooserOpen}
        onChooseMenu={() => setDialogOpen(true)}
      />
    </>
  );
}
