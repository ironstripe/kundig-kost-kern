-- Unit compatibility on ingredients
ALTER TABLE public.ingredients
  ADD CONSTRAINT ingredients_unit_compatibility CHECK (
    (package_unit IN ('kg','g') AND base_unit = 'g') OR
    (package_unit IN ('l','ml') AND base_unit = 'ml') OR
    (package_unit = 'piece' AND base_unit = 'piece')
  );

-- Calculation item integrity
ALTER TABLE public.calculation_items
  ADD CONSTRAINT calculation_items_net_quantity_positive CHECK (net_quantity > 0),
  ADD CONSTRAINT calculation_items_yield_range CHECK (yield_percent > 0 AND yield_percent <= 100),
  ADD CONSTRAINT calculation_items_component_group_check CHECK (
    component_group IN ('main','sauce','side','vegetables','garnish','preparation','other')
  );

-- Items belong to their variant: remove them together with the variant
ALTER TABLE public.calculation_items DROP CONSTRAINT calculation_items_variant_id_fkey;
ALTER TABLE public.calculation_items
  ADD CONSTRAINT calculation_items_variant_id_fkey
  FOREIGN KEY (variant_id) REFERENCES public.variants(id) ON DELETE CASCADE;

-- Demo data (labelled as assumptions in the UI via source_type/price_status = estimated)
DO $$
DECLARE
  v_card UUID;
  v_cat UUID := 'a1000000-0000-4000-8000-000000000001';
  v_dish UUID := 'a2000000-0000-4000-8000-000000000001';
  v_normal UUID := 'a3000000-0000-4000-8000-000000000001';
  v_klein UUID := 'a3000000-0000-4000-8000-000000000002';
  i_forelle UUID := 'a4000000-0000-4000-8000-000000000001';
  i_kart UUID := 'a4000000-0000-4000-8000-000000000002';
  i_butter UUID := 'a4000000-0000-4000-8000-000000000003';
  i_mandel UUID := 'a4000000-0000-4000-8000-000000000004';
  i_peter UUID := 'a4000000-0000-4000-8000-000000000005';
  i_zitr UUID := 'a4000000-0000-4000-8000-000000000006';
BEGIN
  SELECT id INTO v_card FROM public.menu_cards WHERE is_active = true ORDER BY valid_from DESC LIMIT 1;
  IF v_card IS NULL THEN RETURN; END IF;

  INSERT INTO public.categories (id, menu_card_id, name, sort_order, is_food)
  VALUES (v_cat, v_card, 'Fisch', 10, true) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.ingredients (id, name, category, supplier, package_quantity, package_unit, package_price, base_unit, is_own_production, price_status, source_type, notes)
  VALUES
    (i_forelle, 'Forellenfilet', 'Fisch', NULL, 1, 'kg', 30, 'g', true, 'estimated', 'ai_estimate', 'Demo-Annahme'),
    (i_kart, 'Kartoffeln', 'Gemüse', NULL, 1, 'kg', 2.5, 'g', false, 'estimated', 'ai_estimate', 'Demo-Annahme'),
    (i_butter, 'Butter', 'Molkerei', NULL, 1, 'kg', 12, 'g', false, 'estimated', 'ai_estimate', 'Demo-Annahme'),
    (i_mandel, 'Mandeln', 'Trockenprodukte', NULL, 1, 'kg', 18, 'g', false, 'estimated', 'ai_estimate', 'Demo-Annahme'),
    (i_peter, 'Petersilie', 'Kräuter', NULL, 1, 'kg', 30, 'g', false, 'estimated', 'ai_estimate', 'Demo-Annahme'),
    (i_zitr, 'Zitrone', 'Früchte', NULL, 1, 'piece', 0.7, 'piece', false, 'estimated', 'ai_estimate', 'Demo-Annahme')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.dishes (id, menu_card_id, category_id, name, description, sort_order, notes, source_type)
  VALUES (v_dish, v_card, v_cat, 'Kundelfinger Forellenfilets «Müllerin»', 'Petersilienkartoffeln. Mandelbutter.', 10,
          'Demo-Kalkulation: Alle Preise und Mengen sind Annahmen und nicht geprüft.', 'manual')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.variants (id, dish_id, name, gross_price, is_default, calculation_status, notes)
  VALUES
    (v_normal, v_dish, 'Normal', 44, true, 'estimated', 'Demo-Annahme'),
    (v_klein, v_dish, 'Klein', 40, false, 'estimated', 'Demo-Annahme')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.calculation_items (variant_id, ingredient_id, component_group, net_quantity, quantity_unit, yield_percent, sort_order, quantity_source, quantity_confirmed)
  SELECT * FROM (VALUES
    (v_normal, i_forelle, 'main', 250::numeric, 'g'::public.base_unit, 100::numeric, 1, 'ai_estimate'::public.quantity_source, false),
    (v_normal, i_kart, 'side', 200, 'g', 100, 2, 'ai_estimate', false),
    (v_normal, i_butter, 'sauce', 35, 'g', 100, 3, 'ai_estimate', false),
    (v_normal, i_mandel, 'sauce', 20, 'g', 100, 4, 'ai_estimate', false),
    (v_normal, i_peter, 'garnish', 5, 'g', 100, 5, 'ai_estimate', false),
    (v_normal, i_zitr, 'garnish', 0.2, 'piece', 100, 6, 'ai_estimate', false),
    (v_klein, i_forelle, 'main', 180, 'g', 100, 1, 'ai_estimate', false),
    (v_klein, i_kart, 'side', 160, 'g', 100, 2, 'ai_estimate', false),
    (v_klein, i_butter, 'sauce', 30, 'g', 100, 3, 'ai_estimate', false),
    (v_klein, i_mandel, 'sauce', 15, 'g', 100, 4, 'ai_estimate', false),
    (v_klein, i_peter, 'garnish', 4, 'g', 100, 5, 'ai_estimate', false),
    (v_klein, i_zitr, 'garnish', 0.15, 'piece', 100, 6, 'ai_estimate', false)
  ) AS t(variant_id, ingredient_id, component_group, net_quantity, quantity_unit, yield_percent, sort_order, quantity_source, quantity_confirmed)
  WHERE NOT EXISTS (SELECT 1 FROM public.calculation_items ci WHERE ci.variant_id = t.variant_id);
END $$;