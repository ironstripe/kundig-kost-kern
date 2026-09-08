import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { KeyRound, Plus, UserCheck, UserX, Users } from "lucide-react";
import { toast } from "sonner";
import { listUsers, setUserActive, type ManagedUser } from "@/lib/user-admin.functions";
import { formatDateTime } from "@/lib/format";
import { useAppContext } from "@/lib/app-route";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { CreateUserDialog } from "@/components/users/CreateUserDialog";
import { ResetPasswordDialog } from "@/components/users/ResetPasswordDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/_app/einstellungen/benutzer")({
  head: () => ({
    meta: [
      { title: "Benutzer – KundiCalc" },
      { name: "description", content: "Zentrale Benutzerverwaltung für KundiCalc." },
      { property: "og:title", content: "Benutzer – KundiCalc" },
      { property: "og:description", content: "Zentrale Benutzerverwaltung." },
    ],
  }),
  beforeLoad: ({ context }) => {
    if (!context.profile.is_admin) {
      throw redirect({ to: "/einstellungen/konfiguration", replace: true });
    }
  },
  component: UsersPage,
});

function UsersPage() {
  const { user: me } = useAppContext();
  const queryClient = useQueryClient();
  const fetchUsers = useServerFn(listUsers);
  const toggleActive = useServerFn(setUserActive);

  const { data: users, isPending, error } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => fetchUsers(),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<ManagedUser | null>(null);

  const activeMutation = useMutation({
    mutationFn: (vars: { userId: string; isActive: boolean }) => toggleActive({ data: vars }),
    onSuccess: async (_, vars) => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success(vars.isActive ? "Benutzer aktiviert." : "Benutzer deaktiviert.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Aktion fehlgeschlagen."),
  });

  return (
    <>
      <PageHeader
        title="Benutzer"
        description="Zentrale Benutzerverwaltung. Es gibt keine Selbstregistrierung – Konten werden hier angelegt, aktiviert, deaktiviert oder mit einem neuen temporären Passwort versehen."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> Benutzer anlegen
          </Button>
        }
      />

      {isPending && <Skeleton className="h-64 w-full" />}
      {error && (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Benutzer konnten nicht geladen werden."}
        </p>
      )}

      {users && users.length === 0 && (
        <EmptyState
          icon={Users}
          title="Noch keine Benutzer"
          description="Legen Sie das erste Benutzerkonto an."
        />
      )}

      {users && users.length > 0 && (
        <div className="surface overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>Rolle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Letzte Anmeldung</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const isMe = u.id === me.id;
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.display_name}
                      {isMe && <span className="ml-2 text-xs text-muted-foreground">(Sie)</span>}
                      {u.must_change_password && (
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          Passwortwechsel ausstehend
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <StatusBadge tone={u.is_admin ? "success" : "neutral"}>
                        {u.is_admin ? "Admin" : "Benutzer"}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={u.is_active ? "success" : "muted"}>
                        {u.is_active ? "Aktiv" : "Inaktiv"}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground tabular lg:table-cell">
                      {formatDateTime(u.last_sign_in_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setResetTarget(u)}
                          aria-label={`Passwort von ${u.display_name} zurücksetzen`}
                        >
                          <KeyRound className="size-4" />
                          <span className="hidden xl:inline">Passwort</span>
                        </Button>
                        {u.is_active ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isMe || activeMutation.isPending}
                            title={isMe ? "Das eigene Konto kann nicht deaktiviert werden." : undefined}
                            onClick={() => setDeactivateTarget(u)}
                            aria-label={`${u.display_name} deaktivieren`}
                          >
                            <UserX className="size-4" />
                            <span className="hidden xl:inline">Deaktivieren</span>
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={activeMutation.isPending}
                            onClick={() => activeMutation.mutate({ userId: u.id, isActive: true })}
                            aria-label={`${u.display_name} aktivieren`}
                          >
                            <UserCheck className="size-4" />
                            <span className="hidden xl:inline">Aktivieren</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ResetPasswordDialog user={resetTarget} onClose={() => setResetTarget(null)} />

      <AlertDialog open={!!deactivateTarget} onOpenChange={(o) => !o && setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Benutzer deaktivieren?</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateTarget?.display_name} verliert sofort den Zugriff auf KundiCalc. Das Konto
              bleibt erhalten und kann jederzeit wieder aktiviert werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deactivateTarget) {
                  activeMutation.mutate({ userId: deactivateTarget.id, isActive: false });
                }
                setDeactivateTarget(null);
              }}
            >
              Deaktivieren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
