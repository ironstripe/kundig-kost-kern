import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BookOpen, Plus, MoreHorizontal, ArrowUpRight, Check } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { MenuCardConfigDialog } from "@/components/menu-cards/MenuCardConfigDialog";
import { menuCardCountsQuery, menuCardsQuery, updateMenuCard, deleteMenuCard, type MenuCard } from "@/lib/menu-cards";
import { useSelectedMenuCard } from "@/lib/selected-menu-card";
import { useAppContext } from "@/lib/app-route";
import { formatDate, formatDateTime, formatWeekdays } from "@/lib/format";
import { openDaysCount } from "@/lib/sales";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

export const Route = createFileRoute("/_authenticated/_app/speisekarten/")({
  head: () => ({
    meta: [
      { title: "Speisekarten – KundiCalc" },
      { name: "description", content: "Speisekarten des Kundelfingerhofs mit Laufzeit, Verkaufstagen und Datenqualität." },
      { property: "og:title", content: "Speisekarten – KundiCalc" },
      { property: "og:description", content: "Speisekarten mit Laufzeit, Verkaufstagen und Datenqualität." },
    ],
  }),
  component: MenuCardsPage,
});

type Dialog = { kind: "none" } | { kind: "create" } | { kind: "edit"; card: MenuCard } | { kind: "toggle"; card: MenuCard } | { kind: "delete"; card: MenuCard };

