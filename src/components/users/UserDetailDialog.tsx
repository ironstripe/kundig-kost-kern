import type { ManagedUser } from "@/lib/user-admin.functions";
import { formatDateTime } from "@/lib/format";
import { UserIdField } from "@/components/users/UserIdField";
import { StatusBadge } from "@/components/layout/StatusBadge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = { user: ManagedUser | null; onClose: () => void };

export function UserDetailDialog({ user, onClose }: Props) {
  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {user && (
          <>
            <DialogHeader>
              <DialogTitle>{user.display_name}</DialogTitle>
              <DialogDescription>Benutzerdetails und ID für die Kundivent-Zuordnung.</DialogDescription>
            </DialogHeader>
            <div className="mt-5 space-y-4">
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                <dt className="text-muted-foreground">E-Mail</dt>
                <dd>{user.email}</dd>
                <dt className="text-muted-foreground">Rolle</dt>
                <dd>
                  <StatusBadge tone={user.is_admin ? "success" : "neutral"}>
                    {user.is_admin ? "Admin" : "Benutzer"}
                  </StatusBadge>
                </dd>
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <StatusBadge tone={user.is_active ? "success" : "muted"}>
                    {user.is_active ? "Aktiv" : "Inaktiv"}
                  </StatusBadge>
                </dd>
                <dt className="text-muted-foreground">Letzte Anmeldung</dt>
                <dd className="tabular">{formatDateTime(user.last_sign_in_at)}</dd>
              </dl>
              <UserIdField userId={user.id} fieldId={`kundicalc-id-${user.id}`} />
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={onClose}>
                Schliessen
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
