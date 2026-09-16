import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NAV_ITEMS, type NavChild } from "./nav-items";
import { Logo } from "./Logo";

type Props = {
  isAdmin: boolean;
  onNavigate?: () => void;
  className?: string;
  /** Desktop icon rail: icons only, labels as tooltips, children in a flyout. */
  collapsed?: boolean;
};

export function AppSidebar({ isAdmin, onNavigate, className, collapsed = false }: Props) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.search as { from?: string } });

  // The menu-card import is reachable from Gerichte and from Speisekarten.
  // The ?from marker keeps exactly one section highlighted.
  const onImport = pathname.startsWith("/speisekarten/importieren");
  const importOwner = search.from === "gerichte" ? "/gerichte" : "/speisekarten";
  const isActive = (to: string) => (onImport ? to === importOwner : pathname.startsWith(to));

  const childActiveClass = (child: NavChild, parentTo: string) =>
    pathname.startsWith(child.to) &&
    (!onImport || child.to !== "/speisekarten/importieren" || parentTo === importOwner);

  return (
    <nav
      aria-label="Hauptnavigation"
      className={cn("flex h-full flex-col bg-sidebar text-sidebar-foreground", className)}
    >
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-sidebar-border",
          collapsed ? "justify-center px-0" : "px-5",
        )}
      >
        <Logo compact={collapsed} />
      </div>
      <ul className={cn("flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden py-4", collapsed ? "px-2" : "px-3")}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.to);
          const children = item.children?.filter((c) => !c.adminOnly || isAdmin);

          if (collapsed) {
            return (
              <li key={item.to} className="flex flex-col items-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to={item.to}
                      onClick={onNavigate}
                      activeOptions={{ exact: true }}
                      aria-current={active ? "page" : undefined}
                      aria-label={item.label}
                      className={cn(
                        "flex size-10 items-center justify-center rounded-md transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                      )}
                    >
                      <item.icon className="icon-brand size-5 shrink-0" strokeWidth={2} />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>

                {children && children.length > 0 && (
                  <Popover>
                    <PopoverTrigger
                      aria-label={`Untermenü ${item.label}`}
                      className="mt-0.5 flex h-4 w-10 items-center justify-center rounded text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <ChevronRight className="size-3" />
                    </PopoverTrigger>
                    <PopoverContent side="right" align="start" className="w-64 p-1">
                      <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{item.label}</p>
                      <ul>
                        {children.map((child) => (
                          <li key={`${item.to}${child.to}`}>
                            <Link
                              to={child.to}
                              search={child.search ?? {}}
                              onClick={onNavigate}
                              activeOptions={{ exact: true, includeSearch: true }}
                              aria-current={childActiveClass(child, item.to) ? "page" : undefined}
                              className={cn(
                                "block rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                                childActiveClass(child, item.to) ? "font-medium text-foreground" : "text-muted-foreground",
                              )}
                            >
                              {child.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </PopoverContent>
                  </Popover>
                )}
              </li>
            );
          }

          return (
            <li key={item.to}>
              <Link
                to={item.to}
                onClick={onNavigate}
                activeOptions={{ exact: true }}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <item.icon className="icon-brand size-4 shrink-0" strokeWidth={2} />
                <span className="truncate">{item.label}</span>
              </Link>
              {children && children.length > 0 && active && (
                <ul className="mt-0.5 ml-4 space-y-0.5 border-l border-sidebar-border pl-3">
                  {children.map((child) => {
                    const childActive = childActiveClass(child, item.to);

                    return (
                      <li key={`${item.to}${child.to}`}>
                        <Link
                          to={child.to}
                          search={child.search ?? {}}
                          onClick={onNavigate}
                          activeOptions={{ exact: true, includeSearch: true }}
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
      {!collapsed && (
        <div className="border-t border-sidebar-border px-5 py-3 text-xs text-muted-foreground">
          Prototyp · Kundelfingerhof
        </div>
      )}
    </nav>
  );
}
