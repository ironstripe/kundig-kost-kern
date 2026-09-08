import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, LogOut, ShieldCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { signOutCleanly } from "@/lib/auth";
import type { Profile } from "@/lib/profiles";

export function UserMenu({ profile, email }: { profile: Profile; email: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const initials = profile.display_name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleSignOut() {
    await signOutCleanly(queryClient);
    navigate({ to: "/auth", replace: true });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-2" aria-label="Benutzermenü">
          <span className="flex size-7 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
            {initials}
          </span>
          <span className="hidden max-w-40 truncate text-sm font-medium sm:inline">
            {profile.display_name}
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="text-sm font-medium">{profile.display_name}</div>
          <div className="truncate text-xs text-muted-foreground">{email}</div>
          {profile.is_admin && (
            <div className="mt-1.5 inline-flex items-center gap-1 text-xs text-accent-foreground">
              <ShieldCheck className="size-3.5" /> Administrator
            </div>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleSignOut} className="cursor-pointer">
          <LogOut className="size-4" /> Abmelden
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
