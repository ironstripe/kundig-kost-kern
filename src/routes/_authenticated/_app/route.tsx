import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ownProfileQuery } from "@/lib/profiles";
import { AppShell } from "@/components/layout/AppShell";

/**
 * Application shell layout. Requires an active profile; users flagged with
 * must_change_password are sent to the mandatory password screen first.
 */
export const Route = createFileRoute("/_authenticated/_app")({
  beforeLoad: async ({ context }) => {
    const profile = await context.queryClient.ensureQueryData(ownProfileQuery(context.user.id));
    if (!profile) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth", search: { reason: "missing" }, replace: true });
    }
    if (!profile.is_active) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth", search: { reason: "inactive" }, replace: true });
    }
    if (profile.must_change_password) {
      throw redirect({ to: "/passwort-aendern", replace: true });
    }
    return { profile, email: context.user.email ?? "" };
  },
  component: AppLayout,
});

function AppLayout() {
  const { profile, email } = Route.useRouteContext();
  return (
    <AppShell profile={profile} email={email}>
      <Outlet />
    </AppShell>
  );
}
