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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/start", replace: true });
    throw redirect({ to: "/auth", replace: true });
  },
  component: () => null,
});
