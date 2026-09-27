import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, BarChart3, BookOpen, Calculator, CalendarDays, ClipboardList, FileUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSelectedMenuCard } from "@/lib/selected-menu-card";

type Step = "intent" | "type" | "alacarte";

const choiceClass = "h-auto min-h-14 justify-start px-5 py-4 text-base font-semibold [&_svg]:size-5";

function BackHeader({ id, title, label, onBack }: { id: string; title: string; label: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <Button type="button" variant="ghost" size="icon" aria-label={label} onClick={onBack}>
        <ArrowLeft />
      </Button>
      <h1 id={id} className="page-title">{title}</h1>
    </div>
  );
}

function CurrentCardLine() {
  const { data: card } = useSelectedMenuCard();
  if (!card) return null;
  return <p className="text-sm text-muted-foreground">Aktuelle Speisekarte: {card.name}</p>;
}

export function StartLauncher() {
  const [step, setStep] = useState<Step>("intent");

  if (step === "alacarte") {
    return (
      <section aria-labelledby="alacarte-heading" className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-8 sm:py-12">
        <div className="flex flex-col gap-2">
          <BackHeader
            id="alacarte-heading"
            title="Wie möchtest du die À-la-carte-Karte erfassen?"
            label="Zurück zur Kalkulationsart"
            onBack={() => setStep("type")}
          />
          <CurrentCardLine />
        </div>
        <div className="grid gap-3">
          <Button asChild variant="outline" className={choiceClass}>
            <Link to="/speisekarten/importieren" search={{ from: "gerichte" }}>
              <FileUp className="icon-brand" />
              Speisekarte importieren
            </Link>
          </Button>
          <Button asChild variant="outline" className={choiceClass}>
            <Link to="/gerichte">
              <Plus className="icon-brand" />
              Gericht manuell erfassen
            </Link>
          </Button>
        </div>
      </section>
    );
  }

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
