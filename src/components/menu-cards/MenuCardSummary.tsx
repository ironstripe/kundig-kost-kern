import type { ReactNode } from "react";
import type { MenuCard } from "@/lib/menu-cards";
import { formatDate, formatPercent, formatCHF, formatWeekdays } from "@/lib/format";
import { importStatusLabels, smallMaterialModeLabels } from "@/lib/labels";
import { StatusBadge } from "@/components/layout/StatusBadge";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm tabular">{children}</dd>
    </div>
  );
}

export function MenuCardSummary({ card, actions }: { card: MenuCard; actions?: ReactNode }) {
  const smallMaterial =
    card.small_material_mode === "percent"
      ? formatPercent(Number(card.small_material_value))
      : `${formatCHF(Number(card.small_material_value))} pro Portion`;

  return (
    <section className="surface">
      <header className="flex flex-col gap-3 border-b border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold">{card.name}</h2>
          <StatusBadge tone={card.is_active ? "success" : "muted"}>
            {card.is_active ? "Aktiv" : "Inaktiv"}
          </StatusBadge>
          <StatusBadge tone="neutral">{importStatusLabels[card.import_status]}</StatusBadge>
        </div>
        {actions}
      </header>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-5 px-6 py-5 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Gültigkeit">
          {formatDate(card.valid_from)} – {formatDate(card.valid_to)}
        </Field>
        <Field label="Öffnungstage">{formatWeekdays(card.opening_weekdays)}</Field>
        <Field label="MWST-Satz">{formatPercent(Number(card.vat_rate))}</Field>
        <Field label="Kleinmaterial">{smallMaterial}</Field>
        <Field label="Kleinmaterial-Modus">{smallMaterialModeLabels[card.small_material_mode]}</Field>
        <Field label="Zuletzt geändert">{formatDate(card.updated_at)}</Field>
      </dl>
    </section>
  );
}
