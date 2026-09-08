DO $$
DECLARE
  v_card uuid;
  v_cat_vorspeisen uuid;
  v_cat_fisch uuid;
  v_dish_tatar uuid;
  v_dish_fisch uuid;
  v_var_klein uuid;
  v_var_gross uuid;
  v_var_pommes uuid;
  v_var_fitness uuid;
  v_addon_spirit uuid;
  v_addon_pommes uuid;
  v_note text := 'Demo-Annahme (Schätzung, nicht bestätigt)';
  ing_id uuid;
  r record;
BEGIN
  SELECT id INTO v_card FROM public.menu_cards WHERE is_active = true ORDER BY created_at LIMIT 1;
  IF v_card IS NULL THEN RETURN; END IF;

  -- Ingredients: create only if a same-named ingredient does not exist yet
  FOR r IN SELECT * FROM (VALUES
    ('Rindfleisch','Fleisch',1,'kg',38,'g',false),
    ('Eigelbcrème','Saucen & Dips',1,'kg',8,'g',true),
    ('Pickles','Konserven',1,'kg',7,'g',false),
    ('Röstzwiebeln','Trockenprodukte',1,'kg',14,'g',false),
    ('Toast','Brot & Backwaren',1,'kg',6.5,'g',false),
    ('Butter','Molkerei',1,'kg',12,'g',false),
    ('Cognac / Calvados','Spirituosen',0.7,'l',35,'ml',false),
    ('Pommes frites','Tiefkühlprodukte',1,'kg',5.8,'g',false),
    ('Forellenfilet','Fisch',1,'kg',30,'g',true),
    ('Cidre-Backteig','Eigenproduktion',1,'kg',3,'g',true),
    ('Frittieröl','Öle & Fette',1,'kg',4,'g',false),
    ('Tartarsauce','Saucen & Dips',1,'kg',8,'g',true),
    ('Zitrone','Früchte',1,'piece',0.7,'piece',false),
    ('Blattsalat','Gemüse',1,'kg',8,'g',false),
    ('Hausdressing','Saucen & Dips',1,'l',6,'ml',true),
    ('Gemüse und Garnitur','Gemüse',1,'kg',6,'g',false)
  ) AS t(name, category, pq, pu, pp, bu, own)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.ingredients WHERE lower(name) = lower(r.name)) THEN
      INSERT INTO public.ingredients (name, category, package_quantity, package_unit, package_price, base_unit, is_own_production, price_status, source_type, notes)
      VALUES (r.name, r.category, r.pq, r.pu::public.package_unit, r.pp, r.bu::public.base_unit, r.own, 'estimated', 'ai_estimate', v_note);
    END IF;
  END LOOP;

  -- Categories
  SELECT id INTO v_cat_vorspeisen FROM public.categories WHERE menu_card_id = v_card AND name = 'Vorspeisen' LIMIT 1;
  IF v_cat_vorspeisen IS NULL THEN
    INSERT INTO public.categories (menu_card_id, name, sort_order, is_food) VALUES (v_card, 'Vorspeisen', 0, true) RETURNING id INTO v_cat_vorspeisen;
  END IF;
  SELECT id INTO v_cat_fisch FROM public.categories WHERE menu_card_id = v_card AND name = 'Fisch' LIMIT 1;
  IF v_cat_fisch IS NULL THEN
    INSERT INTO public.categories (menu_card_id, name, sort_order, is_food) VALUES (v_card, 'Fisch', 10, true) RETURNING id INTO v_cat_fisch;
  END IF;

  -- Rindstatar
  IF NOT EXISTS (SELECT 1 FROM public.dishes WHERE menu_card_id = v_card AND name = 'Rindstatar') THEN
    INSERT INTO public.dishes (menu_card_id, category_id, name, description, sort_order, notes, source_type)
    VALUES (v_card, v_cat_vorspeisen, 'Rindstatar', 'Eigelbcrème. Röstzwiebeln. Pickles. Toast.', 0, v_note, 'manual') RETURNING id INTO v_dish_tatar;

    INSERT INTO public.variants (dish_id, name, gross_price, is_default, calculation_status, notes)
    VALUES (v_dish_tatar, 'Klein', 24, false, 'estimated', v_note) RETURNING id INTO v_var_klein;
    INSERT INTO public.variants (dish_id, name, gross_price, is_default, calculation_status, notes)
    VALUES (v_dish_tatar, 'Gross', 36, true, 'estimated', v_note) RETURNING id INTO v_var_gross;

    FOR r IN SELECT * FROM (VALUES
      ('Rindfleisch',100,180,'main',0),('Eigelbcrème',30,45,'garnish',1),('Pickles',30,45,'garnish',2),
      ('Röstzwiebeln',10,15,'garnish',3),('Toast',60,90,'side',4),('Butter',15,20,'side',5)
    ) AS t(name, q_small, q_large, grp, so) LOOP
      SELECT id INTO ing_id FROM public.ingredients WHERE lower(name) = lower(r.name) ORDER BY created_at LIMIT 1;
      INSERT INTO public.calculation_items (variant_id, ingredient_id, component_group, net_quantity, quantity_unit, yield_percent, sort_order, quantity_source, quantity_confirmed, notes)
      VALUES (v_var_klein, ing_id, r.grp, r.q_small, 'g', 100, r.so, 'ai_estimate', false, v_note);
      INSERT INTO public.calculation_items (variant_id, ingredient_id, component_group, net_quantity, quantity_unit, yield_percent, sort_order, quantity_source, quantity_confirmed, notes)
      VALUES (v_var_gross, ing_id, r.grp, r.q_large, 'g', 100, r.so, 'ai_estimate', false, v_note);
    END LOOP;
  ELSE
    SELECT id INTO v_dish_tatar FROM public.dishes WHERE menu_card_id = v_card AND name = 'Rindstatar' LIMIT 1;
  END IF;

  -- Add-on: Spirituose 2 cl
  IF NOT EXISTS (SELECT 1 FROM public.add_ons WHERE menu_card_id = v_card AND name = 'Spirituose 2 cl') THEN
    INSERT INTO public.add_ons (menu_card_id, name, gross_price, calculation_status, notes)
    VALUES (v_card, 'Spirituose 2 cl', 6, 'estimated', v_note) RETURNING id INTO v_addon_spirit;
    SELECT id INTO ing_id FROM public.ingredients WHERE lower(name) = 'cognac / calvados' ORDER BY created_at LIMIT 1;
    INSERT INTO public.calculation_items (add_on_id, ingredient_id, component_group, net_quantity, quantity_unit, yield_percent, sort_order, quantity_source, quantity_confirmed, notes)
    VALUES (v_addon_spirit, ing_id, 'main', 20, 'ml', 100, 0, 'ai_estimate', false, v_note);
    INSERT INTO public.add_on_links (dish_id, add_on_id) VALUES (v_dish_tatar, v_addon_spirit) ON CONFLICT DO NOTHING;
  END IF;

  -- Add-on: Ostschweizer Pommes frites
  IF NOT EXISTS (SELECT 1 FROM public.add_ons WHERE menu_card_id = v_card AND name = 'Ostschweizer Pommes frites') THEN
    INSERT INTO public.add_ons (menu_card_id, name, gross_price, calculation_status, notes)
    VALUES (v_card, 'Ostschweizer Pommes frites', 8, 'estimated', v_note) RETURNING id INTO v_addon_pommes;
    SELECT id INTO ing_id FROM public.ingredients WHERE lower(name) = 'pommes frites' ORDER BY created_at LIMIT 1;
    INSERT INTO public.calculation_items (add_on_id, ingredient_id, component_group, net_quantity, quantity_unit, yield_percent, sort_order, quantity_source, quantity_confirmed, notes)
    VALUES (v_addon_pommes, ing_id, 'side', 180, 'g', 100, 0, 'ai_estimate', false, v_note);
    INSERT INTO public.add_on_links (dish_id, add_on_id) VALUES (v_dish_tatar, v_addon_pommes) ON CONFLICT DO NOTHING;
  END IF;

  -- Fischknusperli
  IF NOT EXISTS (SELECT 1 FROM public.dishes WHERE menu_card_id = v_card AND name = 'Fischknusperli von der Kundelfinger Forelle') THEN
    INSERT INTO public.dishes (menu_card_id, category_id, name, description, sort_order, notes, source_type)
    VALUES (v_card, v_cat_fisch, 'Fischknusperli von der Kundelfinger Forelle', 'Cidre-Backteig. Tartarsauce.', 1, v_note, 'manual') RETURNING id INTO v_dish_fisch;

    INSERT INTO public.variants (dish_id, name, gross_price, is_default, calculation_status, notes)
    VALUES (v_dish_fisch, 'Mit Ostschweizer Pommes frites', 36, true, 'estimated', v_note) RETURNING id INTO v_var_pommes;
    INSERT INTO public.variants (dish_id, name, gross_price, is_default, calculation_status, notes)
    VALUES (v_dish_fisch, 'Als Fitnessteller', 36, false, 'estimated', v_note) RETURNING id INTO v_var_fitness;

    FOR r IN SELECT * FROM (VALUES
      ('Forellenfilet',180,'g','main',0),('Cidre-Backteig',70,'g','preparation',1),('Frittieröl',20,'g','preparation',2),
      ('Tartarsauce',60,'g','sauce',3),('Zitrone',0.15,'piece','garnish',4)
    ) AS t(name, q, unit, grp, so) LOOP
      SELECT id INTO ing_id FROM public.ingredients WHERE lower(name) = lower(r.name) ORDER BY created_at LIMIT 1;
      INSERT INTO public.calculation_items (variant_id, ingredient_id, component_group, net_quantity, quantity_unit, yield_percent, sort_order, quantity_source, quantity_confirmed, notes)
      VALUES (v_var_pommes, ing_id, r.grp, r.q, r.unit::public.base_unit, 100, r.so, 'ai_estimate', false, v_note);
      INSERT INTO public.calculation_items (variant_id, ingredient_id, component_group, net_quantity, quantity_unit, yield_percent, sort_order, quantity_source, quantity_confirmed, notes)
      VALUES (v_var_fitness, ing_id, r.grp, r.q, r.unit::public.base_unit, 100, r.so, 'ai_estimate', false, v_note);
    END LOOP;

    SELECT id INTO ing_id FROM public.ingredients WHERE lower(name) = 'pommes frites' ORDER BY created_at LIMIT 1;
    INSERT INTO public.calculation_items (variant_id, ingredient_id, component_group, net_quantity, quantity_unit, yield_percent, sort_order, quantity_source, quantity_confirmed, notes)
    VALUES (v_var_pommes, ing_id, 'side', 180, 'g', 100, 5, 'ai_estimate', false, v_note);

    FOR r IN SELECT * FROM (VALUES
      ('Blattsalat',180,'g','side',5),('Hausdressing',40,'ml','sauce',6),('Gemüse und Garnitur',80,'g','vegetables',7)
    ) AS t(name, q, unit, grp, so) LOOP
      SELECT id INTO ing_id FROM public.ingredients WHERE lower(name) = lower(r.name) ORDER BY created_at LIMIT 1;
      INSERT INTO public.calculation_items (variant_id, ingredient_id, component_group, net_quantity, quantity_unit, yield_percent, sort_order, quantity_source, quantity_confirmed, notes)
      VALUES (v_var_fitness, ing_id, r.grp, r.q, r.unit::public.base_unit, 100, r.so, 'ai_estimate', false, v_note);
    END LOOP;
  END IF;
END $$;