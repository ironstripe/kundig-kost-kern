import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { createUser } from "@/lib/user-admin.functions";
import { validatePassword, PASSWORD_MIN_LENGTH } from "@/lib/password";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

const initial = { displayName: "", email: "", temporaryPassword: "", isAdmin: false, isActive: true };

export function CreateUserDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const create = useServerFn(createUser);
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => create({ data: form }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success(`Benutzer «${form.displayName}» angelegt.`);
      setForm(initial);
      onOpenChange(false);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Anlegen fehlgeschlagen."),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const pwErr = validatePassword(form.temporaryPassword);
    if (pwErr) return setError(pwErr);
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Benutzer anlegen</DialogTitle>
            <DialogDescription>
              Die Person erhält ein temporäres Passwort und muss es bei der ersten Anmeldung ändern.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cu-name">Anzeigename</Label>
              <Input
                id="cu-name"
                required
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cu-email">E-Mail-Adresse</Label>
              <Input
                id="cu-email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cu-pw">Temporäres Passwort</Label>
              <Input
                id="cu-pw"
                type="text"
                autoComplete="off"
                required
                value={form.temporaryPassword}
                onChange={(e) => setForm({ ...form, temporaryPassword: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Mindestens {PASSWORD_MIN_LENGTH} Zeichen, Gross- und Kleinbuchstaben sowie eine Ziffer. Bitte der Person sicher übermitteln.
              </p>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
              <div>
                <Label htmlFor="cu-admin">Administrator</Label>
                <p className="text-xs text-muted-foreground">Darf Benutzer verwalten.</p>
              </div>
              <Switch
                id="cu-admin"
                checked={form.isAdmin}
                onCheckedChange={(v) => setForm({ ...form, isAdmin: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
              <div>
                <Label htmlFor="cu-active">Aktiv</Label>
                <p className="text-xs text-muted-foreground">Inaktive Konten haben keinen Zugriff.</p>
              </div>
              <Switch
                id="cu-active"
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Wird angelegt …" : "Benutzer anlegen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
