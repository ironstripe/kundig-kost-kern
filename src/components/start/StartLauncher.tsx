import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, BarChart3, BookOpen, Calculator, CalendarDays, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StartLauncher() {
  const [choosingCalculation, setChoosingCalculation] = useState(false);

  if (choosingCalculation) {
    return (
      <section aria-labelledby="calculation-type-heading" className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-8 sm:py-12">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Zurück zur Startauswahl"
            onClick={() => setChoosingCalculation(false)}
          >
            <ArrowLeft />
          </Button>
          <h1 id="calculation-type-heading" className="page-title">Was möchtest du kalkulieren?</h1>
        </div>

        <div className="grid gap-3">
          <Button asChild variant="outline" className="h-auto min-h-14 justify-start px-5 py-4 text-base font-semibold [&_svg]:size-5">
            <Link to="/speisekarten" aria-label="À-la-carte kalkulieren">
              <BookOpen className="icon-brand" />
              À-la-carte
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto min-h-14 justify-start px-5 py-4 text-base font-semibold [&_svg]:size-5">
            <Link to="/menues" aria-label="Menü kalkulieren">
              <ClipboardList className="icon-brand" />
              Menü
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto min-h-14 justify-start px-5 py-4 text-base font-semibold [&_svg]:size-5">
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
        onClick={() => setChoosingCalculation(true)}
      >
        <span className="icon-brand-surface flex size-11 items-center justify-center rounded-md">
          <Calculator />
        </span>
        Kalkulation starten
      </Button>
      <Button
        asChild
        variant="outline"
        className="h-auto min-h-40 w-full flex-col gap-4 px-6 py-8 text-lg font-semibold [&_svg]:size-6"
      >
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