import { createFileRoute } from "@tanstack/react-router";
import { StartLauncher } from "@/components/start/StartLauncher";

export const Route = createFileRoute("/_authenticated/_app/start")({
  head: () => ({
    meta: [
      { title: "Start – KundiCalc" },
      { name: "description", content: "Aufgabenorientierter Einstieg in Kalkulation und Analyse." },
      { property: "og:title", content: "Start – KundiCalc" },
      { property: "og:description", content: "Kalkulation starten oder bestehende Ergebnisse analysieren." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StartPage,
});

function StartPage() {
  return <StartLauncher />;
}