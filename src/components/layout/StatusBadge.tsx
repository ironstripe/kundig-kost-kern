import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "destructive" | "info" | "muted";

const tones: Record<Tone, string> = {
  neutral: "bg-secondary text-secondary-foreground",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning-foreground",
  destructive: "bg-destructive/15 text-destructive",
  info: "bg-info/15 text-info",
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
