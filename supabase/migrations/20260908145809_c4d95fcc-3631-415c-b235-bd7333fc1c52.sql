-- ===== Enums =====
CREATE TYPE public.small_material_mode AS ENUM ('percent', 'fixed');
CREATE TYPE public.import_status AS ENUM ('draft', 'processing', 'review', 'confirmed', 'failed');
CREATE TYPE public.dish_source_type AS ENUM ('menu_import', 'manual');
CREATE TYPE public.sales_input_mode AS ENUM ('per_open_day', 'total');
CREATE TYPE public.calculation_status AS ENUM ('estimated', 'partially_reviewed', 'reviewed');
CREATE TYPE public.package_unit AS ENUM ('kg', 'g', 'l', 'ml', 'piece');
CREATE TYPE public.base_unit AS ENUM ('g', 'ml', 'piece');
CREATE TYPE public.price_status AS ENUM ('estimated', 'confirmed');
CREATE TYPE public.ingredient_source_type AS ENUM ('ai_estimate', 'manual', 'excel_import');
CREATE TYPE public.quantity_source AS ENUM ('ai_estimate', 'manual');
CREATE TYPE public.import_type AS ENUM ('menu_document', 'ingredient_excel');
CREATE TYPE public.import_job_status AS ENUM ('pending', 'processing', 'review', 'confirmed', 'failed');

-- ===== Helper: updated_at =====
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

-- ===== profiles =====
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  display_name TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  must_change_password BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Security-definer helpers (avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.is_active_user(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND is_active = true);
$$;
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND is_active = true AND is_admin = true);
$$;
REVOKE ALL ON FUNCTION public.is_active_user(UUID) FROM public;
REVOKE ALL ON FUNCTION public.is_admin(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.is_active_user(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated, service_role;

-- Guard: non-admins may only change their own display_name; admins may not demote/deactivate themselves
CREATE OR REPLACE FUNCTION public.guard_profile_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor UUID := auth.uid();
BEGIN
  -- service_role / no JWT context: allow (server-side privileged operations)
  IF actor IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT public.is_admin(actor) THEN
    IF NEW.id <> actor
       OR NEW.is_admin IS DISTINCT FROM OLD.is_admin
       OR NEW.is_active IS DISTINCT FROM OLD.is_active
       OR NEW.must_change_password IS DISTINCT FROM OLD.must_change_password THEN
      RAISE EXCEPTION 'Keine Berechtigung für diese Profiländerung';
    END IF;
  ELSE
    IF NEW.id = actor AND (NEW.is_admin = false OR NEW.is_active = false) THEN
      RAISE EXCEPTION 'Admins können sich nicht selbst deaktivieren oder degradieren';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER profiles_guard_update BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_update();

CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (id = auth.uid() OR public.is_admin(auth.uid()));

-- ===== menu_cards =====
CREATE TABLE public.menu_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Sommerkarte 2026',
  valid_from DATE NOT NULL DEFAULT '2026-08-01',
  valid_to DATE NOT NULL DEFAULT '2026-10-31',
  vat_rate NUMERIC(6,4) NOT NULL DEFAULT 0.081 CHECK (vat_rate >= 0 AND vat_rate < 1),
  small_material_mode public.small_material_mode NOT NULL DEFAULT 'percent',
  small_material_value NUMERIC(12,4) NOT NULL DEFAULT 0.03 CHECK (small_material_value >= 0),
  opening_weekdays INTEGER[] NOT NULL DEFAULT '{3,4,5,6,7}',
  source_file_url TEXT,
  import_status public.import_status NOT NULL DEFAULT 'draft',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT menu_cards_valid_range CHECK (valid_to >= valid_from),
  CONSTRAINT menu_cards_weekdays_range CHECK (opening_weekdays <@ ARRAY[1,2,3,4,5,6,7])
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_cards TO authenticated;
GRANT ALL ON public.menu_cards TO service_role;
ALTER TABLE public.menu_cards ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER menu_cards_updated_at BEFORE UPDATE ON public.menu_cards FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "menu_cards_active_users" ON public.menu_cards FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid())) WITH CHECK (public.is_active_user(auth.uid()));

