-- Enums -------------------------------------------------------------------
CREATE TYPE public.menu_status AS ENUM ('draft','partially_reviewed','reviewed','archived');
CREATE TYPE public.event_type AS ENUM ('beer_dine','banquet','lounge','other');
CREATE TYPE public.event_status AS ENUM ('draft','precalculated','released','executed','postcalculated','archived');
CREATE TYPE public.event_line_kind AS ENUM ('revenue','variable_cost','personnel_cost','fixed_cost','informational');
CREATE TYPE public.event_line_calc_mode AS ENUM ('fixed','per_guest');
CREATE TYPE public.event_value_status AS ENUM ('open','assumption','confirmed','effective');
CREATE TYPE public.assumption_unit AS ENUM ('chf_per_hour','chf_per_guest','chf_fixed','percent');
CREATE TYPE public.assumption_origin AS ENUM ('global_default','manual_override');

-- Menus --------------------------------------------------------------------
CREATE TABLE public.menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  notes text,
  status public.menu_status NOT NULL DEFAULT 'draft',
  gross_price_per_person numeric,
  vat_rate numeric NOT NULL DEFAULT 0.081 CHECK (vat_rate >= 0 AND vat_rate < 1),
  valid_from date,
  valid_to date,
  demo_key text UNIQUE,
  created_by uuid REFERENCES public.profiles(id),
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (gross_price_per_person IS NULL OR gross_price_per_person >= 0)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menus TO authenticated;
GRANT ALL ON public.menus TO service_role;
ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;
CREATE POLICY menus_active_users ON public.menus FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid())) WITH CHECK (public.is_active_user(auth.uid()));
CREATE TRIGGER menus_updated_at BEFORE UPDATE ON public.menus
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.menu_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id uuid NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  expected_guests integer CHECK (expected_guests IS NULL OR expected_guests >= 0),
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_variants TO authenticated;
GRANT ALL ON public.menu_variants TO service_role;
ALTER TABLE public.menu_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY menu_variants_active_users ON public.menu_variants FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid())) WITH CHECK (public.is_active_user(auth.uid()));
CREATE TRIGGER menu_variants_updated_at BEFORE UPDATE ON public.menu_variants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.menu_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_variant_id uuid NOT NULL REFERENCES public.menu_variants(id) ON DELETE CASCADE,
  course text NOT NULL DEFAULT 'main',
  variant_id uuid NOT NULL REFERENCES public.variants(id) ON DELETE RESTRICT,
  quantity_per_guest numeric NOT NULL DEFAULT 1 CHECK (quantity_per_guest > 0),
  sort_order integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_positions TO authenticated;
GRANT ALL ON public.menu_positions TO service_role;
ALTER TABLE public.menu_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY menu_positions_active_users ON public.menu_positions FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid())) WITH CHECK (public.is_active_user(auth.uid()));
CREATE TRIGGER menu_positions_updated_at BEFORE UPDATE ON public.menu_positions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Events -------------------------------------------------------------------
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  event_date date,
  event_type public.event_type NOT NULL DEFAULT 'other',
  status public.event_status NOT NULL DEFAULT 'draft',
  planned_paying_guests integer CHECK (planned_paying_guests IS NULL OR planned_paying_guests >= 0),
  planned_free_guests integer CHECK (planned_free_guests IS NULL OR planned_free_guests >= 0),
  actual_paying_guests integer CHECK (actual_paying_guests IS NULL OR actual_paying_guests >= 0),
  actual_free_guests integer CHECK (actual_free_guests IS NULL OR actual_free_guests >= 0),
  notes text,
  is_demo boolean NOT NULL DEFAULT false,
  demo_key text UNIQUE,
  created_by uuid REFERENCES public.profiles(id),
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY events_active_users ON public.events FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid())) WITH CHECK (public.is_active_user(auth.uid()));
CREATE TRIGGER events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.event_menu_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL UNIQUE REFERENCES public.events(id) ON DELETE CASCADE,
  menu_id uuid NOT NULL REFERENCES public.menus(id) ON DELETE RESTRICT,
  snapshot jsonb NOT NULL,
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_menu_links TO authenticated;
GRANT ALL ON public.event_menu_links TO service_role;
ALTER TABLE public.event_menu_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_menu_links_active_users ON public.event_menu_links FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid())) WITH CHECK (public.is_active_user(auth.uid()));
CREATE TRIGGER event_menu_links_updated_at BEFORE UPDATE ON public.event_menu_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.event_menu_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  menu_variant_id uuid NOT NULL REFERENCES public.menu_variants(id) ON DELETE CASCADE,
  planned_guests integer CHECK (planned_guests IS NULL OR planned_guests >= 0),
  actual_guests integer CHECK (actual_guests IS NULL OR actual_guests >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, menu_variant_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_menu_variants TO authenticated;
GRANT ALL ON public.event_menu_variants TO service_role;
ALTER TABLE public.event_menu_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_menu_variants_active_users ON public.event_menu_variants FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid())) WITH CHECK (public.is_active_user(auth.uid()));
CREATE TRIGGER event_menu_variants_updated_at BEFORE UPDATE ON public.event_menu_variants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.event_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL,
  kind public.event_line_kind NOT NULL,
  calc_mode public.event_line_calc_mode NOT NULL DEFAULT 'fixed',
  planned_unit_amount numeric CHECK (planned_unit_amount IS NULL OR planned_unit_amount >= 0),
  planned_quantity numeric CHECK (planned_quantity IS NULL OR planned_quantity >= 0),
  actual_unit_amount numeric CHECK (actual_unit_amount IS NULL OR actual_unit_amount >= 0),
  actual_quantity numeric CHECK (actual_quantity IS NULL OR actual_quantity >= 0),
  value_status public.event_value_status NOT NULL DEFAULT 'open',
  is_required boolean NOT NULL DEFAULT true,
  origin public.assumption_origin,
  assumption_key text,
  notes text,
  variance_note text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_lines TO authenticated;
