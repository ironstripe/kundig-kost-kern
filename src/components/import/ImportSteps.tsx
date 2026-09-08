import { Check } from "lucide-react";
import { IMPORT_STEPS } from "@/lib/import-schema";
import { cn } from "@/lib/utils";

/** 0-based index of the current step. */
export function ImportSteps({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs" aria-label="Import-Schritte">
      {IMPORT_STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full border text-[10px] font-semibold",
                done && "border-primary bg-primary text-primary-foreground",
                active && "border-primary text-primary",
                !done && !active && "border-border text-muted-foreground",
              )}
              aria-current={active ? "step" : undefined}
            >
              {done ? <Check className="size-3" /> : i + 1}
            </span>
            <span className={cn("font-medium", active ? "text-foreground" : "text-muted-foreground")}>{label}</span>
            {i < IMPORT_STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-border" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
