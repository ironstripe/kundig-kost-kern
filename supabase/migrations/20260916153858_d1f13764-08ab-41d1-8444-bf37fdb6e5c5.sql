CREATE TYPE public.event_idea_stage AS ENUM ('new', 'in_discussion', 'approved_for_calculation', 'deferred', 'rejected');
CREATE TYPE public.event_handover_state AS ENUM ('not_ready', 'ready', 'handed_over');

CREATE TABLE public.event_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  summary text NOT NULL,
  event_type public.event_type,
  target_audience text,
  desired_date date,
  desired_period text,
  expected_guests integer,
  partner text,
  owner_name text,
  notes text,
  stage public.event_idea_stage NOT NULL DEFAULT 'new',
  calc_approved_by uuid REFERENCES public.profiles(id),
  calc_approved_at timestamptz,
  created_by uuid REFERENCES public.profiles(id),
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_ideas TO authenticated;
GRANT ALL ON public.event_ideas TO service_role;
ALTER TABLE public.event_ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active users manage event ideas" ON public.event_ideas FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid())) WITH CHECK (public.is_active_user(auth.uid()));
CREATE TRIGGER set_event_ideas_updated_at BEFORE UPDATE ON public.event_ideas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.event_idea_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id uuid NOT NULL REFERENCES public.event_ideas(id) ON DELETE CASCADE,
  body text NOT NULL,
  author_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_idea_notes TO authenticated;
GRANT ALL ON public.event_idea_notes TO service_role;
ALTER TABLE public.event_idea_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active users manage idea notes" ON public.event_idea_notes FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid())) WITH CHECK (public.is_active_user(auth.uid()));
CREATE TRIGGER set_event_idea_notes_updated_at BEFORE UPDATE ON public.event_idea_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX event_idea_notes_idea_idx ON public.event_idea_notes(idea_id, created_at);

ALTER TABLE public.events
  ADD COLUMN idea_id uuid REFERENCES public.event_ideas(id),
  ADD COLUMN handover_state public.event_handover_state NOT NULL DEFAULT 'not_ready',
  ADD COLUMN handover_ref text,
  ADD COLUMN handover_url text,
  ADD COLUMN source_key uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX events_idea_id_key ON public.events(idea_id) WHERE idea_id IS NOT NULL;
CREATE UNIQUE INDEX events_source_key_key ON public.events(source_key);

CREATE TABLE public.event_execution_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz NOT NULL DEFAULT now(),
  note text,
  basis_snapshot jsonb NOT NULL,
  basis_fingerprint text NOT NULL,
  superseded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.event_execution_approvals TO authenticated;
GRANT ALL ON public.event_execution_approvals TO service_role;
ALTER TABLE public.event_execution_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active users read execution approvals" ON public.event_execution_approvals FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()));
CREATE INDEX event_execution_approvals_event_idx ON public.event_execution_approvals(event_id, approved_at DESC);

CREATE OR REPLACE FUNCTION public.event_basis_fingerprint(_event_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT md5(
    coalesce((
      SELECT string_agg(
        l.id::text || ':' || coalesce(l.planned_unit_amount::text, '') || ':' ||
        coalesce(l.planned_quantity::text, '') || ':' || l.kind::text || ':' ||
        l.is_required::text || ':' || l.value_status::text,
        '|' ORDER BY l.id
      )
      FROM public.event_lines l WHERE l.event_id = _event_id
    ), '')
    || '#' || coalesce((SELECT e.planned_paying_guests::text FROM public.events e WHERE e.id = _event_id), '')
    || '#' || coalesce((SELECT e.planned_free_guests::text FROM public.events e WHERE e.id = _event_id), '')
  );
$$;
GRANT EXECUTE ON FUNCTION public.event_basis_fingerprint(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_event_from_idea(_idea_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _idea public.event_ideas;
  _event_id uuid;
BEGIN
  IF NOT public.is_active_user(_uid) THEN
    RAISE EXCEPTION 'Kein aktiver Benutzer.';
  END IF;

  SELECT * INTO _idea FROM public.event_ideas WHERE id = _idea_id;
  IF _idea.id IS NULL THEN
    RAISE EXCEPTION 'Idee nicht gefunden.';
  END IF;

  SELECT id INTO _event_id FROM public.events WHERE idea_id = _idea_id;
  IF _event_id IS NOT NULL THEN
    RETURN _event_id;
  END IF;

  IF _idea.stage <> 'approved_for_calculation' THEN
    RAISE EXCEPTION 'Die Idee ist nicht zur Kalkulation freigegeben.';
  END IF;

  INSERT INTO public.events (
    name, event_date, event_type, status, planned_paying_guests,
    notes, idea_id, created_by, updated_by
  ) VALUES (
    _idea.title,
    _idea.desired_date,
    coalesce(_idea.event_type, 'other'),
    'draft',
    _idea.expected_guests,
    _idea.notes,
    _idea.id,
    _uid,
    _uid
  )
  RETURNING id INTO _event_id;

  RETURN _event_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_event_from_idea(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.approve_event_execution(_event_id uuid, _note text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _event public.events;
  _relevant int;
  _open int;
  _snapshot jsonb;
  _fp text;
  _id uuid;
BEGIN
  IF NOT public.is_active_user(_uid) THEN
    RAISE EXCEPTION 'Kein aktiver Benutzer.';
  END IF;

  SELECT * INTO _event FROM public.events WHERE id = _event_id;
  IF _event.id IS NULL THEN
    RAISE EXCEPTION 'Event nicht gefunden.';
  END IF;

  SELECT count(*) INTO _relevant FROM public.event_lines l
   WHERE l.event_id = _event_id AND l.kind <> 'informational';
  SELECT count(*) INTO _open FROM public.event_lines l
   WHERE l.event_id = _event_id AND l.kind <> 'informational' AND l.is_required
     AND (l.planned_unit_amount IS NULL OR l.planned_quantity IS NULL);

  IF _relevant = 0 OR _open > 0 THEN
    RAISE EXCEPTION 'Freigabe nicht möglich: Es fehlen Pflichtwerte in der Kalkulation.';
  END IF;

  _fp := public.event_basis_fingerprint(_event_id);
  _snapshot := jsonb_build_object(
    'event', to_jsonb(_event),
    'lines', coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.sort_order) FROM public.event_lines l WHERE l.event_id = _event_id), '[]'::jsonb),
    'assumptions', coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.label) FROM public.event_assumption_values a WHERE a.event_id = _event_id), '[]'::jsonb),
    'menu_link', (SELECT to_jsonb(m) FROM public.event_menu_links m WHERE m.event_id = _event_id),
    'captured_at', now()
  );

  UPDATE public.event_execution_approvals
     SET superseded_at = now()
   WHERE event_id = _event_id AND superseded_at IS NULL;

  INSERT INTO public.event_execution_approvals (event_id, approved_by, note, basis_snapshot, basis_fingerprint)
  VALUES (_event_id, _uid, nullif(btrim(coalesce(_note, '')), ''), _snapshot, _fp)
  RETURNING id INTO _id;

  UPDATE public.events
     SET handover_state = CASE WHEN handover_state = 'handed_over' THEN handover_state ELSE 'ready' END,
         updated_by = _uid
   WHERE id = _event_id;

  RETURN _id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.approve_event_execution(uuid, text) TO authenticated, service_role;