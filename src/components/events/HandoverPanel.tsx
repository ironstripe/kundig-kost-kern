/**
 * Kundivent handover: deliberate, server-validated, never automatic.
 *
 * The panel only offers a transfer when the backend confirms a current
 * execution approval and no unresolved attempt. Success is shown only after a
 * validated acknowledgement from Kundivent.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, ExternalLink, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { formatDateTime } from "@/lib/format";
import { attemptStateLabels, contractMessage, NOT_CONFIGURED } from "@/lib/kundivent-contract";
import {
  discardHandoverAttempt,
  getHandoverContext,
  resolveHandover,
  sendHandover,
  type HandoverContext,
} from "@/lib/kundivent.functions";
import { HandoverDialog } from "@/components/events/HandoverDialog";
import type { Event } from "@/lib/events";

export function HandoverPanel({ event }: { event: Event }) {
  const qc = useQueryClient();
  const fetchContext = useServerFn(getHandoverContext);
  const send = useServerFn(sendHandover);
  const resolve = useServerFn(resolveHandover);
  const discard = useServerFn(discardHandoverAttempt);
  const [dialog, setDialog] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: ctx } = useQuery<HandoverContext>({
    queryKey: ["kundivent_context", event.id],
    queryFn: () => fetchContext({ data: { eventId: event.id } }),
  });

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["kundivent_context", event.id] });
    await qc.invalidateQueries({ queryKey: ["events"] });
  };

  if (!ctx) return null;

  if (!ctx.configured) {
    return (
      <div className="mt-4 rounded-md border px-3 py-2.5 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <Send className="size-3.5" /> {NOT_CONFIGURED}
        </p>
        <p className="mt-1">Alle übrigen Funktionen von KundiCalc bleiben nutzbar.</p>
      </div>
    );
  }

  const attempt = ctx.attempt;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Aktion fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-5 rounded-md border px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Übergabe an Kundivent</h3>
        {attempt && (
          <StatusBadge tone={attempt.state === "succeeded" ? "success" : attempt.state === "failed" ? "warning" : "muted"}>
            {attemptStateLabels[attempt.state]}
          </StatusBadge>
        )}
      </div>

      {attempt?.state === "succeeded" ? (
        <div className="mt-2 space-y-1.5 text-sm">
          <p className="text-muted-foreground">
            An Kundivent übergeben am {formatDateTime(attempt.completed_at)}.
          </p>
          {attempt.target_event_deleted ? (
            <p className="text-warning-foreground">
              Der Eintrag wurde in Kundivent nach der Übergabe gelöscht. Er wird nicht neu erstellt.
            </p>
          ) : attempt.target_url ? (
            <a className="inline-flex items-center gap-1.5 underline" href={attempt.target_url} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3.5" /> In Kundivent öffnen
            </a>
          ) : null}
        </div>
      ) : attempt && ["sending", "unknown"].includes(attempt.state) ? (
        <div className="mt-2 space-y-2 text-sm">
          <p className="text-muted-foreground">
            Das Ergebnis dieser Übermittlung ist offen. Eine Zeitüberschreitung bedeutet nicht, dass in Kundivent
            nichts entstanden ist.
          </p>
          {attempt.error_code && <p className="text-xs text-warning-foreground">{contractMessage(attempt.error_code)}</p>}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => run(() => resolve({ data: { attemptId: attempt.id } }))}>
              Ergebnis in Kundivent abfragen
            </Button>
          </div>
        </div>
      ) : attempt && attempt.state === "ready" ? (
        <div className="mt-2 space-y-2 text-sm">
          <p className="text-muted-foreground">
            Ein Übergabeversuch ist vorbereitet ({attempt.operation === "create" ? "neuer Eintrag" : "bestehenden Eintrag verknüpfen"}).
            Er wird mit unverändertem Inhalt gesendet.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => run(() => send({ data: { attemptId: attempt.id } }))}>
              {attempt.operation === "create" ? "Bestätigt in Kundivent anlegen" : "Verknüpfen und bestätigen"}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => discard({ data: { attemptId: attempt.id } }))}>
              Verwerfen
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-2 space-y-2 text-sm">
          {attempt?.state === "failed" && (
            <>
              <p className="text-warning-foreground text-xs">{contractMessage(attempt.error_code)}</p>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => discard({ data: { attemptId: attempt.id } }))}>
                Fehlversuch verwerfen und neu vorbereiten
              </Button>
            </>
          )}
          {ctx.reason && !ctx.canPrepare && <p className="text-xs text-muted-foreground">{ctx.reason}</p>}
          <Button size="sm" disabled={!ctx.canPrepare || busy} onClick={() => setDialog(true)}>
            <Send className="size-4" /> An Kundivent übergeben
          </Button>
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Kundivent führt den Eintrag danach eigenständig weiter. KundiCalc zeigt Kalkulation, Freigabe und den
        Nachweis der Übergabe – es findet keine laufende Synchronisation statt.
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Ihre KundiCalc-Benutzer-ID:</span>
        <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]" aria-label="KundiCalc-Benutzer-ID">
          {ctx.actorId}
        </code>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2"
          onClick={() => {
            void navigator.clipboard?.writeText(ctx.actorId);
            toast.success("Benutzer-ID kopiert.");
          }}
        >
          <Copy className="size-3.5" /> Kopieren
        </Button>
        <span>Die Zuordnung pflegt die Administration in Kundivent unter Einstellungen → KundiCalc-Übergabe.</span>
      </div>

      {dialog && (
        <HandoverDialog
          event={event}
          ctx={ctx}
          onClose={() => setDialog(false)}
          onPrepared={async () => {
            setDialog(false);
            await refresh();
          }}
        />
      )}
    </div>
  );
}
