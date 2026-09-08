import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validatePassword } from "@/lib/password";

/**
 * Privileged user-management operations. All Auth admin calls run here on the
 * server with the service role; the browser never sees that key. Every admin
 * operation first verifies the caller's admin flag through the caller's own
 * RLS-scoped client.
 */

export type ManagedUser = {
  id: string;
  email: string;
  display_name: string;
  is_admin: boolean;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
  last_sign_in_at: string | null;
};

async function assertAdmin(ctx: {
  supabase: { from: (t: "profiles") => any };
  userId: string;
}) {
  const { data, error } = await ctx.supabase
    .from("profiles")
    .select("is_admin, is_active")
    .eq("id", ctx.userId)
    .maybeSingle();
  if (error || !data || !data.is_active || !data.is_admin) {
    throw new Error("Keine Berechtigung: Diese Aktion ist Administratoren vorbehalten.");
  }
}

async function assertActive(ctx: {
  supabase: { from: (t: "profiles") => any };
  userId: string;
}) {
  const { data, error } = await ctx.supabase
    .from("profiles")
    .select("is_active")
    .eq("id", ctx.userId)
    .maybeSingle();
  if (error || !data || !data.is_active) {
    throw new Error("Ihr Konto ist deaktiviert.");
  }
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ManagedUser[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profiles, error: pErr }, { data: authList, error: aErr }] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").order("display_name"),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
    if (pErr) throw new Error("Profile konnten nicht geladen werden.");
    if (aErr) throw new Error("Benutzerkonten konnten nicht geladen werden.");
    const byId = new Map(authList.users.map((u) => [u.id, u]));
    return (profiles ?? []).map((p) => {
      const u = byId.get(p.id);
      return {
        id: p.id,
        email: u?.email ?? "–",
        display_name: p.display_name,
        is_admin: p.is_admin,
        is_active: p.is_active,
        must_change_password: p.must_change_password,
        created_at: p.created_at,
        last_sign_in_at: u?.last_sign_in_at ?? null,
      };
    });
  });

const createUserSchema = z.object({
  displayName: z.string().trim().min(2, "Anzeigename ist zu kurz.").max(80),
  email: z.string().trim().email("Ungültige E-Mail-Adresse."),
  temporaryPassword: z.string(),
  isAdmin: z.boolean(),
  isActive: z.boolean(),
});

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createUserSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const pwError = validatePassword(data.temporaryPassword);
    if (pwError) throw new Error(pwError);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email.toLowerCase(),
      password: data.temporaryPassword,
      email_confirm: true,
      user_metadata: { display_name: data.displayName },
    });
    if (error || !created.user) {
      throw new Error(
        error?.message?.includes("already")
          ? "Für diese E-Mail-Adresse existiert bereits ein Konto."
          : "Benutzer konnte nicht erstellt werden.",
      );
    }
    const { error: pErr } = await supabaseAdmin.from("profiles").insert({
      id: created.user.id,
      display_name: data.displayName,
      is_admin: data.isAdmin,
      is_active: data.isActive,
      must_change_password: true,
    });
    if (pErr) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error("Profil konnte nicht angelegt werden.");
    }
    return { id: created.user.id };
  });

const setActiveSchema = z.object({ userId: z.string().uuid(), isActive: z.boolean() });

export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => setActiveSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId && !data.isActive) {
      throw new Error("Sie können Ihr eigenes Konto nicht deaktivieren.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_active: data.isActive })
      .eq("id", data.userId);
    if (error) throw new Error("Status konnte nicht geändert werden.");
    if (!data.isActive) {
      // Invalidate existing sessions so the deactivated user is signed out.
      await supabaseAdmin.auth.admin.signOut(data.userId, "global").catch(() => undefined);
    }
    return { ok: true };
  });

const resetSchema = z.object({ userId: z.string().uuid(), temporaryPassword: z.string() });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => resetSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const pwError = validatePassword(data.temporaryPassword);
    if (pwError) throw new Error(pwError);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.temporaryPassword,
    });
    if (error) throw new Error("Passwort konnte nicht zurückgesetzt werden.");
    const { error: pErr } = await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", data.userId);
    if (pErr) throw new Error("Passwort-Pflicht konnte nicht gesetzt werden.");
    return { ok: true };
  });

const changeOwnSchema = z.object({ newPassword: z.string(), confirm: z.string() });

/** Mandatory first-login password change for the signed-in user. */
export const changeOwnPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => changeOwnSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertActive(context);
    const pwError = validatePassword(data.newPassword, data.confirm);
    if (pwError) throw new Error(pwError);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      password: data.newPassword,
    });
    if (error) throw new Error("Passwort konnte nicht geändert werden.");
    const { error: pErr } = await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", context.userId);
    if (pErr) throw new Error("Profil konnte nicht aktualisiert werden.");
    return { ok: true };
  });

/** True while no user profile exists yet (initial setup needed). */
export const needsInitialSetup = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true });
  if (error) return { needsSetup: false };
  return { needsSetup: (count ?? 0) === 0 };
});

const bootstrapSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  password: z.string(),
  confirm: z.string(),
});

/**
 * Creates the very first administrator. Only works while the profiles table
 * is empty; afterwards it refuses permanently.
 */
export const bootstrapFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => bootstrapSchema.parse(input))
  .handler(async ({ data }) => {
    const pwError = validatePassword(data.password, data.confirm);
    if (pwError) throw new Error(pwError);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true });
    if ((count ?? 0) > 0) throw new Error("Die Ersteinrichtung wurde bereits abgeschlossen.");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email.toLowerCase(),
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.displayName },
    });
    if (error || !created.user) throw new Error("Administrator konnte nicht erstellt werden.");
    const { error: pErr } = await supabaseAdmin.from("profiles").insert({
      id: created.user.id,
      display_name: data.displayName,
      is_admin: true,
      is_active: true,
      must_change_password: false,
    });
    if (pErr) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error("Profil konnte nicht angelegt werden.");
    }
    return { ok: true };
  });
