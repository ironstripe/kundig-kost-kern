import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Props = {
  userId: string;
  /** Optional id suffix so several fields can coexist on one page. */
  fieldId?: string;
};

/**
 * Read-only display of the authentication user ID that the Kundivent sender
 * uses as `source_actor_id`. No separate integration ID is generated.
 */
export function UserIdField({ userId, fieldId = "kundicalc-id" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [manualHint, setManualHint] = useState(false);

  async function handleCopy() {
    setManualHint(false);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("no clipboard");
      await navigator.clipboard.writeText(userId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
      setManualHint(true);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldId}>KundiCalc-ID</Label>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          id={fieldId}
          readOnly
          value={userId}
          onFocus={(e) => e.currentTarget.select()}
          className="h-9 w-full select-all rounded-md border border-border bg-muted/40 px-3 font-mono text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
          {copied ? <Check className="size-4" /> : <Copy className="icon-brand size-4" />}
          ID kopieren
        </Button>
      </div>
      {copied && (
        <p role="status" className="text-xs text-muted-foreground">
          KundiCalc-ID kopiert
        </p>
      )}
      {manualHint && (
        <p role="alert" className="text-xs text-destructive">
          Zugriff auf die Zwischenablage nicht möglich. Die ID ist markiert – bitte manuell kopieren.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Diese ID beim entsprechenden Benutzer in Kundivent hinterlegen. Nur erforderlich, wenn diese
        Person Events an Kundivent übergibt.
      </p>
    </div>
  );
}
