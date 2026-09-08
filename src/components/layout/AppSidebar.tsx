import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";
import { Logo } from "./Logo";

type Props = {
  isAdmin: boolean;
  onNavigate?: () => void;
  className?: string;
};

export function AppSidebar({ isAdmin, onNavigate, className }: Props) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      aria-label="Hauptnavigation"
      className={cn("flex h-full flex-col bg-sidebar text-sidebar-foreground", className)}
    >
      <div className="flex h-16 items-center border-b border-sidebar-border px-5">
        <Logo />
      </div>
      <ul className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.to);
          const children = item.children?.filter((c) => !c.adminOnly || isAdmin);
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <item.icon className="size-4 shrink-0" strokeWidth={1.75} />
                <span>{item.label}</span>
              </Link>
              {children && children.length > 0 && active && (
                <ul className="mt-0.5 ml-4 space-y-0.5 border-l border-sidebar-border pl-3">
                  {children.map((child) => {
                    const childActive = pathname.startsWith(child.to);
                    return (
                      <li key={child.to}>
                        <Link
                          to={child.to}
                          onClick={onNavigate}
                          aria-current={childActive ? "page" : undefined}
                          className={cn(
                            "block rounded-md px-3 py-1.5 text-sm transition-colors",
                            childActive
                              ? "font-medium text-sidebar-accent-foreground"
                              : "text-sidebar-foreground/70 hover:text-sidebar-foreground",
                          )}
                        >
                          {child.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      <div className="border-t border-sidebar-border px-5 py-3 text-xs text-muted-foreground">
        Prototyp · Kundelfingerhof
      </div>
    </nav>
  );
}
