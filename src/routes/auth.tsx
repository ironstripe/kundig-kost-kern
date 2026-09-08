import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { signInWithPassword } from "@/lib/auth";
import { needsInitialSetup } from "@/lib/user-admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Logo } from "@/components/layout/Logo";

const searchSchema = z.object({
  reason: z.enum(["inactive", "missing"]).optional(),
});

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Anmelden – KundiCalc" },
      { name: "description", content: "Anmeldung zur internen Kalkulationsplattform KundiCalc." },
      { property: "og:title", content: "Anmelden – KundiCalc" },
      { property: "og:description", content: "Anmeldung zur internen Kalkulationsplattform." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/uebersicht", replace: true });
  },
  loader: async () => {
    try {
      return await needsInitialSetup();
    } catch {
      return { needsSetup: false };
    }
  },
  component: AuthPage,
});

const reasonMessages: Record<string, string> = {
  inactive: "Ihr Konto ist deaktiviert. Bitte wenden Sie sich an eine Administratorin oder einen Administrator.",
  missing: "Für dieses Konto existiert kein Benutzerprofil. Bitte wenden Sie sich an die Administration.",
};

function AuthPage() {
  const { reason } = Route.useSearch();
  const { needsSetup } = Route.useLoaderData();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const err = await signInWithPassword(email, password);
    setPending(false);
    if (err) {
      setError(err);
      return;
    }
    navigate({ to: "/uebersicht", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo />
          <p className="text-sm text-muted-foreground">
            Kalkulationsplattform des Kundelfingerhofs
          </p>
        </div>

        <div className="surface p-6 sm:p-8">
          <h1 className="text-lg font-semibold">Anmelden</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Zugang nur für zentral angelegte Benutzerkonten.
          </p>

          {reason && reasonMessages[reason] && (
            <Alert className="mt-5">
              <AlertDescription>{reasonMessages[reason]}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-Mail-Adresse</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Wird angemeldet …" : "Anmelden"}
            </Button>
          </form>
        </div>

        {needsSetup && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Noch kein Konto vorhanden?{" "}
            <Link to="/setup" className="font-medium text-primary underline-offset-4 hover:underline">
              Ersteinrichtung starten
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
