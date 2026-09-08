import { useMemo, useState } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import {
  reviewStateLabels,
  validateReview,
  type ReviewAddOn,
  type ReviewCategory,
  type ReviewDish,
  type ReviewItemState,
  type ReviewState,
  type ReviewVariant,
} from "@/lib/import-schema";
import { formatCHF, parseDecimal } from "@/lib/format";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Props = { value: ReviewState; onChange: (next: ReviewState) => void; disabled?: boolean };

const toneOf: Record<ReviewItemState, "neutral" | "success" | "warning" | "muted"> = {
  extracted: "neutral",
  corrected: "success",
  ambiguous: "warning",
  manual: "muted",
};

function StateBadge({ state, title }: { state: ReviewItemState; title?: string | null }) {
  return <StatusBadge tone={toneOf[state]} title={title ?? undefined}>{reviewStateLabels[state]}</StatusBadge>;
}

const touch = (s: ReviewItemState): ReviewItemState => (s === "manual" ? "manual" : "corrected");
let keyCounter = 0;
const newKey = (p: string) => `${p}m${Date.now().toString(36)}${++keyCounter}`;

function PriceInput({ value, onCommit, disabled, className }: { value: number; onCommit: (n: number) => void; disabled?: boolean; className?: string }) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);
  return (
    <Input
      inputMode="decimal"
      className={cn("h-8 w-24 text-right tabular", className)}
      value={focused ? text : String(value)}
      disabled={disabled}
      onFocus={() => { setText(String(value)); setFocused(true); }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setFocused(false);
        const n = parseDecimal(text);
        if (Number.isFinite(n) && n >= 0 && n !== value) onCommit(Math.round(n * 100) / 100);
      }}
      aria-label="Bruttopreis CHF"
    />
  );
}

