import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ownProfileQuery } from "@/lib/profiles";
import { changeOwnPassword } from "@/lib/user-admin.functions";
import { validatePassword, PASSWORD_MIN_LENGTH } from "@/lib/password";
import { signOutCleanly } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/layout/Logo";

export const Route = createFileRoute("/_authenticated/passwort-aendern")({
  head: () => ({
    meta: [
      { title: "Passwort ändern – KundiCalc" },
      { name: "description", content: "Neues Passwort für KundiCalc festlegen." },
      { property: "og:title", content: "Passwort ändern – KundiCalc" },
      { property: "og:description", content: "Neues Passwort festlegen." },
    ],
  }),
  beforeLoad: async ({ context }) => {
    const profile = await context.queryClient.ensureQueryData(ownProfileQuery(context.user.id));
    if (!profile) throw redirect({ to: "/auth", search: { reason: "missing" }, replace: true });
    if (!profile.is_active) throw redirect({ to: "/auth", search: { reason: "inactive" }, replace: true });
    if (!profile.must_change_password) throw redirect({ to: "/uebersicht", replace: true });
    return { profile };
  },
  component: ChangePasswordPage,
});

function ChangePasswordPage() {
  const { user, profile } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const change = useServerFn(changeOwnPassword);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const pwErr = validatePassword(password, confirm);
    if (pwErr) return setError(pwErr);
    setError(null);
    setPending(true);
    try {
      await change({ data: { newPassword: password, confirm } });
      await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      toast.success("Passwort erfolgreich geändert.");
      navigate({ to: "/uebersicht", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Passwort konnte nicht geändert werden.");
    } finally {
      setPending(false);
    }
  }

  async function handleSignOut() {
    await signOutCleanly(queryClient);
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="surface p-6 sm:p-8">
          <h1 className="text-lg font-semibold">Neues Passwort festlegen</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hallo {profile.display_name}. Sie verwenden ein temporäres Passwort. Bitte legen Sie
            jetzt ein persönliches Passwort fest, bevor Sie fortfahren.
          </p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">Neues Passwort</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Mindestens {PASSWORD_MIN_LENGTH} Zeichen, Gross- und Kleinbuchstaben sowie eine Ziffer.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Passwort wiederholen</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Wird gespeichert …" : "Passwort speichern"}
            </Button>
          </form>
        </div>
        <div className="mt-4 text-center">
          <Button variant="link" size="sm" onClick={handleSignOut}>
            Abmelden
          </Button>
        </div>
      </div>
    </div>
  );
}