-- ===== excluded_days =====
CREATE TABLE public.excluded_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_card_id UUID NOT NULL REFERENCES public.menu_cards(id) ON DELETE RESTRICT,
  excluded_date DATE NOT NULL,
  reason TEXT,
  UNIQUE (menu_card_id, excluded_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.excluded_days TO authenticated;
GRANT ALL ON public.excluded_days TO service_role;
ALTER TABLE public.excluded_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "excluded_days_active_users" ON public.excluded_days FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid())) WITH CHECK (public.is_active_user(auth.uid()));

-- ===== categories =====
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_card_id UUID NOT NULL REFERENCES public.menu_cards(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_food BOOLEAN NOT NULL DEFAULT true
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_active_users" ON public.categories FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid())) WITH CHECK (public.is_active_user(auth.uid()));

-- ===== dishes =====
CREATE TABLE public.dishes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_card_id UUID NOT NULL REFERENCES public.menu_cards(id) ON DELETE RESTRICT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  source_type public.dish_source_type NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dishes TO authenticated;
GRANT ALL ON public.dishes TO service_role;
ALTER TABLE public.dishes ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER dishes_updated_at BEFORE UPDATE ON public.dishes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "dishes_active_users" ON public.dishes FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid())) WITH CHECK (public.is_active_user(auth.uid()));

-- ===== variants =====
CREATE TABLE public.variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id UUID NOT NULL REFERENCES public.dishes(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  gross_price NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (gross_price >= 0),
  sales_input_mode public.sales_input_mode NOT NULL DEFAULT 'per_open_day',
  expected_per_open_day NUMERIC(12,4) NOT NULL DEFAULT 1 CHECK (expected_per_open_day >= 0),
  expected_total NUMERIC(12,4) CHECK (expected_total IS NULL OR expected_total >= 0),
  small_material_override_mode public.small_material_mode,
  small_material_override_value NUMERIC(12,4) CHECK (small_material_override_value IS NULL OR small_material_override_value >= 0),
  calculation_status public.calculation_status NOT NULL DEFAULT 'estimated',
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.variants TO authenticated;
GRANT ALL ON public.variants TO service_role;
ALTER TABLE public.variants ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER variants_updated_at BEFORE UPDATE ON public.variants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "variants_active_users" ON public.variants FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid())) WITH CHECK (public.is_active_user(auth.uid()));

-- ===== add_ons =====
CREATE TABLE public.add_ons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_card_id UUID NOT NULL REFERENCES public.menu_cards(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  gross_price NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (gross_price >= 0),
  sales_input_mode public.sales_input_mode NOT NULL DEFAULT 'per_open_day',
  expected_per_open_day NUMERIC(12,4) NOT NULL DEFAULT 1 CHECK (expected_per_open_day >= 0),
  expected_total NUMERIC(12,4) CHECK (expected_total IS NULL OR expected_total >= 0),
  small_material_override_mode public.small_material_mode,
  small_material_override_value NUMERIC(12,4) CHECK (small_material_override_value IS NULL OR small_material_override_value >= 0),
  calculation_status public.calculation_status NOT NULL DEFAULT 'estimated',
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.add_ons TO authenticated;
GRANT ALL ON public.add_ons TO service_role;
ALTER TABLE public.add_ons ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER add_ons_updated_at BEFORE UPDATE ON public.add_ons FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "add_ons_active_users" ON public.add_ons FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid())) WITH CHECK (public.is_active_user(auth.uid()));

-- ===== add_on_links =====
CREATE TABLE public.add_on_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id UUID NOT NULL REFERENCES public.dishes(id) ON DELETE CASCADE,
  add_on_id UUID NOT NULL REFERENCES public.add_ons(id) ON DELETE CASCADE,
  UNIQUE (dish_id, add_on_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.add_on_links TO authenticated;
GRANT ALL ON public.add_on_links TO service_role;
ALTER TABLE public.add_on_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "add_on_links_active_users" ON public.add_on_links FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid())) WITH CHECK (public.is_active_user(auth.uid()));

