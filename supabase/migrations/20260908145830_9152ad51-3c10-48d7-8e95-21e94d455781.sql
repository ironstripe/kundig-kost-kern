REVOKE ALL ON FUNCTION public.is_active_user(UUID) FROM public, anon;
REVOKE ALL ON FUNCTION public.is_admin(UUID) FROM public, anon;
REVOKE ALL ON FUNCTION public.guard_profile_update() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM public, anon, authenticated;