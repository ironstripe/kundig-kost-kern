import { formatCHF, formatPercentPoints } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Renders a CHF or percentage value, or «Unvollständig» with the reasons. */
export function MetricValue({
  value,
  kind,
  problems,
  className,
}: {
  value: number | null;
  kind: "chf" | "percent";
  problems?: string[];
  className?: string;
}) {
  if (value === null || !Number.isFinite(value)) {
    const text = <span className={cn("text-xs text-muted-foreground italic", className)}>Unvollständig</span>;
    if (!problems || problems.length === 0) return text;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help underline decoration-dotted underline-offset-2">{text}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <ul className="list-disc pl-4 text-xs">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    );
  }
  return <span className={cn("tabular", className)}>{kind === "chf" ? formatCHF(value) : formatPercentPoints(value)}</span>;
}

/** Signed difference (CHF or percentage points). */
export function DeltaValue({ value, kind }: { value: number | null; kind: "chf" | "percent" }) {
  if (value === null || !Number.isFinite(value)) return <span className="text-muted-foreground">–</span>;
  const sign = value > 0 ? "+" : value < 0 ? "−" : "±";
  const abs = Math.abs(value);
  return (
    <span className="tabular text-muted-foreground">
      {sign} {kind === "chf" ? formatCHF(abs) : `${formatPercentPoints(abs).replace(" %", "")} %-Pkt.`}
    </span>
  );
}
