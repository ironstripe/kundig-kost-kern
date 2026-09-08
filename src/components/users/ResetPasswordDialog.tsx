import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { resetUserPassword, type ManagedUser } from "@/lib/user-admin.functions";
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

type Props = { user: ManagedUser | null; onClose: () => void };

export function ResetPasswordDialog({ user, onClose }: Props) {
  const queryClient = useQueryClient();
  const reset = useServerFn(resetUserPassword);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => reset({ data: { userId: user!.id, temporaryPassword: password } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success(`Temporäres Passwort für ${user?.display_name} gesetzt.`);
      setPassword("");
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Zurücksetzen fehlgeschlagen."),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const pwErr = validatePassword(password);
    if (pwErr) return setError(pwErr);
    mutation.mutate();
  }

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Passwort zurücksetzen</DialogTitle>
            <DialogDescription>
              {user?.display_name} erhält ein neues temporäres Passwort und muss es bei der nächsten
              Anmeldung ändern. Bestehende Sitzungen bleiben bis zum nächsten Login gültig.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 space-y-1.5">
            <Label htmlFor="rp-pw">Neues temporäres Passwort</Label>
            <Input
              id="rp-pw"
              type="text"
              autoComplete="off"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Mindestens {PASSWORD_MIN_LENGTH} Zeichen, Gross- und Kleinbuchstaben sowie eine Ziffer.
            </p>
            {error && (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Wird gesetzt …" : "Passwort zurücksetzen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
