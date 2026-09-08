CREATE OR REPLACE FUNCTION public.import_ingredient_rows(_job_id uuid, _payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_job public.import_jobs%ROWTYPE;
  r JSONB;
  v_action TEXT; v_id UUID; v_ok BOOLEAN;
  n_created INT := 0; n_updated INT := 0; n_skipped INT := 0;
  ids UUID[] := '{}';
BEGIN
  SELECT * INTO v_job FROM public.import_jobs WHERE id = _job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Import-Auftrag nicht gefunden.'; END IF;
  IF v_job.import_type <> 'ingredient_excel' OR v_job.status <> 'processing' THEN
    RAISE EXCEPTION 'Dieser Import kann nicht ausgeführt werden.';
  END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(_payload->'rows','[]'::jsonb)) LOOP
    v_action := r->>'action';
    IF v_action = 'skip' THEN n_skipped := n_skipped + 1; CONTINUE; END IF;
    IF (r->>'package_quantity')::numeric <= 0 OR (r->>'package_price')::numeric < 0 THEN
      RAISE EXCEPTION 'Ungültige Menge oder ungültiger Preis in Zeile %.', r->>'row';
    END IF;
    IF v_action = 'create' THEN
      INSERT INTO public.ingredients (name, category, supplier, package_quantity, package_unit, package_label, package_price, base_unit,
          price_date, is_own_production, price_status, source_type, notes, is_active, updated_by)
        VALUES (btrim(r->>'name'), btrim(r->>'category'), NULLIF(btrim(COALESCE(r->>'supplier','')),''),
          (r->>'package_quantity')::numeric, (r->>'package_unit')::public.package_unit, NULLIF(btrim(COALESCE(r->>'package_label','')),''),
          (r->>'package_price')::numeric, (r->>'base_unit')::public.base_unit,
          COALESCE((r->>'price_date')::date, CURRENT_DATE), COALESCE((r->>'is_own_production')::boolean,false),
          'confirmed', 'excel_import', NULLIF(btrim(COALESCE(r->>'notes','')),''), true, auth.uid())
        RETURNING id INTO v_id;
      n_created := n_created + 1;
      ids := ids || v_id;
    ELSIF v_action = 'update' THEN
      v_id := (r->>'ingredient_id')::uuid;
      UPDATE public.ingredients SET
          supplier = COALESCE(NULLIF(btrim(COALESCE(r->>'supplier','')),''), supplier),
          package_quantity = (r->>'package_quantity')::numeric, package_unit = (r->>'package_unit')::public.package_unit,
          package_label = NULLIF(btrim(COALESCE(r->>'package_label','')),''), package_price = (r->>'package_price')::numeric,
          base_unit = (r->>'base_unit')::public.base_unit, price_date = COALESCE((r->>'price_date')::date, CURRENT_DATE),
          is_own_production = COALESCE((r->>'is_own_production')::boolean, is_own_production),
          notes = COALESCE(NULLIF(btrim(COALESCE(r->>'notes','')),''), notes),
          price_status = 'confirmed', source_type = 'excel_import', updated_by = auth.uid()
        WHERE id = v_id;
      GET DIAGNOSTICS v_ok = ROW_COUNT;
      IF NOT v_ok THEN RAISE EXCEPTION 'Zutat für Zeile % wurde nicht gefunden.', r->>'row'; END IF;
      n_updated := n_updated + 1;
      ids := ids || v_id;
    ELSE
      RAISE EXCEPTION 'Unbekannte Aktion in Zeile %.', r->>'row';
    END IF;
  END LOOP;

  UPDATE public.import_jobs SET status = 'confirmed', confirmed_at = now(), confirmed_by = auth.uid(),
    created_count = n_created, updated_count = n_updated, skipped_count = n_skipped, failed_count = 0,
    error_message = NULL, failed_stage = NULL WHERE id = _job_id;

  RETURN jsonb_build_object('created', n_created, 'updated', n_updated, 'skipped', n_skipped, 'ingredient_ids', to_jsonb(ids));
END;
$function$;