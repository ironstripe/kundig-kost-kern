import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export async function signInWithPassword(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) {
    if (error.message.toLowerCase().includes("invalid login")) {
      return "E-Mail-Adresse oder Passwort ist falsch.";
    }
    return "Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut.";
  }
  return null;
}

/** Ordered sign-out: stop queries, clear cache, end session. Caller navigates. */
export async function signOutCleanly(queryClient: QueryClient) {
  await queryClient.cancelQueries();
  queryClient.clear();
  await supabase.auth.signOut();
}