/** Step 3 – review and correct the extracted structure. Nothing is written here. */
export function ReviewEditor({ value, onChange, disabled }: Props) {
  const issues = useMemo(() => validateReview(value), [value]);

  const setCat = (ck: string, fn: (c: ReviewCategory) => ReviewCategory) =>
    onChange({ ...value, categories: value.categories.map((c) => (c.key === ck ? fn(c) : c)) });
  const setDish = (ck: string, dk: string, fn: (d: ReviewDish) => ReviewDish) =>
    setCat(ck, (c) => ({ ...c, dishes: c.dishes.map((d) => (d.key === dk ? fn(d) : d)) }));
  const setVariant = (ck: string, dk: string, vk: string, fn: (v: ReviewVariant) => ReviewVariant) =>
    setDish(ck, dk, (d) => ({ ...d, variants: d.variants.map((v) => (v.key === vk ? fn(v) : v)) }));
  const setAddOn = (ck: string, dk: string, ak: string, fn: (a: ReviewAddOn) => ReviewAddOn) =>
    setDish(ck, dk, (d) => ({ ...d, add_ons: d.add_ons.map((a) => (a.key === ak ? fn(a) : a)) }));

  const included = value.categories.filter((c) => !c.excluded).reduce((s, c) => s + c.dishes.filter((d) => !d.excluded && d.action !== "skip").length, 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="review-menu-name">Erkannter Kartenname (nur Information, die Ziel-Speisekarte bleibt unverändert)</Label>
          <Input id="review-menu-name" value={value.menu_name} disabled={disabled} onChange={(e) => onChange({ ...value, menu_name: e.target.value })} />
        </div>
        <p className="text-sm text-muted-foreground">{included} Gericht{included === 1 ? "" : "e"} zur Übernahme ausgewählt</p>
      </div>

      {value.small_portion_rule?.detected && (
        <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          <p className="font-medium">Regel «kleine Portion» erkannt: −{formatCHF(value.small_portion_rule.discount ?? 0)}</p>
          <p className="text-muted-foreground">
            Für Hauptgänge wurde je eine Variante «Klein» vorgeschlagen. Sie ist standardmässig ausgeschlossen und muss pro Gericht bewusst aktiviert werden.
            {value.small_portion_rule.source_text && <> Quelle: «{value.small_portion_rule.source_text}»</>}
          </p>
        </div>
      )}

      {value.warnings.length > 0 && (
        <details className="rounded-md border px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium">{value.warnings.length} Hinweis{value.warnings.length === 1 ? "" : "e"} aus der Analyse</summary>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {value.warnings.map((w, i) => (
              <li key={i}>• {w.message}{w.source_text ? <span className="italic"> («{w.source_text}»)</span> : null}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="space-y-4">
        {value.categories.map((c) => (
          <section key={c.key} className={cn("surface p-4", c.excluded && "opacity-60")}>
            <div className="flex flex-wrap items-center gap-2">
              <Checkbox id={`c-${c.key}`} checked={!c.excluded} disabled={disabled} onCheckedChange={(v) => setCat(c.key, (x) => ({ ...x, excluded: !v }))} aria-label="Kategorie übernehmen" />
              <Input
                className="h-8 w-56 font-semibold"
                value={c.name}
                disabled={disabled || c.excluded}
                onChange={(e) => setCat(c.key, (x) => ({ ...x, name: e.target.value, state: touch(x.state) }))}
                aria-label="Kategoriename"
              />
              <StateBadge state={c.state} />
              {c.existing_category_id && <StatusBadge tone="muted" title="Wird der bestehenden Kategorie zugeordnet">Bestehende Kategorie</StatusBadge>}
              <span className="ml-auto text-xs text-muted-foreground">{c.dishes.length} Gericht{c.dishes.length === 1 ? "" : "e"}</span>
            </div>

            <div className="mt-3 space-y-3">
              {c.dishes.map((d) => {
                const off = disabled || c.excluded || d.excluded || d.action === "skip";
                return (
                  <div key={d.key} className={cn("rounded-md border bg-background p-3", (d.excluded || d.action === "skip") && "opacity-60")}>
                    <div className="flex flex-wrap items-start gap-2">
                      <Checkbox className="mt-2" checked={!d.excluded} disabled={disabled || c.excluded} onCheckedChange={(v) => setDish(c.key, d.key, (x) => ({ ...x, excluded: !v }))} aria-label="Gericht übernehmen" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Input className="h-8 w-72 font-medium" value={d.name} disabled={off} aria-label="Gerichtname"
                            onChange={(e) => setDish(c.key, d.key, (x) => ({ ...x, name: e.target.value, state: touch(x.state) }))} />
                          <StateBadge state={d.state} />
                          {d.duplicate_of && (
                            <StatusBadge tone="warning" title={`Bestehend: ${d.duplicate_of.name}${d.duplicate_of.category ? ` (${d.duplicate_of.category})` : ""} · ${d.duplicate_of.prices.map(formatCHF).join(" / ")}`}>
                              <AlertTriangle className="mr-1 size-3" /> Mögliches Duplikat: {d.duplicate_of.reason}
                            </StatusBadge>
                          )}
                          {d.duplicate_of && (
                            <Select value={d.action} disabled={disabled || c.excluded || d.excluded}
                              onValueChange={(v) => setDish(c.key, d.key, (x) => ({ ...x, action: v as ReviewDish["action"], existing_dish_id: v === "update" ? (x.duplicate_of?.id ?? null) : null }))}>
                              <SelectTrigger className="h-8 w-56" aria-label="Umgang mit Duplikat"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="skip">Überspringen (bestehendes behalten)</SelectItem>
                                <SelectItem value="update">Bestehendes Gericht aktualisieren</SelectItem>
                                <SelectItem value="create">Trotzdem neu anlegen</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                        <Textarea rows={1} className="min-h-8 text-sm" placeholder="Beschreibung (optional)" value={d.description ?? ""} disabled={off} aria-label="Beschreibung"
                          onChange={(e) => setDish(c.key, d.key, (x) => ({ ...x, description: e.target.value || null, state: touch(x.state) }))} />

                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">Varianten (verkaufbare Positionen)</p>
                          {d.variants.map((v) => (
                            <div key={v.key} className={cn("flex flex-wrap items-center gap-2", v.excluded && "opacity-60")}>
                              <Checkbox checked={!v.excluded} disabled={off} aria-label="Variante übernehmen"
                                onCheckedChange={(on) => setVariant(c.key, d.key, v.key, (x) => ({ ...x, excluded: !on, state: x.proposed && on ? "corrected" : x.state }))} />
                              <Input className="h-8 w-48" value={v.name} disabled={off || v.excluded} aria-label="Variantenname"
                                onChange={(e) => setVariant(c.key, d.key, v.key, (x) => ({ ...x, name: e.target.value, state: touch(x.state) }))} />
                              <PriceInput value={v.gross_price} disabled={off || v.excluded}
                                onCommit={(n) => setVariant(c.key, d.key, v.key, (x) => ({ ...x, gross_price: n, state: touch(x.state) }))} />
                              <span className="text-xs text-muted-foreground">CHF brutto</span>
                              <label className="flex items-center gap-1 text-xs">
                                <input type="radio" name={`def-${d.key}`} checked={v.is_default} disabled={off || v.excluded}
                                  onChange={() => setDish(c.key, d.key, (x) => ({ ...x, variants: x.variants.map((y) => ({ ...y, is_default: y.key === v.key })) }))} />
                                Standard
                              </label>
                              <StateBadge state={v.state} title={v.source_text} />
                              {v.proposed && <StatusBadge tone="muted" title="Aus der Regel «kleine Portion» abgeleitet – kein Preis im Dokument">Vorschlag</StatusBadge>}
                              <Button variant="ghost" size="icon" className="size-7" disabled={off} aria-label="Variante entfernen"
                                onClick={() => setDish(c.key, d.key, (x) => ({ ...x, variants: x.variants.filter((y) => y.key !== v.key) }))}>
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          ))}
                          <Button variant="ghost" size="sm" disabled={off} onClick={() =>
                            setDish(c.key, d.key, (x) => ({ ...x, variants: [...x.variants, { key: newKey("v"), name: "", gross_price: 0, is_default: x.variants.length === 0, source_text: null, excluded: false, state: "manual", proposed: false }] }))}>
                            <Plus className="size-3.5" /> Variante ergänzen
                          </Button>
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">Add-ons (Aufpreis-Positionen)</p>
                          {d.add_ons.map((a) => (
                            <div key={a.key} className={cn("flex flex-wrap items-center gap-2", a.excluded && "opacity-60")}>
                              <Checkbox checked={!a.excluded} disabled={off} aria-label="Add-on übernehmen"
                                onCheckedChange={(on) => setAddOn(c.key, d.key, a.key, (x) => ({ ...x, excluded: !on }))} />
                              <Input className="h-8 w-56" value={a.name} disabled={off || a.excluded} aria-label="Add-on-Name"
                                onChange={(e) => setAddOn(c.key, d.key, a.key, (x) => ({ ...x, name: e.target.value, state: touch(x.state) }))} />
                              <span className="text-xs text-muted-foreground">+</span>
                              <PriceInput value={a.gross_price} disabled={off || a.excluded}
                                onCommit={(n) => setAddOn(c.key, d.key, a.key, (x) => ({ ...x, gross_price: n, state: touch(x.state) }))} />
                              <span className="text-xs text-muted-foreground">CHF</span>
                              <StateBadge state={a.state} title={a.source_text} />
                              <Button variant="ghost" size="icon" className="size-7" disabled={off} aria-label="Add-on entfernen"
                                onClick={() => setDish(c.key, d.key, (x) => ({ ...x, add_ons: x.add_ons.filter((y) => y.key !== a.key) }))}>
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          ))}
                          <Button variant="ghost" size="sm" disabled={off} onClick={() =>
                            setDish(c.key, d.key, (x) => ({ ...x, add_ons: [...x.add_ons, { key: newKey("a"), name: "", gross_price: 0, source_text: null, excluded: false, state: "manual" }] }))}>
                            <Plus className="size-3.5" /> Add-on ergänzen
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <Button variant="outline" size="sm" disabled={disabled || c.excluded} onClick={() =>
                setCat(c.key, (x) => ({ ...x, dishes: [...x.dishes, { key: newKey("d"), name: "", description: null, excluded: false, state: "manual", action: "create", existing_dish_id: null, duplicate_of: null, variants: [{ key: newKey("v"), name: "Normal", gross_price: 0, is_default: true, source_text: null, excluded: false, state: "manual", proposed: false }], add_ons: [] }] }))}>
                <Plus className="size-3.5" /> Gericht manuell ergänzen
              </Button>
            </div>
          </section>
        ))}
        <Button variant="outline" disabled={disabled} onClick={() =>
          onChange({ ...value, categories: [...value.categories, { key: newKey("c"), name: "", excluded: false, state: "manual", existing_category_id: null, dishes: [] }] })}>
          <Plus className="size-4" /> Kategorie ergänzen
        </Button>
      </div>

      {issues.length > 0 && (
        <div className="rounded-md border px-3 py-2 text-sm">
          <p className="font-medium">Prüfergebnis</p>
          <ul className="mt-1 space-y-0.5">
            {issues.map((i, n) => (
              <li key={n} className={i.level === "error" ? "text-destructive" : "text-muted-foreground"}>
                {i.level === "error" ? "Fehler" : "Hinweis"} · {i.path}: {i.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
