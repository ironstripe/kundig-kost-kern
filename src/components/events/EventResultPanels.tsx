import { AlertTriangle } from "lucide-react";
import { MetricValue } from "@/components/dishes/Metric";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { formatCHF } from "@/lib/format";
import { INCOMPLETE_NOTICE, type EventResult } from "@/lib/event-costing";

export function EventCompletenessPanel({ result }: { result: EventResult }) {
  const tone = result.completeness === "Vollständig" ? "success" : "warning";
  return (
    <section className="surface px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="section-title">Kalkulationsstand</h2>
        <StatusBadge tone={tone}>{result.completeness}</StatusBadge>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
        <div>
          <dt className="text-xs text-muted-foreground">Bestätigt</dt>
          <dd className="tabular">{result.counts.confirmed}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Annahme</dt>
          <dd className="tabular">{result.counts.assumption}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Effektiv</dt>
          <dd className="tabular">{result.counts.effective}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Offene Pflichtwerte</dt>
          <dd className="tabular">{result.counts.open}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Informativ (ausgeschlossen)</dt>
          <dd className="tabular">{result.counts.informational}</dd>
        </div>
      </dl>
      {result.openPositions.length > 0 && (
        <div className="mt-4 rounded-md bg-warning/10 px-3 py-2.5 text-xs text-warning-foreground">
          <p className="flex items-start gap-2 font-medium">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
            {INCOMPLETE_NOTICE}
          </p>
          <p className="mt-1.5">Offen: {result.openPositions.join(" · ")}</p>
        </div>
      )}
    </section>
  );
}

export function EventResultPanel({ result }: { result: EventResult }) {
  const rows: { label: string; value: number | null; kind: "chf" | "percent" }[] = [
    { label: "Brutto-Erlös", value: result.grossRevenue, kind: "chf" },
    { label: "Netto-Erlös", value: result.netRevenue, kind: "chf" },
    { label: "Variable Kosten", value: result.variableCosts, kind: "chf" },
    { label: "DB I Event", value: result.contributionMargin1, kind: "chf" },
    { label: "DB I pro zahlendem Gast", value: result.contributionMargin1PerPayingGuest, kind: "chf" },
    { label: "Direktes Personal", value: result.personnelCosts, kind: "chf" },
    { label: "Direkte Fixkosten", value: result.fixedCosts, kind: "chf" },
    { label: "DB II Event", value: result.contributionMargin2, kind: "chf" },
    { label: "DB II pro zahlendem Gast", value: result.contributionMargin2PerPayingGuest, kind: "chf" },
    { label: "DB-II-Marge", value: result.contributionMargin2Ratio, kind: "percent" },
  ];

  return (
    <section className="surface px-5 py-4">
      <h2 className="section-title">Ergebnis</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        DB I = Netto-Eventerlös minus direkte variable Kosten. DB II = DB I minus direktes Personal und direkte
        Fixkosten. Beides ist kein Gewinn.
      </p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3 border-b pb-1.5 last:border-b-0">
            <dt className="text-sm text-muted-foreground">{r.label}</dt>
            <dd>
              <MetricValue value={r.value} kind={r.kind} problems={result.openPositions} />
            </dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 border-b pb-1.5 last:border-b-0">
          <dt className="text-sm text-muted-foreground">Break-even zahlende Gäste</dt>
          <dd className="tabular">{result.breakEvenPayingGuests ?? <span className="text-xs text-muted-foreground italic">Unvollständig</span>}</dd>
        </div>
      </dl>

      {!result.complete && (
        <div className="mt-4 rounded-md border px-3 py-2.5 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-muted-foreground">Bekannter Zwischensaldo vor offenen Eventkosten</span>
            <span className="tabular font-medium">{formatCHF(result.knownIntermediateBalance)}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Dieser Wert ist weder DB I noch DB II und kein Gewinn – er enthält nur die bereits bekannten Positionen.
          </p>
        </div>
      )}
    </section>
  );
}
