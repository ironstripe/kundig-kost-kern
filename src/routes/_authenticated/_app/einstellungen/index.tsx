import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_app/einstellungen/")({
  beforeLoad: () => {
    throw redirect({ to: "/einstellungen/konfiguration", replace: true });
  },
  component: () => null,
});
