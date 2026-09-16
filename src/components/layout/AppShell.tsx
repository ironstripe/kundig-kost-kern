import { useEffect, useRef, useState, type ReactNode } from "react";
import { Menu, PanelLeft } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSidebarPreference } from "@/lib/use-sidebar-preference";
import { cn } from "@/lib/utils";
import { AppSidebar } from "./AppSidebar";
import { UserMenu } from "./UserMenu";
import { Logo } from "./Logo";
import type { Profile } from "@/lib/profiles";

type Props = {
  profile: Profile;
  email: string;
  children: ReactNode;
};

const DESKTOP_NAV_ID = "app-sidebar-desktop";
const MOBILE_NAV_ID = "app-sidebar-mobile";

export function AppShell({ profile, email, children }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { expanded, hydrated, toggle } = useSidebarPreference();
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);

  // Radix returns focus to the trigger on close; this covers programmatic
  // closing after navigation, where the trigger may not be the active element.
  useEffect(() => {
    if (!mobileOpen) return;
    return () => {
      mobileTriggerRef.current?.focus();
    };
  }, [mobileOpen]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-screen overflow-x-hidden bg-background">
        {/* Desktop sidebar – collapses into a narrow icon rail */}
        <aside
          id={DESKTOP_NAV_ID}
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 overflow-hidden border-r border-sidebar-border lg:block",
            hydrated && "transition-[width] duration-200 ease-out motion-reduce:transition-none",
            expanded ? "w-60" : "w-16",
          )}
        >
          <AppSidebar isAdmin={profile.is_admin} collapsed={!expanded} />
        </aside>

        {/* Mobile / tablet navigation drawer */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" id={MOBILE_NAV_ID} className="w-72 p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <AppSidebar isAdmin={profile.is_admin} onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              {/* Mobile trigger */}
              <Button
                ref={mobileTriggerRef}
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Navigation ausklappen"
                aria-expanded={mobileOpen}
                aria-controls={MOBILE_NAV_ID}
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="size-5" />
              </Button>
              {/* Desktop toggle – stays in the content header in both states */}
              <Button
                variant="ghost"
                size="icon"
                className="hidden lg:inline-flex"
                aria-label={expanded ? "Navigation einklappen" : "Navigation ausklappen"}
                aria-expanded={expanded}
                aria-controls={DESKTOP_NAV_ID}
                onClick={toggle}
              >
                <PanelLeft className="size-5 text-foreground" />
              </Button>
              <span aria-hidden className="hidden h-6 w-px bg-border lg:block" />
              <span className="hidden text-sm font-medium text-foreground lg:block">KundiCalc</span>
              <div className="lg:hidden">
                <Logo />
              </div>
            </div>
            <div className="hidden text-sm text-muted-foreground lg:block">Kundelfingerhof</div>
            <UserMenu profile={profile} email={email} />
          </header>
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
