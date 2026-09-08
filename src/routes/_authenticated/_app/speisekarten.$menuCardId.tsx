import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CalendarPlus, Pencil, Trash2, Check } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { MenuCardSummary } from "@/components/menu-cards/MenuCardSummary";
import { MenuCardConfigDialog } from "@/components/menu-cards/MenuCardConfigDialog";
import { ExcludedDayDialog } from "@/components/menu-cards/ExcludedDayDialog";
import { menuCardDataQuery, removeExcludedDay, type ExcludedDay } from "@/lib/menu-cards";
import { calculateMenuTotals } from "@/lib/menu-totals";
import { useSelectedMenuCard } from "@/lib/selected-menu-card";
import { useAppContext } from "@/lib/app-route";
import { formatDate, formatWeekdays, WEEKDAYS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

export const Route = createFileRoute("/_authenticated/_app/speisekarten/$menuCardId")({
  head: () => ({
    meta: [
      { title: "Speisekarte – KundiCalc" },
      { name: "description", content: "Laufzeit, Öffnungstage, Verkaufstage und Schliesstage einer Speisekarte." },
      { property: "og:title", content: "Speisekarte – KundiCalc" },
      { property: "og:description", content: "Laufzeit, Verkaufstage und Schliesstage." },
    ],
  }),
  component: MenuCardDetailPage,
});

function isoWeekday(date: string): number {
  const js = new Date(`${date}T00:00:00Z`).getUTCDay();
  return js === 0 ? 7 : js;
}

function MenuCardDetailPage() {
  const { menuCardId } = Route.useParams();
  const { user } = useAppContext();
  const queryClient = useQueryClient();
  const { data, isPending, error } = useQuery(menuCardDataQuery(menuCardId));
  const { data: selected, select } = useSelectedMenuCard();
  const [dialog, setDialog] = useState<"none" | "edit" | "excluded">("none");
  const [toRemove, setToRemove] = useState<ExcludedDay | null>(null);

  const totals = useMemo(() => (data ? calculateMenuTotals(data) : null), [data]);

  const remove = useMutation({
    mutationFn: (d: ExcludedDay) => removeExcludedDay(d.id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["excluded_days"] }),
        queryClient.invalidateQueries({ queryKey: ["menu_card_data"] }),
      ]);
      toast.success("Schliesstag entfernt.");
      setToRemove(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Entfernen fehlgeschlagen."),
  });

  if (isPending) return <Skeleton className="h-64 w-full" />;
  if (error || !data) {
    return (
      <>
        <PageHeader title="Speisekarte" />
        <p className="text-sm text-destructive">Die Speisekarte konnte nicht geladen werden.</p>
        <Button asChild variant="link" className="px-0"><Link to="/speisekarten">Zurück zu den Speisekarten</Link></Button>
      </>
    );
  }

  const card = data.card;
  const isSelected = selected?.id === card.id;
  const calendarDays =
    Math.round((new Date(`${card.valid_to}T00:00:00Z`).getTime() - new Date(`${card.valid_from}T00:00:00Z`).getTime()) / 86_400_000) + 1;
  const activeAddOns = data.addOns.filter((a) => a.is_active).length;

  return (
    <>
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link to="/speisekarten"><ArrowLeft className="size-4" /> Speisekarten</Link>
        </Button>
      </div>
      <PageHeader
        title={card.name}
        description="Verkaufstage werden dynamisch aus Laufzeit, Öffnungstagen und Schliesstagen berechnet. Änderungen wirken sofort auf alle erwarteten Gesamtmengen und Auswertungen."
        actions={
          <>
            {!isSelected && (
              <Button variant="outline" onClick={() => select(card.id)}>
                <Check className="size-4" /> Als aktuelle Karte auswählen
              </Button>
            )}
            <Button variant="outline" onClick={() => setDialog("edit")}>
              <Pencil className="size-4" /> Bearbeiten
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        <MenuCardSummary
          card={card}
          actions={isSelected ? <StatusBadge tone="neutral"><Check className="mr-1 size-3" />Aktuell ausgewählt</StatusBadge> : undefined}
        />

        <section className="surface">
          <header className="border-b border-border px-6 py-4">
            <h2 className="text-base font-semibold">Verkaufstage</h2>
          </header>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-5 px-6 py-5 md:grid-cols-4">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Kalenderzeitraum</dt>
              <dd className="mt-1 text-sm tabular">{formatDate(card.valid_from)} – {formatDate(card.valid_to)}<span className="block text-xs text-muted-foreground">{calendarDays} Kalendertage</span></dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Reguläre Öffnungstage</dt>
              <dd className="mt-1 text-sm">{formatWeekdays(card.opening_weekdays)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Schliesstage</dt>
              <dd className="mt-1 text-sm tabular">{data.excludedDays.length}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Berechnete Verkaufstage</dt>
              <dd className="mt-1 text-2xl font-semibold tabular">{totals?.sellingDays ?? 0}</dd>
            </div>
          </dl>
          {totals?.sellingDays === 0 && (
            <p className="border-t border-border px-6 py-3 text-sm text-warning-foreground">
              Keine Verkaufstage: In der Laufzeit liegt kein gewählter Öffnungstag ohne Schliesstag. Erwartete Gesamtmengen können nicht berechnet werden.
            </p>
          )}
        </section>

        <section className="surface">
          <header className="flex flex-col gap-3 border-b border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold">Schliesstage</h2>
              <p className="text-xs text-muted-foreground">Feiertage, Betriebsferien oder Sonderschliessungen werden nicht automatisch übernommen.</p>
            </div>
            <Button onClick={() => setDialog("excluded")}>
              <CalendarPlus className="size-4" /> Schliesstag hinzufügen
            </Button>
          </header>
          {data.excludedDays.length === 0 ? (
            <p className="px-6 py-6 text-sm text-muted-foreground">Noch keine Schliesstage erfasst.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Wochentag</TableHead>
                  <TableHead>Grund</TableHead>
                  <TableHead>Wirkung</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.excludedDays.map((d) => {
                  const wd = isoWeekday(d.excluded_date);
                  const regular = card.opening_weekdays.includes(wd);
                  const inPeriod = d.excluded_date >= card.valid_from && d.excluded_date <= card.valid_to;
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="tabular">{formatDate(d.excluded_date)}</TableCell>
                      <TableCell>{WEEKDAYS.find((w) => w.value === wd)?.label}</TableCell>
                      <TableCell className="text-muted-foreground">{d.reason ?? "–"}</TableCell>
                      <TableCell>
                        {!inPeriod ? (
                          <StatusBadge tone="muted">Ausserhalb der Laufzeit</StatusBadge>
                        ) : regular ? (
                          <StatusBadge tone="warning">−1 Verkaufstag</StatusBadge>
                        ) : (
                          <StatusBadge tone="muted">Ohnehin geschlossen</StatusBadge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" aria-label="Schliesstag entfernen" onClick={() => setToRemove(d)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </section>

        <section className="surface">
          <header className="border-b border-border px-6 py-4">
            <h2 className="text-base font-semibold">Inhalt der Karte</h2>
          </header>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-5 px-6 py-5 md:grid-cols-4">
            <div><dt className="text-xs font-medium text-muted-foreground">Kategorien</dt><dd className="mt-1 text-sm tabular">{data.categories.length}</dd></div>
            <div><dt className="text-xs font-medium text-muted-foreground">Gerichte (aktiv)</dt><dd className="mt-1 text-sm tabular">{totals?.counts.dishes ?? 0}</dd></div>
            <div><dt className="text-xs font-medium text-muted-foreground">Varianten (aktiv)</dt><dd className="mt-1 text-sm tabular">{totals?.counts.variants ?? 0}</dd></div>
            <div><dt className="text-xs font-medium text-muted-foreground">Add-ons (aktiv)</dt><dd className="mt-1 text-sm tabular">{activeAddOns}</dd></div>
          </dl>
          <div className="flex flex-wrap gap-4 border-t border-border px-6 py-3 text-sm">
            <Link to="/gerichte" onClick={() => select(card.id)} className="font-medium text-primary hover:underline">Gerichte dieser Karte</Link>
            <Link to="/verkaufsmengen" onClick={() => select(card.id)} className="font-medium text-primary hover:underline">Verkaufsmengen planen</Link>
            <Link to="/uebersicht" onClick={() => select(card.id)} className="font-medium text-primary hover:underline">Übersicht öffnen</Link>
          </div>
        </section>
      </div>

      {dialog === "edit" && <MenuCardConfigDialog card={card} userId={user.id} open onOpenChange={() => setDialog("none")} />}
      {dialog === "excluded" && <ExcludedDayDialog card={card} existing={data.excludedDays} open onOpenChange={() => setDialog("none")} />}

      <AlertDialog open={!!toRemove} onOpenChange={(o) => !o && setToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Schliesstag entfernen?</AlertDialogTitle>
            <AlertDialogDescription>
              {toRemove && `${formatDate(toRemove.excluded_date)} wird wieder als Verkaufstag gezählt, sofern es ein regulärer Öffnungstag ist.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => toRemove && remove.mutate(toRemove)} disabled={remove.isPending}>Entfernen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
