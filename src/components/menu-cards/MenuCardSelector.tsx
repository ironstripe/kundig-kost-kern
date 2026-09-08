import { BookOpen } from "lucide-react";
import { useSelectedMenuCard } from "@/lib/selected-menu-card";
import { formatDate } from "@/lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/layout/StatusBadge";

/** Consistent menu-card selection used by Übersicht, Gerichte, Verkaufsmengen and Szenario. */
export function MenuCardSelector({ className }: { className?: string }) {
  const { data: card, cards, select } = useSelectedMenuCard();
  if (cards.length === 0) return null;
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <BookOpen className="size-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Speisekarte</span>
        <Select value={card?.id ?? ""} onValueChange={(v) => select(v)}>
          <SelectTrigger className="h-8 w-64 bg-background" aria-label="Speisekarte wählen">
            <SelectValue placeholder="Speisekarte wählen" />
          </SelectTrigger>
          <SelectContent>
            {cards.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} · {formatDate(c.valid_from)}–{formatDate(c.valid_to)}
                {!c.is_active ? " (inaktiv)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {card && !card.is_active && <StatusBadge tone="muted">Inaktive Karte</StatusBadge>}
      </div>
    </div>
  );
}