function MenuCardsPage() {
  const { user } = useAppContext();
  const queryClient = useQueryClient();
  const { data: cards, isPending, error } = useQuery(menuCardsQuery);
  const { data: counts } = useQuery(menuCardCountsQuery);
  const { data: excluded } = useQuery({
    queryKey: ["excluded_days", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("excluded_days").select("menu_card_id, excluded_date");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: selected, select } = useSelectedMenuCard();
  const [dialog, setDialog] = useState<Dialog>({ kind: "none" });

  const sellingDays = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of cards ?? []) {
      const ex = (excluded ?? []).filter((e) => e.menu_card_id === c.id).map((e) => e.excluded_date);
      map.set(c.id, openDaysCount(c, ex));
    }
    return map;
  }, [cards, excluded]);

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["menu_cards"] }),
      queryClient.invalidateQueries({ queryKey: ["menu_card_counts"] }),
      queryClient.invalidateQueries({ queryKey: ["menu_card_data"] }),
    ]);

  const toggle = useMutation({
    mutationFn: (card: MenuCard) => updateMenuCard(card.id, { is_active: !card.is_active }, user.id),
    onSuccess: async (_, card) => {
      await invalidate();
      toast.success(card.is_active ? "Speisekarte deaktiviert." : "Speisekarte aktiviert.");
      setDialog({ kind: "none" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Aktion fehlgeschlagen."),
  });

  const remove = useMutation({
    mutationFn: (card: MenuCard) => deleteMenuCard(card.id),
    onSuccess: async () => {
      await invalidate();
      toast.success("Speisekarte gelöscht.");
      setDialog({ kind: "none" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Löschen fehlgeschlagen."),
  });

  function quality(c: MenuCard) {
    const k = counts?.[c.id];
    if (!k || k.variants + k.addOns === 0) return { label: "Keine Kalkulationen", tone: "muted" as const };
    if (k.estimated === 0) return { label: "Alle geprüft", tone: "success" as const };
    if (k.reviewed === 0) return { label: `${k.estimated} geschätzt`, tone: "warning" as const };
    return { label: `${k.reviewed} geprüft · ${k.estimated} offen`, tone: "neutral" as const };
  }

  return (
    <>
      <PageHeader
        title="Speisekarten"
        description="Eine Speisekarte bündelt Laufzeit, Öffnungstage, MWST und Kleinmaterial-Zuschlag. Die hier gewählte Karte gilt in Übersicht, Gerichten, Verkaufsmengen und Szenario."
        actions={
          <Button onClick={() => setDialog({ kind: "create" })}>
            <Plus className="size-4" /> Speisekarte anlegen
          </Button>
        }
      />

      {isPending && <Skeleton className="h-48 w-full" />}
      {error && <p className="text-sm text-destructive">Speisekarten konnten nicht geladen werden.</p>}

      {cards && cards.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title="Noch keine Speisekarte"
          description="Legen Sie die erste Speisekarte mit Laufzeit und Öffnungstagen an. Gerichte, Add-ons und Verkaufsmengen beziehen sich immer auf eine Karte."
        >
          <Button onClick={() => setDialog({ kind: "create" })}><Plus className="size-4" /> Speisekarte anlegen</Button>
        </EmptyState>
      )}

      {cards && cards.length > 0 && (
        <div className="surface overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Gültig von</TableHead>
                <TableHead>Gültig bis</TableHead>
                <TableHead className="text-right">Verkaufstage</TableHead>
                <TableHead className="text-right">Anzahl Gerichte</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Datenqualität</TableHead>
                <TableHead>Zuletzt geändert</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {cards.map((c) => {
                const q = quality(c);
                const isSelected = selected?.id === c.id;
                const dishCount = counts?.[c.id]?.dishes ?? 0;
                return (
                  <TableRow key={c.id} className={cn(isSelected && "bg-accent/30")}>
                    <TableCell>
                      <Link to="/speisekarten/$menuCardId" params={{ menuCardId: c.id }} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{formatWeekdays(c.opening_weekdays)}</div>
                    </TableCell>
                    <TableCell className="tabular">{formatDate(c.valid_from)}</TableCell>
                    <TableCell className="tabular">{formatDate(c.valid_to)}</TableCell>
                    <TableCell className="tabular text-right">{sellingDays.get(c.id) ?? "–"}</TableCell>
                    <TableCell className="tabular text-right">{counts ? dishCount : "–"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <StatusBadge tone={c.is_active ? "success" : "muted"}>{c.is_active ? "Aktiv" : "Inaktiv"}</StatusBadge>
                        {isSelected && <StatusBadge tone="neutral"><Check className="mr-1 size-3" />Ausgewählt</StatusBadge>}
                      </div>
                    </TableCell>
                    <TableCell><StatusBadge tone={q.tone}>{q.label}</StatusBadge></TableCell>
                    <TableCell className="tabular text-muted-foreground">{formatDateTime(c.updated_at)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Aktionen für ${c.name}`}>
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to="/speisekarten/$menuCardId" params={{ menuCardId: c.id }}>
                              <ArrowUpRight className="size-4" /> Öffnen
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => select(c.id)} disabled={isSelected}>
                            <Check className="size-4" /> Als aktuelle Karte auswählen
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDialog({ kind: "edit", card: c })}>Bearbeiten</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDialog({ kind: "toggle", card: c })}>
                            {c.is_active ? "Deaktivieren" : "Aktivieren"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={dishCount > 0 || !counts}
                            className="text-destructive"
                            onClick={() => setDialog({ kind: "delete", card: c })}
                          >
                            Löschen{dishCount > 0 ? " (enthält Gerichte)" : ""}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {(dialog.kind === "create" || dialog.kind === "edit") && (
        <MenuCardConfigDialog
          card={dialog.kind === "edit" ? dialog.card : null}
          userId={user.id}
          open
          onOpenChange={() => setDialog({ kind: "none" })}
          onCreated={(c) => select(c.id)}
        />
      )}

      <AlertDialog open={dialog.kind === "toggle"} onOpenChange={(o) => !o && setDialog({ kind: "none" })}>
        {dialog.kind === "toggle" && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{dialog.card.is_active ? "Speisekarte deaktivieren?" : "Speisekarte aktivieren?"}</AlertDialogTitle>
              <AlertDialogDescription>
                {dialog.card.is_active
                  ? `«${dialog.card.name}» bleibt mit allen Gerichten erhalten, wird aber nicht mehr standardmässig ausgewählt.`
                  : `«${dialog.card.name}» wird wieder als aktive Karte geführt.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={() => toggle.mutate(dialog.card)} disabled={toggle.isPending}>
                {dialog.card.is_active ? "Deaktivieren" : "Aktivieren"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>

      <AlertDialog open={dialog.kind === "delete"} onOpenChange={(o) => !o && setDialog({ kind: "none" })}>
        {dialog.kind === "delete" && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Speisekarte löschen?</AlertDialogTitle>
              <AlertDialogDescription>
                «{dialog.card.name}» enthält keine Gerichte und wird endgültig entfernt. Karten mit Gerichten können nur deaktiviert werden.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={() => remove.mutate(dialog.card)} disabled={remove.isPending}>Löschen</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </>
  );
}
