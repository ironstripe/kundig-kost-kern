import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className="icon-brand-surface flex size-8 items-center justify-center rounded-md text-[11px] font-bold tracking-tight"
      >
        KC
      </span>

      <span className="text-base font-semibold tracking-tight text-foreground">KundiCalc</span>
    </div>
  );
}
