import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { TableCell } from "@/components/ui/table";
import { formatCHF, formatNumber, formatPercentPoints, formatQuantity, parseDecimal } from "@/lib/format";
import { signed } from "@/lib/scenario-compare";
import { cn } from "@/lib/utils";

export type ValueKind = "chf" | "quantity" | "percent" | "count";

export function formatValue(v: number | null, kind: ValueKind, unit?: string): string {
  if (v === null || !Number.isFinite(v)) return "–";
  switch (kind) {
    case "chf":
      return formatCHF(v);
    case "percent":
      return formatPercentPoints(v);
    case "count":
      return formatQuantity(v, unit);
    default:
      return formatQuantity(v, unit);
  }
}

export function formatDiff(base: number | null, scen: number | null, kind: ValueKind, unit?: string): string {
  if (base === null || scen === null || !Number.isFinite(base) || !Number.isFinite(scen)) return "–";
  const d = scen - base;
  switch (kind) {
    case "chf":
      return signed(d, (a) => formatCHF(a));
    case "percent":
      return signed(d, (a) => `${formatNumber(a, 1)} %-Pkt.`);
    default:
      return signed(d, (a) => formatQuantity(a, unit));
  }
}

type Props = {
  baseline: number | null;
  /** Current scenario value (equals baseline when not overridden). */
  value: number | null;
  overridden: boolean;
  onChange: (v: number | null) => void;
  kind: ValueKind;
  unit?: string | undefined;
  label: string;
  min?: number;
  max?: number;
  /** Display factor for the input (e.g. 100 for ratios stored as 0.03). */
  factor?: number;
};

/** Editable scenario value: text input with reset; commits on blur/Enter. */
export function ScenarioField({ baseline, value, overridden, onChange, kind, unit, label, min = 0, max, factor = 1 }: Props) {
  const toText = (v: number | null) => (v === null ? "" : String(Math.round(v * factor * 10000) / 10000));
  const [text, setText] = useState(toText(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(toText(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused]);

  const commit = () => {
    const raw = parseDecimal(text);
    if (!Number.isFinite(raw) || raw < min || (max !== undefined && raw > max)) {
      setText(toText(value));
      return;
    }
    const v = raw / factor;
    if (baseline !== null && Math.abs(v - baseline) < 1e-9) onChange(null);
    else onChange(v);
  };

  return (
    <div className="flex items-center gap-1">
      <Input
        inputMode="decimal"
        aria-label={label}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setText(toText(value));
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={cn("h-8 w-24 bg-background text-right tabular", overridden && "border-primary ring-1 ring-primary/40")}
      />
      {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      {overridden && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label={`${label} zurücksetzen`}
          title="Auf Basis zurücksetzen"
        >
          <RotateCcw className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/** Three table cells: Basis | Szenario (editable) | Differenz. */
export function ScenarioCells(props: Props) {
  const { baseline, value, overridden, kind, unit } = props;
  return (
    <>
      <TableCell className="text-right tabular text-muted-foreground">{formatValue(baseline, kind, unit)}</TableCell>
      <TableCell>
        <ScenarioField {...props} />
      </TableCell>
      <TableCell className={cn("text-right tabular", overridden ? "font-medium" : "text-muted-foreground")}>
        {overridden ? formatDiff(baseline, value, kind, unit) : "–"}
      </TableCell>
    </>
  );
}

/** Read-only comparison cell: «Basis → Szenario» with difference when changed. */
export function CompareCell({ base, scen, kind, unit, className }: { base: number | null; scen: number | null; kind: ValueKind; unit?: string; className?: string }) {
  const isChanged = base !== scen && !(base !== null && scen !== null && Math.abs(base - scen) < 1e-9);
  return (
    <TableCell className={cn("text-right tabular whitespace-nowrap", className)}>
      {isChanged ? (
        <span className="inline-flex flex-col items-end leading-tight">
          <span className="text-xs text-muted-foreground line-through decoration-muted-foreground/60">{formatValue(base, kind, unit)}</span>
          <span className="font-medium">{formatValue(scen, kind, unit)}</span>
          <span className="text-xs text-muted-foreground">{formatDiff(base, scen, kind, unit)}</span>
        </span>
      ) : (
        <span className="text-muted-foreground">{formatValue(base, kind, unit)}</span>
      )}
    </TableCell>
  );
}
