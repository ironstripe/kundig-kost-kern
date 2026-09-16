REVOKE EXECUTE ON FUNCTION public.event_basis_fingerprint(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_event_from_idea(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.approve_event_execution(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.event_basis_fingerprint(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_event_from_idea(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_event_execution(uuid, text) TO authenticated, service_role;