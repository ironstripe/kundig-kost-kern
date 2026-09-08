import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { linkAddOn, type AddOn, type AddOnLink } from "@/lib/add-ons";
import { formatCHF } from "@/lib/format";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

type Props = {
  dishId: string;
  addOns: AddOn[];
  links: AddOnLink[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateNew: () => void;
};

/** Assign existing add-ons to a dish (or jump to creating a new one). */
export function AssignAddOnDialog({ dishId, addOns, links, open, onOpenChange, onCreateNew }: Props) {
  const queryClient = useQueryClient();
  const assigned = new Set(links.filter((l) => l.dish_id === dishId).map((l) => l.add_on_id));
  const available = addOns.filter((a) => !assigned.has(a.id)).sort((a, b) => a.name.localeCompare(b.name, "de-CH"));
  const [selected, setSelected] = useState<string[]>([]);

  const mutation = useMutation({
    mutationFn: async () => {
      for (const id of selected) await linkAddOn(dishId, id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["add_on_links"] });
      toast.success(selected.length === 1 ? "Add-on zugeordnet." : `${selected.length} Add-ons zugeordnet.`);
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Zuordnung fehlgeschlagen."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add-on zuordnen</DialogTitle>
          <DialogDescription>Bestehende Add-ons diesem Gericht zuordnen. Jedes Add-on kann mehreren Gerichten zugeordnet sein.</DialogDescription>
        </DialogHeader>
        <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
          {available.length === 0 && <p className="px-1 py-2 text-sm text-muted-foreground">Keine weiteren Add-ons verfügbar.</p>}
          {available.map((a) => (
            <label key={a.id} className="flex items-center justify-between gap-2 rounded px-1 py-1 text-sm hover:bg-muted/40">
              <span className="flex items-center gap-2">
                <Checkbox
                  checked={selected.includes(a.id)}
                  onCheckedChange={(c) => setSelected((prev) => (c === true ? [...prev, a.id] : prev.filter((x) => x !== a.id)))}
                />
                {a.name}
                {!a.is_active && <span className="text-xs text-muted-foreground">(inaktiv)</span>}
              </span>
              <span className="tabular text-muted-foreground">{formatCHF(Number(a.gross_price))}</span>
            </label>
          ))}
        </div>
        <DialogFooter className="mt-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={onCreateNew}>
            <Plus className="size-4" /> Neues Add-on
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button type="button" disabled={selected.length === 0 || mutation.isPending} onClick={() => mutation.mutate()}>
              Zuordnen
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
