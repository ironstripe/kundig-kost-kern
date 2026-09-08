import { createFileRoute, useBlocker, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, BookOpen, Info, LogOut, RotateCcw, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { MenuCardSelector } from "@/components/menu-cards/MenuCardSelector";
import { ScenarioSummary } from "@/components/scenario/ScenarioSummary";
import { ScenarioSections } from "@/components/scenario/ScenarioSections";
import { ChangedAssumptions } from "@/components/scenario/ChangedAssumptions";
import { ImpactTable } from "@/components/scenario/ImpactTable";
import { ImpactChart } from "@/components/scenario/ImpactChart";
import { ScenarioDetailDialog } from "@/components/scenario/ScenarioDetailDialog";
import { menuCardDataQuery } from "@/lib/menu-cards";
import { calculateMenuTotals } from "@/lib/menu-totals";
import { useSelectedMenuCard } from "@/lib/selected-menu-card";
import { SCENARIO_LOSS_MESSAGE, useScenario } from "@/lib/scenario";
import { compareLines, describeOverrides, type LinePair } from "@/lib/scenario-compare";
import { formatDate, formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

export const Route = createFileRoute("/_authenticated/_app/szenario")({
  head: () => ({
    meta: [
      { title: "Szenario – KundiCalc" },
      { name: "description", content: "Temporäre Preis-, Mengen- und Einkaufsänderungen durchspielen, ohne die gespeicherte Basis zu verändern." },
      { property: "og:title", content: "Szenario – KundiCalc" },
      { property: "og:description", content: "Temporäres Szenario ohne Speicherung." },
    ],
  }),
  component: ScenarioPage,
});

function ScenarioPage() {
  const navigate = useNavigate();
  const { data: card, isPending: cardsPending, error: cardsError } = useSelectedMenuCard();
  const { data, isPending, error } = useQuery({ ...menuCardDataQuery(card?.id ?? ""), enabled: !!card });
  const scenario = useScenario(card?.id);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [detail, setDetail] = useState<LinePair | null>(null);

  const base = useMemo(() => (data ? calculateMenuTotals(data) : null), [data]);
  const scen = useMemo(() => (data ? calculateMenuTotals(data, scenario.overrides) : null), [data, scenario.overrides]);
  const pairs = useMemo(() => (base && scen ? compareLines(base, scen) : []), [base, scen]);
  const overrideRows = useMemo(() => (data && base ? describeOverrides(data, scenario.overrides, base.sellingDays) : []), [data, base, scenario.overrides]);

  const hasChanges = scenario.count > 0;

  // Navigation guard (in-app navigation + browser refresh/close where supported)
  const blocker = useBlocker({
    shouldBlockFn: ({ next }) => hasChanges && !next.pathname.startsWith("/szenario"),
    enableBeforeUnload: () => hasChanges,
    withResolver: true,
  });

  const leave = () => {
    if (hasChanges) setConfirmLeave(true);
    else navigate({ to: "/uebersicht" });
  };

  const headerBadges = card && base && (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1"><BookOpen className="size-3.5" />{card.name}</span>
      <span>·</span>
      <span>{formatDate(card.valid_from)} – {formatDate(card.valid_to)}</span>
      <span>·</span>
      <span>{formatNumber(base.sellingDays, 0)} Verkaufstage</span>
      <span>·</span>
      <StatusBadge tone={hasChanges ? "neutral" : "muted"}>{scenario.count} temporäre Änderungen</StatusBadge>
    </div>
  );

  return (
    <>
      <PageHeader
        title="Szenario"
        description="Temporäre Simulation auf Basis der gespeicherten Daten. Änderungen in diesem Bereich werden nicht gespeichert."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => (hasChanges ? setConfirmReset(true) : undefined)} disabled={!hasChanges}>
              <RotateCcw className="size-4" /> Alle Änderungen zurücksetzen
            </Button>
            <Button variant="ghost" size="sm" onClick={leave}>
              <LogOut className="size-4" /> Szenario verlassen
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <MenuCardSelector />
        <StatusBadge tone="warning" className="whitespace-nowrap">Temporäres Szenario</StatusBadge>
      </div>

      <div className="mb-4 flex items-start gap-2 rounded-md border border-border bg-secondary/40 px-4 py-2.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <p>
          Änderungen in diesem Bereich werden nicht gespeichert. Sie bleiben nur bis zum Verlassen der Seite oder zum Neuladen des Browsers erhalten; die
          gespeicherte Basis bleibt unverändert. Geschätzte Werte bleiben geschätzt – ein Szenario ersetzt keine Prüfung.
        </p>
      </div>

      {(cardsPending || (card && isPending)) && (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {(cardsError || error) && (
        <div className="surface px-6 py-8 text-center">
          <p className="text-sm text-destructive">Die Daten der Speisekarte konnten nicht geladen werden.</p>
        </div>
      )}

      {!cardsPending && !card && !cardsError && (
        <EmptyState icon={SlidersHorizontal} title="Keine Speisekarte" description="Ohne Speisekarte gibt es keine Basis für ein Szenario." />
      )}

      {card && data && base && scen && (
        <div className="space-y-4">
          {headerBadges}

          <ScenarioSummary
            className="lg:sticky lg:top-0 lg:z-10"
            base={base.overall}
            scen={scen.overall}
            excludedBase={base.excludedLines.length}
            excludedScen={scen.excludedLines.length}
          />

          {base.lines.filter((l) => l.isActive).length === 0 ? (
            <EmptyState icon={SlidersHorizontal} title="Keine aktiven Positionen" description="Diese Speisekarte enthält noch keine aktiven Varianten oder Add-ons." />
          ) : (
            <>
              {scen.excludedLines.length > 0 && (
                <div className="flex items-start gap-2 rounded-md border border-border px-4 py-2.5 text-xs">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning-foreground" />
                  <div>
                    <p className="font-medium">
                      {scen.excludedLines.length} Position(en) sind im Szenario von den Gesamtwerten ausgeschlossen – fehlende Werte werden nie als 0 gerechnet.
                    </p>
                    <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                      {scen.excludedLines.map((l) => (
                        <li key={l.key}>
                          {l.kind === "add_on" ? `${l.name} (Add-on)` : `${l.dishName} – ${l.name}`}: {[...l.exclusionReasons, ...l.result.problems].join("; ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <ScenarioSections data={data} base={base} scen={scen} scenario={scenario} />
              <ChangedAssumptions rows={overrideRows} onReset={scenario.remove} />
              <ImpactChart pairs={pairs} />
              <ImpactTable pairs={pairs} onOpen={setDetail} />
            </>
          )}
        </div>
      )}

      <ScenarioDetailDialog pair={detail} onClose={() => setDetail(null)} />

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alle Änderungen zurücksetzen?</AlertDialogTitle>
            <AlertDialogDescription>
              {scenario.count} temporäre Änderungen werden verworfen und alle Werte auf die gespeicherte Basis zurückgesetzt. Die Basis selbst wurde nie verändert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => scenario.clear()}>Zurücksetzen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmLeave || blocker.status === "blocked"} onOpenChange={(o) => { if (!o) { setConfirmLeave(false); blocker.reset?.(); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Szenario verlassen?</AlertDialogTitle>
            <AlertDialogDescription>{SCENARIO_LOSS_MESSAGE}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Im Szenario bleiben</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                scenario.clear();
                if (blocker.status === "blocked") blocker.proceed();
                else navigate({ to: "/uebersicht" });
                setConfirmLeave(false);
              }}
            >
              Verlassen und Änderungen verwerfen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