-- ===== ingredients =====
CREATE TABLE public.ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  supplier TEXT,
  package_quantity NUMERIC(12,4) NOT NULL CHECK (package_quantity > 0),
  package_unit public.package_unit NOT NULL,
  package_label TEXT,
  package_price NUMERIC(12,4) NOT NULL CHECK (package_price >= 0),
  base_unit public.base_unit NOT NULL,
  price_date DATE,
  is_own_production BOOLEAN NOT NULL DEFAULT false,
  price_status public.price_status NOT NULL DEFAULT 'estimated',
  source_type public.ingredient_source_type NOT NULL DEFAULT 'manual',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ingredients TO authenticated;
GRANT ALL ON public.ingredients TO service_role;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER ingredients_updated_at BEFORE UPDATE ON public.ingredients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "ingredients_active_users" ON public.ingredients FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid())) WITH CHECK (public.is_active_user(auth.uid()));

-- ===== calculation_items =====
CREATE TABLE public.calculation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID REFERENCES public.variants(id) ON DELETE RESTRICT,
  add_on_id UUID REFERENCES public.add_ons(id) ON DELETE RESTRICT,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE RESTRICT,
  component_group TEXT NOT NULL DEFAULT 'main',
  net_quantity NUMERIC(12,4) NOT NULL CHECK (net_quantity >= 0),
  quantity_unit public.base_unit NOT NULL,
  yield_percent NUMERIC(6,2) NOT NULL DEFAULT 100 CHECK (yield_percent > 0 AND yield_percent <= 100),
  sort_order INTEGER NOT NULL DEFAULT 0,
  quantity_source public.quantity_source NOT NULL DEFAULT 'manual',
  quantity_confirmed BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT calculation_items_exactly_one_parent CHECK (
    (variant_id IS NOT NULL AND add_on_id IS NULL) OR (variant_id IS NULL AND add_on_id IS NOT NULL)
  )
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calculation_items TO authenticated;
GRANT ALL ON public.calculation_items TO service_role;
ALTER TABLE public.calculation_items ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER calculation_items_updated_at BEFORE UPDATE ON public.calculation_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "calculation_items_active_users" ON public.calculation_items FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid())) WITH CHECK (public.is_active_user(auth.uid()));

-- ===== import_jobs =====
CREATE TABLE public.import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_card_id UUID NOT NULL REFERENCES public.menu_cards(id) ON DELETE RESTRICT,
  import_type public.import_type NOT NULL,
  file_url TEXT NOT NULL,
  status public.import_job_status NOT NULL DEFAULT 'pending',
  extracted_payload JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_jobs TO authenticated;
GRANT ALL ON public.import_jobs TO service_role;
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "import_jobs_active_users" ON public.import_jobs FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid())) WITH CHECK (public.is_active_user(auth.uid()));

-- ===== Indexes =====
CREATE INDEX idx_categories_menu_card ON public.categories(menu_card_id);
CREATE INDEX idx_dishes_menu_card ON public.dishes(menu_card_id);
CREATE INDEX idx_dishes_category ON public.dishes(category_id);
CREATE INDEX idx_variants_dish ON public.variants(dish_id);
CREATE INDEX idx_add_ons_menu_card ON public.add_ons(menu_card_id);
CREATE INDEX idx_calculation_items_variant ON public.calculation_items(variant_id);
CREATE INDEX idx_calculation_items_add_on ON public.calculation_items(add_on_id);
CREATE INDEX idx_calculation_items_ingredient ON public.calculation_items(ingredient_id);
CREATE INDEX idx_import_jobs_menu_card ON public.import_jobs(menu_card_id);

-- ===== Demo configuration =====
INSERT INTO public.menu_cards (name, valid_from, valid_to, vat_rate, small_material_mode, small_material_value, opening_weekdays, import_status, is_active)
VALUES ('Sommerkarte 2026', '2026-08-01', '2026-10-31', 0.081, 'percent', 0.03, '{3,4,5,6,7}', 'draft', true);