import { useNavigate } from "@tanstack/react-router";
import { BookOpen, ClipboardList } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called instead of navigating when the user picks «Menü». */
  onChooseMenu?: () => void;
};

/**
 * Kalkulationsart wählen. Die Auswahl erfolgt zu Beginn, nicht erst am Ende.
 */
export function NewCalculationDialog({ open, onOpenChange, onChooseMenu }: Props) {
  const navigate = useNavigate();

  const choose = (kind: "card" | "menu") => {
    onOpenChange(false);
    if (kind === "card") {
      void navigate({ to: "/speisekarten" });
    } else if (onChooseMenu) {
      onChooseMenu();
    } else {
      void navigate({ to: "/menues" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Neue Kalkulation</DialogTitle>
          <DialogDescription>
            Wählen Sie zuerst die Kalkulationsart. Beide Arten nutzen dieselben Gerichte, Zutaten und Formeln.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => choose("card")}
            className="surface flex flex-col items-start gap-2 px-4 py-4 text-left transition-colors hover:bg-accent/40"
          >
            <BookOpen className="size-5 text-muted-foreground" strokeWidth={1.75} />
            <span className="text-sm font-semibold">À-la-carte-Speisekarte</span>
            <span className="text-xs text-muted-foreground">
              Bestehender Ablauf: Karte, Kategorien, Gerichte und Varianten mit Verkaufsmengen.
            </span>
          </button>
          <button
            type="button"
            onClick={() => choose("menu")}
            className="surface flex flex-col items-start gap-2 px-4 py-4 text-left transition-colors hover:bg-accent/40"
          >
            <ClipboardList className="size-5 text-muted-foreground" strokeWidth={1.75} />
            <span className="text-sm font-semibold">Menü</span>
            <span className="text-xs text-muted-foreground">
              Wiederverwendbares Mehrgang-Menü aus bestehenden Gericht-Varianten, optional mit Event.
            </span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
