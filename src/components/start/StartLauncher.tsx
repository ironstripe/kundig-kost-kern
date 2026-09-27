import { useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BarChart3, BookOpen, Calculator, CalendarDays, ClipboardList, FileUp, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSelectedMenuCard } from "@/lib/selected-menu-card";
import { createDraftMenuCard } from "@/lib/menu-cards";

type Step = "intent" | "type" | "alacarte";
type Method = "import" | "manual";

const choiceClass = "h-auto min-h-14 justify-start px-5 py-4 text-base font-semibold [&_svg]:size-5";

function BackHeader({ id, title, label, onBack, disabled }: { id: string; title: string; label: string; onBack: () => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Button type="button" variant="ghost" size="icon" aria-label={label} onClick={onBack} disabled={disabled}>
        <ArrowLeft />
      </Button>
      <h1 id={id} className="page-title">{title}</h1>
    </div>
  );
}

function AlacarteStep({ onBack }: { onBack: () => void }) {
  const [name, setName] = useState("");
  const [pending, setPending] = useState<Method | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const { select } = useSelectedMenuCard();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const valid = name.trim().length > 0;

  const start = async (method: Method) => {
    if (!valid) {
      setError("Bitte einen Namen eingeben.");
      return;
    }
    if (lock.current) return;
    lock.current = true;
    setPending(method);
    setError(null);
    try {
      const card = await createDraftMenuCard(name);
      await queryClient.invalidateQueries({ queryKey: ["menu_cards"] });
      select(card.id);
      if (method === "import") await navigate({ to: "/speisekarten/importieren", search: { from: "gerichte" } });
      else await navigate({ to: "/gerichte", search: { new: 1 } });
    } catch {
      setError("Das Angebot konnte nicht angelegt werden. Bitte erneut versuchen.");
      lock.current = false;
      setPending(null);
    }
  };

  return (
    <section aria-labelledby="alacarte-heading" className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-8 sm:py-12">
      <BackHeader id="alacarte-heading" title="Neues À-la-carte-Angebot" label="Zurück zur Kalkulationsart" onBack={onBack} disabled={!!pending} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="alacarte-name">Name</Label>
        <Input
          id="alacarte-name"
          required
          autoFocus
          placeholder="z. B. Winterkarte 2026"
          value={name}
          disabled={!!pending}
          aria-invalid={!!error && !valid}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
        />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button type="button" variant="outline" className={choiceClass} disabled={!valid || !!pending} onClick={() => start("import")}>
          {pending === "import" ? <Loader2 className="animate-spin" /> : <FileUp className="icon-brand" />}
          PDF/Bild importieren
        </Button>
        <Button type="button" variant="outline" className={choiceClass} disabled={!valid || !!pending} onClick={() => start("manual")}>
          {pending === "manual" ? <Loader2 className="animate-spin" /> : <Plus className="icon-brand" />}
          Manuell erfassen
        </Button>
      </div>
    </section>
  );
}

export function StartLauncher() {
  const [step, setStep] = useState<Step>("intent");

  if (step === "alacarte") return <AlacarteStep onBack={() => setStep("type")} />;

  if (step === "type") {
    return (
      <section aria-labelledby="calculation-type-heading" className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-8 sm:py-12">
        <BackHeader
          id="calculation-type-heading"
          title="Was möchtest du kalkulieren?"
          label="Zurück zur Startauswahl"
          onBack={() => setStep("intent")}
        />
        <div className="grid gap-3">
          <Button type="button" variant="outline" className={choiceClass} aria-label="À-la-carte kalkulieren" onClick={() => setStep("alacarte")}>
            <BookOpen className="icon-brand" />
            À-la-carte
          </Button>
          <Button asChild variant="outline" className={choiceClass}>
            <Link to="/menues" aria-label="Menü kalkulieren">
              <ClipboardList className="icon-brand" />
              Menü
            </Link>
          </Button>
          <Button asChild variant="outline" className={choiceClass}>
            <Link to="/events" aria-label="Event kalkulieren">
              <CalendarDays className="icon-brand" />
              Event
            </Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Startauswahl" className="mx-auto grid w-full max-w-4xl gap-4 py-8 sm:py-12 lg:grid-cols-2 lg:gap-6 lg:py-16">
      <Button
        type="button"
        variant="outline"
        className="h-auto min-h-40 w-full flex-col gap-4 px-6 py-8 text-lg font-semibold [&_svg]:size-6"
        onClick={() => setStep("type")}
      >
        <span className="icon-brand-surface flex size-11 items-center justify-center rounded-md">
          <Calculator />
        </span>
        Kalkulation starten
      </Button>
      <Button asChild variant="outline" className="h-auto min-h-40 w-full flex-col gap-4 px-6 py-8 text-lg font-semibold [&_svg]:size-6">
        <Link to="/uebersicht" aria-label="Analysieren und Übersicht öffnen">
          <span className="icon-brand-surface flex size-11 items-center justify-center rounded-md">
            <BarChart3 />
          </span>
          Analysieren
        </Link>
      </Button>
    </section>
  );
}
