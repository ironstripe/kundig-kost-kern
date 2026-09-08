import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { bootstrapFirstAdmin, needsInitialSetup } from "@/lib/user-admin.functions";
import { signInWithPassword } from "@/lib/auth";
import { validatePassword, PASSWORD_MIN_LENGTH } from "@/lib/password";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/layout/Logo";

export const Route = createFileRoute("/setup")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ersteinrichtung – KundiCalc" },
      { name: "description", content: "Ersten Administrator für KundiCalc anlegen." },
      { property: "og:title", content: "Ersteinrichtung – KundiCalc" },
      { property: "og:description", content: "Ersten Administrator anlegen." },
    ],
  }),
  beforeLoad: async () => {
    const { needsSetup } = await needsInitialSetup();
    if (!needsSetup) throw redirect({ to: "/auth", replace: true });
  },
  component: SetupPage,
});

function SetupPage() {
  const navigate = useNavigate();
  const bootstrap = useServerFn(bootstrapFirstAdmin);
  const [form, setForm] = useState({ displayName: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const pwErr = validatePassword(form.password, form.confirm);
    if (pwErr) return setError(pwErr);
    setError(null);
    setPending(true);
    try {
      await bootstrap({ data: form });
      const signInErr = await signInWithPassword(form.email, form.password);
      if (signInErr) {
        toast.success("Administrator angelegt. Bitte melden Sie sich an.");
        navigate({ to: "/auth", replace: true });
        return;
      }
      toast.success("Willkommen bei KundiCalc.");
      navigate({ to: "/uebersicht", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Einrichtung fehlgeschlagen.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="surface p-6 sm:p-8">
          <h1 className="text-lg font-semibold">Ersteinrichtung</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Es existiert noch kein Benutzerkonto. Legen Sie das erste Administratorkonto an. Danach
            ist diese Seite nicht mehr erreichbar.
          </p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="displayName">Anzeigename</Label>
              <Input
                id="displayName"
                required
                value={form.displayName}
                onChange={(e) => set("displayName", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-Mail-Adresse</Label>
              <Input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
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
                value={form.confirm}
                onChange={(e) => set("confirm", e.target.value)}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Wird angelegt …" : "Administrator anlegen"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
