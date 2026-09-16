/**
 * Execution approval and the local preparation of the future Kundivent handover.
 *
 * Approval is an explicit human decision. A good result approves nothing, and
 * no transfer is ever shown as done without a real acknowledgement.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/layout/StatusBadge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCHF, formatDate } from "@/lib/format";
import {
  approveEventExecution,
  basisFingerprintQuery,
  executionApprovalsQuery,
  handoverStateLabels,
} from "@/lib/event-approvals";
import type { EventResult } from "@/lib/event-costing";
import { HandoverPanel } from "@/components/events/HandoverPanel";
import type { Event } from "@/lib/events";

function dateTime(value: string | null): string {
  if (!value) return "–";
  const d = new Date(value);
  return `${formatDate(d.toISOString().slice(0, 10))}, ${d.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}`;
}

export function EventApprovalPanel({ event, result }: { event: Event; result: EventResult }) {
  const qc = useQueryClient();
  const { data: approvals } = useQuery(executionApprovalsQuery(event.id));
  const { data: fingerprint } = useQuery(basisFingerprintQuery(event.id));
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const latest = (approvals ?? [])[0] ?? null;
  const stale = Boolean(latest && fingerprint && latest.basis_fingerprint !== fingerprint);
  const blocked = !result.complete;
  const estimateOnly = result.complete && result.counts.assumption > 0;

  const approve = async () => {
    setSaving(true);
    try {
      await approveEventExecution(event.id, note.trim() || null);
      await qc.invalidateQueries({ queryKey: ["event_execution_approvals", event.id] });
      await qc.invalidateQueries({ queryKey: ["events"] });
      setNote("");
      setOpen(false);
      toast.success("Durchführung freigegeben. Die Entscheidgrundlage wurde festgehalten.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Freigabe fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  const handoverLabel = handoverStateLabels[event.handover_state];

  return (
    <section className="surface px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="section-title">Freigabe und Übergabe</h2>
        <div className="flex flex-wrap items-center gap-2">
          {latest && !stale && <StatusBadge tone="success">Durchführung freigegeben</StatusBadge>}
          {stale && <StatusBadge tone="warning">Erneute Freigabe nötig</StatusBadge>}
          <StatusBadge tone={event.handover_state === "handed_over" ? "success" : "muted"}>{handoverLabel}</StatusBadge>
        </div>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        Die Freigabe der Durchführung ist eine eigene Entscheidung. Ein positives Rechenergebnis gibt nichts
        automatisch frei.
      </p>

      {blocked && (
        <div className="mt-4 rounded-md bg-warning/10 px-3 py-2.5 text-xs text-warning-foreground">
          <p className="flex items-start gap-2 font-medium">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
            Freigabe nicht möglich: Es fehlen Pflichtwerte in der Kalkulation.
          </p>
          {result.openPositions.length > 0 && <p className="mt-1.5">Offen: {result.openPositions.join(" · ")}</p>}
        </div>
      )}

      {!blocked && estimateOnly && (
        <p className="mt-4 rounded-md border px-3 py-2.5 text-xs text-muted-foreground">
          Rechnerisch vollständig, aber auf Annahmen gestützt: {result.counts.assumption} Position(en) sind
          Schätzwerte. Eine Freigabe macht daraus keine bestätigten Werte.
        </p>
      )}

      {stale && (
        <p className="mt-4 rounded-md bg-warning/10 px-3 py-2.5 text-xs text-warning-foreground">
          Die Kalkulation hat sich seit der letzten Freigabe verändert. Die bisherige Freigabe bleibt als Nachweis
          erhalten, für eine Übergabe ist eine erneute Freigabe nötig.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button onClick={() => setOpen(true)} disabled={blocked}>
          <CheckCircle2 className="size-4" /> Durchführung freigeben
        </Button>
      </div>

      <HandoverPanel event={event} />


      {(approvals ?? []).length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs font-medium text-muted-foreground">Freigabenachweise</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {(approvals ?? []).map((a) => (
              <li key={a.id} className="rounded-md border px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="tabular">{dateTime(a.approved_at)}</span>
                  {a.superseded_at ? (
                    <StatusBadge tone="muted">Überholt</StatusBadge>
                  ) : stale ? (
                    <StatusBadge tone="warning">Nicht mehr aktuell</StatusBadge>
                  ) : (
                    <StatusBadge tone="success">Gültig</StatusBadge>
                  )}
                </div>
                {a.note && <p className="mt-1 text-xs text-muted-foreground">{a.note}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Durchführung freigeben</DialogTitle>
            <DialogDescription>{event.name}</DialogDescription>
          </DialogHeader>

          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Netto-Erlös</dt>
              <dd className="tabular">{result.netRevenue === null ? "Offen" : formatCHF(result.netRevenue)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">DB I Event</dt>
              <dd className="tabular">
                {result.contributionMargin1 === null ? "Offen" : formatCHF(result.contributionMargin1)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">DB II Event</dt>
              <dd className="tabular">
                {result.contributionMargin2 === null ? "Offen" : formatCHF(result.contributionMargin2)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Annahmen / bestätigt / offen</dt>
              <dd className="tabular">
                {result.counts.assumption} / {result.counts.confirmed} / {result.counts.open}
              </dd>
            </div>
          </dl>

          <p className="text-xs text-muted-foreground">
            DB I und DB II sind Deckungsbeiträge, kein Gewinn. Schätzwerte bleiben auch nach der Freigabe
            Schätzwerte.
          </p>
          {result.openPositions.length > 0 && (
            <p className="text-xs text-warning-foreground">Offene Pflichtwerte: {result.openPositions.join(" · ")}</p>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="approval-note">Entscheidnotiz (optional)</Label>
            <Textarea id="approval-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={approve} disabled={saving || blocked}>
              Durchführung freigeben
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