GRANT ALL ON public.event_lines TO service_role;
ALTER TABLE public.event_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_lines_active_users ON public.event_lines FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid())) WITH CHECK (public.is_active_user(auth.uid()));
CREATE TRIGGER event_lines_updated_at BEFORE UPDATE ON public.event_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX event_lines_event_idx ON public.event_lines (event_id, sort_order);

-- Global assumptions --------------------------------------------------------
CREATE TABLE public.event_assumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  label text NOT NULL,
  event_type public.event_type,
  value numeric NOT NULL CHECK (value >= 0),
  unit public.assumption_unit NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  description text,
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (unit <> 'percent' OR (value >= 0 AND value <= 100))
);
CREATE UNIQUE INDEX event_assumptions_key_type_idx
  ON public.event_assumptions (key, event_type) WHERE event_type IS NOT NULL;
CREATE UNIQUE INDEX event_assumptions_key_all_idx
  ON public.event_assumptions (key) WHERE event_type IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_assumptions TO authenticated;
GRANT ALL ON public.event_assumptions TO service_role;
ALTER TABLE public.event_assumptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_assumptions_read ON public.event_assumptions FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()));
CREATE POLICY event_assumptions_admin_insert ON public.event_assumptions FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY event_assumptions_admin_update ON public.event_assumptions FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY event_assumptions_admin_delete ON public.event_assumptions FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE TRIGGER event_assumptions_updated_at BEFORE UPDATE ON public.event_assumptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.event_assumption_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  value numeric CHECK (value IS NULL OR value >= 0),
  unit public.assumption_unit NOT NULL,
  origin public.assumption_origin NOT NULL DEFAULT 'global_default',
  source_assumption_id uuid REFERENCES public.event_assumptions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, key),
  CHECK (unit <> 'percent' OR value IS NULL OR (value >= 0 AND value <= 100))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_assumption_values TO authenticated;
GRANT ALL ON public.event_assumption_values TO service_role;
ALTER TABLE public.event_assumption_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_assumption_values_active_users ON public.event_assumption_values FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid())) WITH CHECK (public.is_active_user(auth.uid()));
CREATE TRIGGER event_assumption_values_updated_at BEFORE UPDATE ON public.event_assumption_values
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Demo bookkeeping ----------------------------------------------------------
CREATE TABLE public.demo_seeds (
  key text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demo_seeds TO authenticated;
GRANT ALL ON public.demo_seeds TO service_role;
ALTER TABLE public.demo_seeds ENABLE ROW LEVEL SECURITY;
CREATE POLICY demo_seeds_read ON public.demo_seeds FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()));
CREATE POLICY demo_seeds_admin_write ON public.demo_seeds FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER demo_seeds_updated_at BEFORE UPDATE ON public.demo_seeds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Default global assumptions (admin editable) -------------------------------
INSERT INTO public.event_assumptions (key, label, event_type, value, unit, description) VALUES
  ('kitchen_hourly_rate','Stundensatz Küche', NULL, 62, 'chf_per_hour','Vollkostensatz pro Küchenstunde. Annahme, bitte periodisch überprüfen.'),
  ('service_hourly_rate','Stundensatz Service', NULL, 55, 'chf_per_hour','Vollkostensatz pro Servicestunde.'),
  ('organisation_hourly_rate','Stundensatz Eventorganisation', NULL, 75, 'chf_per_hour','Planung, Koordination, Administration.'),
  ('logistics_hourly_rate','Stundensatz Logistik', NULL, 50, 'chf_per_hour','Auf- und Abbau, Transportarbeiten.'),
  ('small_material_per_guest','Kleinmaterial pro Gast', NULL, 1.5, 'chf_per_guest','Servietten, Einweg- und Dekomaterial pro Gast.'),
  ('waste_reserve_percent','Reserve / Schwund', NULL, 5, 'percent','Prozentuale Reserve auf den Wareneinsatz.'),
  ('payment_fee_percent','Ticket- / Zahlungsgebühren', NULL, 2.5, 'percent','Gebühren auf den Ticketerlös.'),
  ('other_variable_per_guest','Weitere variable Kosten pro Gast', NULL, 0, 'chf_per_guest','Platzhalter für zusätzliche variable Kosten.'),
  ('default_fixed_cost','Standard-Fixkosten pro Event', NULL, 0, 'chf_fixed','Standardwert für direkte Fixkosten.');