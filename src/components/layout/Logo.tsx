import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Logo({ className, compact = false, home = false }: { className?: string; compact?: boolean; home?: boolean }) {
  const content = (
    <>
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
    </>
  );

  const classes = cn(
    "flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    compact && "justify-center gap-0",
    home && "transition-opacity hover:opacity-80",
    className,
  );

  if (home) {
    return (
      <Link to="/start" aria-label="KundiCalc Startseite" className={classes}>
        {content}
      </Link>
    );
  }

  return <div className={classes}>{content}</div>;
}
