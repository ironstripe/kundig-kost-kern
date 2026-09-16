CREATE TYPE public.handover_operation AS ENUM ('create', 'link');
CREATE TYPE public.handover_attempt_state AS ENUM ('ready', 'sending', 'unknown', 'failed', 'succeeded');

CREATE TABLE public.event_handover_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  approval_id uuid NOT NULL REFERENCES public.event_execution_approvals(id) ON DELETE RESTRICT,
  approval_fingerprint text NOT NULL,
  approved_at timestamptz NOT NULL,
  initiated_by uuid REFERENCES public.profiles(id),
  operation public.handover_operation NOT NULL,
  target_event_id text,
  idempotency_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  state public.handover_attempt_state NOT NULL DEFAULT 'ready',
  attempt_count integer NOT NULL DEFAULT 0,
  error_code text,
  error_message text,
  receipt jsonb,
  handover_id text,
  target_url text,
  target_event_deleted boolean NOT NULL DEFAULT false,
  sent_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX event_handover_attempts_one_success
  ON public.event_handover_attempts (event_id) WHERE state = 'succeeded';
CREATE UNIQUE INDEX event_handover_attempts_one_open
  ON public.event_handover_attempts (event_id) WHERE state IN ('ready', 'sending', 'unknown');
CREATE INDEX event_handover_attempts_event_idx ON public.event_handover_attempts (event_id, created_at DESC);

GRANT SELECT ON public.event_handover_attempts TO authenticated;
GRANT ALL ON public.event_handover_attempts TO service_role;

ALTER TABLE public.event_handover_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Aktive Benutzer sehen Uebergabeversuche"
  ON public.event_handover_attempts FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()));

CREATE TRIGGER event_handover_attempts_updated_at
  BEFORE UPDATE ON public.event_handover_attempts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();