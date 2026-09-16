import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", compact && "justify-center gap-0", className)}>
      <span
        aria-hidden
        className="icon-brand-surface flex size-8 shrink-0 items-center justify-center rounded-md text-[11px] font-bold tracking-tight"
      >
        KC
      </span>

      {!compact && (
        <span className="truncate text-base font-semibold tracking-tight text-foreground">KundiCalc</span>
      )}
      {compact && <span className="sr-only">KundiCalc</span>}
    </div>
  );
}
