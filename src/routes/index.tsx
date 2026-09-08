import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "KundiCalc – Kalkulation Kundelfingerhof" },
      { name: "description", content: "Interne Kalkulationsplattform des Kundelfingerhofs." },
      { property: "og:title", content: "KundiCalc" },
      { property: "og:description", content: "Interne Kalkulationsplattform des Kundelfingerhofs." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/uebersicht", replace: true });
    throw redirect({ to: "/auth", replace: true });
  },
  component: () => null,
});
