ALTER TABLE public.import_jobs
  ADD COLUMN IF NOT EXISTS source_kind TEXT NOT NULL DEFAULT 'file' CHECK (source_kind IN ('file','url')),
  ADD COLUMN IF NOT EXISTS source_name TEXT,
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS content_type TEXT,
  ADD COLUMN IF NOT EXISTS file_size BIGINT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS review_payload JSONB,
  ADD COLUMN IF NOT EXISTS estimation_payload JSONB,
  ADD COLUMN IF NOT EXISTS estimation_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS import_jobs_updated_at ON public.import_jobs;
CREATE TRIGGER import_jobs_updated_at BEFORE UPDATE ON public.import_jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage: private bucket menu-sources
CREATE POLICY "menu_sources_select_active" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'menu-sources' AND public.is_active_user(auth.uid()));
CREATE POLICY "menu_sources_insert_active" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'menu-sources' AND public.is_active_user(auth.uid()));

-- ===== Confirm a reviewed menu import in one transaction =====
CREATE OR REPLACE FUNCTION public.import_menu_payload(_job_id UUID, _payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_job public.import_jobs%ROWTYPE;
  v_card UUID;
  cat JSONB; d JSONB; v JSONB; a JSONB;
  v_cat_id UUID; v_dish_id UUID; v_var_id UUID; v_addon_id UUID;
  v_action TEXT; v_key TEXT;
  n_dish_created INT := 0; n_dish_updated INT := 0; n_dish_skipped INT := 0;
  n_addon_created INT := 0; n_var_created INT := 0;
  dish_ids UUID[] := '{}';
  addon_map JSONB := '{}'::jsonb;
  has_default BOOLEAN;
BEGIN
  SELECT * INTO v_job FROM public.import_jobs WHERE id = _job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Import-Auftrag nicht gefunden.'; END IF;
  IF v_job.status <> 'review' THEN RAISE EXCEPTION 'Dieser Import ist nicht zur Übernahme bereit.'; END IF;
  v_card := v_job.menu_card_id;

  FOR cat IN SELECT * FROM jsonb_array_elements(COALESCE(_payload->'categories','[]'::jsonb)) LOOP
    v_cat_id := NULL;
    IF (cat->>'existing_category_id') IS NOT NULL THEN
      SELECT id INTO v_cat_id FROM public.categories WHERE id = (cat->>'existing_category_id')::uuid AND menu_card_id = v_card;
    END IF;
    IF v_cat_id IS NULL THEN
      SELECT id INTO v_cat_id FROM public.categories
        WHERE menu_card_id = v_card AND lower(btrim(name)) = lower(btrim(cat->>'name')) LIMIT 1;
    END IF;
    IF v_cat_id IS NULL THEN
      INSERT INTO public.categories (menu_card_id, name, sort_order, is_food)
        VALUES (v_card, btrim(cat->>'name'), COALESCE((cat->>'sort_order')::int, 0), true)
        RETURNING id INTO v_cat_id;
    END IF;

    FOR d IN SELECT * FROM jsonb_array_elements(COALESCE(cat->'dishes','[]'::jsonb)) LOOP
      v_action := COALESCE(d->>'action', 'create');
      IF v_action = 'skip' THEN n_dish_skipped := n_dish_skipped + 1; CONTINUE; END IF;
      IF jsonb_array_length(COALESCE(d->'variants','[]'::jsonb)) = 0 THEN
        RAISE EXCEPTION 'Gericht «%» hat keine Variante.', d->>'name';
      END IF;
      v_dish_id := NULL;
      IF v_action = 'update' AND (d->>'existing_dish_id') IS NOT NULL THEN
        UPDATE public.dishes SET name = btrim(d->>'name'), description = NULLIF(btrim(COALESCE(d->>'description','')),''),
          category_id = v_cat_id, sort_order = COALESCE((d->>'sort_order')::int, sort_order)
          WHERE id = (d->>'existing_dish_id')::uuid AND menu_card_id = v_card RETURNING id INTO v_dish_id;
        IF v_dish_id IS NULL THEN RAISE EXCEPTION 'Bestehendes Gericht «%» wurde nicht gefunden.', d->>'name'; END IF;
        n_dish_updated := n_dish_updated + 1;
      ELSE
        INSERT INTO public.dishes (menu_card_id, category_id, name, description, sort_order, source_type)
          VALUES (v_card, v_cat_id, btrim(d->>'name'), NULLIF(btrim(COALESCE(d->>'description','')),''), COALESCE((d->>'sort_order')::int,0), 'menu_import')
          RETURNING id INTO v_dish_id;
        n_dish_created := n_dish_created + 1;
      END IF;
      dish_ids := dish_ids || v_dish_id;

      has_default := false;
      FOR v IN SELECT * FROM jsonb_array_elements(d->'variants') LOOP
        v_var_id := NULL;
        IF v_action = 'update' THEN
          SELECT id INTO v_var_id FROM public.variants WHERE dish_id = v_dish_id AND lower(btrim(name)) = lower(btrim(v->>'name')) LIMIT 1;
        END IF;
        IF v_var_id IS NOT NULL THEN
          UPDATE public.variants SET gross_price = (v->>'gross_price')::numeric, is_default = COALESCE((v->>'is_default')::boolean,false), is_active = true, updated_by = auth.uid()
            WHERE id = v_var_id;
        ELSE
          INSERT INTO public.variants (dish_id, name, gross_price, is_default, calculation_status, expected_per_open_day, sales_input_mode, updated_by)
            VALUES (v_dish_id, btrim(v->>'name'), (v->>'gross_price')::numeric, COALESCE((v->>'is_default')::boolean,false), 'estimated', 1, 'per_open_day', auth.uid())
            RETURNING id INTO v_var_id;
          n_var_created := n_var_created + 1;
        END IF;
        IF COALESCE((v->>'is_default')::boolean,false) THEN has_default := true; END IF;
      END LOOP;
      IF v_action = 'update' AND has_default THEN
        UPDATE public.variants SET is_default = false WHERE dish_id = v_dish_id AND is_default
          AND lower(btrim(name)) NOT IN (SELECT lower(btrim(x->>'name')) FROM jsonb_array_elements(d->'variants') x WHERE COALESCE((x->>'is_default')::boolean,false));
      END IF;

      FOR a IN SELECT * FROM jsonb_array_elements(COALESCE(d->'add_ons','[]'::jsonb)) LOOP
        v_key := lower(btrim(a->>'name')) || '|' || ((a->>'gross_price')::numeric)::text;
        IF addon_map ? v_key THEN
          v_addon_id := (addon_map->>v_key)::uuid;
        ELSE
          SELECT id INTO v_addon_id FROM public.add_ons
            WHERE menu_card_id = v_card AND lower(btrim(name)) = lower(btrim(a->>'name')) AND gross_price = (a->>'gross_price')::numeric LIMIT 1;
          IF v_addon_id IS NULL THEN
            INSERT INTO public.add_ons (menu_card_id, name, gross_price, calculation_status, expected_per_open_day, sales_input_mode)
              VALUES (v_card, btrim(a->>'name'), (a->>'gross_price')::numeric, 'estimated', 1, 'per_open_day')
              RETURNING id INTO v_addon_id;
            n_addon_created := n_addon_created + 1;
          END IF;
          addon_map := addon_map || jsonb_build_object(v_key, v_addon_id::text);
        END IF;
        INSERT INTO public.add_on_links (dish_id, add_on_id) VALUES (v_dish_id, v_addon_id) ON CONFLICT DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;

  UPDATE public.import_jobs SET status = 'confirmed', confirmed_at = now(), confirmed_by = auth.uid(),
    review_payload = _payload, error_message = NULL WHERE id = _job_id;
  UPDATE public.menu_cards SET import_status = 'confirmed', source_file_url = COALESCE(v_job.storage_path, source_file_url), updated_by = auth.uid() WHERE id = v_card;

  RETURN jsonb_build_object(
    'dishes_created', n_dish_created, 'dishes_updated', n_dish_updated, 'dishes_skipped', n_dish_skipped,
    'variants_created', n_var_created, 'add_ons_created', n_addon_created, 'dish_ids', to_jsonb(dish_ids));
END;
$$;
REVOKE ALL ON FUNCTION public.import_menu_payload(UUID, JSONB) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.import_menu_payload(UUID, JSONB) TO authenticated, service_role;

-- ===== Confirm an ingredient/quantity estimation in one transaction =====
CREATE OR REPLACE FUNCTION public.import_estimation_payload(_job_id UUID, _payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_job public.import_jobs%ROWTYPE;
  ing JSONB; it JSONB;
  v_ing_id UUID; v_variant UUID; v_ok BOOLEAN;
  ing_map JSONB := '{}'::jsonb;
  n_ing INT := 0; n_items INT := 0;
  v_sort INT;
BEGIN
  SELECT * INTO v_job FROM public.import_jobs WHERE id = _job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Import-Auftrag nicht gefunden.'; END IF;
  IF v_job.status <> 'confirmed' THEN RAISE EXCEPTION 'Die Speisekarte muss zuerst übernommen werden.'; END IF;

  FOR ing IN SELECT * FROM jsonb_array_elements(COALESCE(_payload->'new_ingredients','[]'::jsonb)) LOOP
    INSERT INTO public.ingredients (name, category, package_quantity, package_unit, package_price, base_unit, price_status, source_type, price_date, notes, updated_by)
      VALUES (btrim(ing->>'name'), COALESCE(NULLIF(btrim(ing->>'category'),''), 'Sonstiges'), (ing->>'package_quantity')::numeric, (ing->>'package_unit')::public.package_unit,
              (ing->>'package_price')::numeric, (ing->>'base_unit')::public.base_unit, 'estimated', 'ai_estimate', CURRENT_DATE,
              'KI-Schätzung aus Speisekarten-Import – Preis nicht bestätigt.', auth.uid())
      RETURNING id INTO v_ing_id;
    ing_map := ing_map || jsonb_build_object(ing->>'key', v_ing_id::text);
    n_ing := n_ing + 1;
  END LOOP;

  FOR it IN SELECT * FROM jsonb_array_elements(COALESCE(_payload->'items','[]'::jsonb)) LOOP
    v_variant := (it->>'variant_id')::uuid;
    SELECT EXISTS (SELECT 1 FROM public.variants vv JOIN public.dishes dd ON dd.id = vv.dish_id WHERE vv.id = v_variant AND dd.menu_card_id = v_job.menu_card_id) INTO v_ok;
    IF NOT v_ok THEN RAISE EXCEPTION 'Variante gehört nicht zur Speisekarte dieses Imports.'; END IF;
    IF (it->>'ingredient_id') IS NOT NULL THEN
      v_ing_id := (it->>'ingredient_id')::uuid;
    ELSIF ing_map ? (it->>'ingredient_key') THEN
      v_ing_id := (ing_map->>(it->>'ingredient_key'))::uuid;
    ELSE
      RAISE EXCEPTION 'Kalkulationsposition ohne Zutat.';
    END IF;
    SELECT COALESCE(MAX(sort_order),0) + 1 INTO v_sort FROM public.calculation_items WHERE variant_id = v_variant;
    INSERT INTO public.calculation_items (variant_id, ingredient_id, component_group, net_quantity, quantity_unit, yield_percent, sort_order, quantity_source, quantity_confirmed, notes)
      VALUES (v_variant, v_ing_id, COALESCE(NULLIF(it->>'component_group',''),'main'), (it->>'net_quantity')::numeric, (it->>'quantity_unit')::public.base_unit,
              COALESCE((it->>'yield_percent')::numeric, 100), v_sort, 'ai_estimate', false, NULLIF(it->>'notes',''));
    n_items := n_items + 1;
  END LOOP;

  UPDATE public.import_jobs SET estimation_payload = _payload, estimation_confirmed_at = now() WHERE id = _job_id;
  RETURN jsonb_build_object('ingredients_created', n_ing, 'items_created', n_items);
END;
$$;
REVOKE ALL ON FUNCTION public.import_estimation_payload(UUID, JSONB) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.import_estimation_payload(UUID, JSONB) TO authenticated, service_role;