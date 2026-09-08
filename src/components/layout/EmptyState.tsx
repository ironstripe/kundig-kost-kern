import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  icon: LucideIcon;
  title: string;
  description: string;
  hint?: string;
  children?: ReactNode;
};

export function EmptyState({ icon: Icon, title, description, hint, children }: Props) {
  return (
    <div className="surface flex flex-col items-center px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Icon className="size-5" strokeWidth={1.75} />
      </div>
      <h2 className="mt-5 text-base font-semibold">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      {hint && <p className="mt-4 text-xs text-muted-foreground">{hint}</p>}
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}
