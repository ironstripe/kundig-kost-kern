DROP FUNCTION IF EXISTS public.create_event_from_idea(uuid);

CREATE OR REPLACE FUNCTION public.create_event_from_idea(_idea_id uuid, _approve boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _idea public.event_ideas;
  _event_id uuid;
  _notes text;
BEGIN
  IF NOT public.is_active_user(_uid) THEN
    RAISE EXCEPTION 'Kein aktiver Benutzer.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_idea_id::text, 0));

  SELECT * INTO _idea FROM public.event_ideas WHERE id = _idea_id FOR UPDATE;
  IF _idea.id IS NULL THEN
    RAISE EXCEPTION 'Idee nicht gefunden.';
  END IF;

  SELECT id INTO _event_id FROM public.events WHERE idea_id = _idea_id;
  IF _event_id IS NOT NULL THEN
    RETURN _event_id;
  END IF;

  IF _idea.stage <> 'approved_for_calculation' THEN
    IF NOT _approve THEN
      RAISE EXCEPTION 'Die Idee ist nicht zur Kalkulation freigegeben.';
    END IF;
    IF _idea.stage NOT IN ('new', 'in_discussion') THEN
      RAISE EXCEPTION 'Zurückgestellte oder verworfene Ideen müssen zuerst zurück in die Diskussion.';
    END IF;
    UPDATE public.event_ideas
       SET stage = 'approved_for_calculation',
           calc_approved_by = coalesce(calc_approved_by, _uid),
           calc_approved_at = coalesce(calc_approved_at, now()),
           updated_by = _uid
     WHERE id = _idea_id
    RETURNING * INTO _idea;
  END IF;

  _notes := nullif(btrim(concat_ws(
    E'\n',
    nullif(btrim(coalesce(_idea.summary, '')), ''),
    CASE WHEN _idea.target_audience IS NOT NULL THEN 'Zielgruppe: ' || _idea.target_audience END,
    CASE WHEN _idea.desired_period IS NOT NULL THEN 'Wunschzeitraum: ' || _idea.desired_period END,
    CASE WHEN _idea.partner IS NOT NULL THEN 'Partner: ' || _idea.partner END,
    CASE WHEN _idea.owner_name IS NOT NULL THEN 'Verantwortlich: ' || _idea.owner_name END,
    nullif(btrim(coalesce(_idea.notes, '')), '')
  )), '');

  INSERT INTO public.events (
    name, event_date, event_type, status, planned_paying_guests,
    notes, idea_id, created_by, updated_by
  ) VALUES (
    _idea.title,
    _idea.desired_date,
    coalesce(_idea.event_type, 'other'),
    'draft',
    _idea.expected_guests,
    _notes,
    _idea.id,
    _uid,
    _uid
  )
  ON CONFLICT (idea_id) WHERE idea_id IS NOT NULL DO NOTHING
  RETURNING id INTO _event_id;

  IF _event_id IS NULL THEN
    SELECT id INTO _event_id FROM public.events WHERE idea_id = _idea_id;
  END IF;

  RETURN _event_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_event_from_idea(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_event_from_idea(uuid, boolean) TO authenticated, service_role;