import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "muted";

const tones: Record<Tone, string> = {
  neutral: "bg-secondary text-secondary-foreground",
  success: "bg-accent text-accent-foreground",
  warning: "bg-warning/20 text-warning-foreground",
  muted: "bg-muted text-muted-foreground",
};

export function StatusBadge({
  children,
  tone = "neutral",
  className,
  title,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
  title?: string | undefined;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
