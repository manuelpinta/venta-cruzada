-- Recomendaciones por usuario: cada editor tiene su propio conjunto (mismo país, distintos user_id).
-- Elimina filas huérfanas sin user_id (no se pueden atribuir a nadie).
-- Ajusta unicidad, trigger máx. 4 y RLS.

DROP TRIGGER IF EXISTS trg_cross_sell_max_four ON public.cross_sell_recommendations;

DELETE FROM public.cross_sell_recommendations WHERE user_id IS NULL;

ALTER TABLE public.cross_sell_recommendations
  DROP CONSTRAINT IF EXISTS cross_sell_recommendations_user_id_fkey;

ALTER TABLE public.cross_sell_recommendations
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.cross_sell_recommendations
  ADD CONSTRAINT cross_sell_recommendations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;

ALTER TABLE public.cross_sell_recommendations DROP CONSTRAINT IF EXISTS cross_sell_pair_unique;

ALTER TABLE public.cross_sell_recommendations
  ADD CONSTRAINT cross_sell_pair_unique UNIQUE (user_id, country_code, base_sku, recommended_sku);

CREATE OR REPLACE FUNCTION public.enforce_max_four_cross_sell()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (
    SELECT count(*)::integer
    FROM public.cross_sell_recommendations
    WHERE country_code = NEW.country_code
      AND base_sku = NEW.base_sku
      AND user_id = NEW.user_id
  ) >= 4 THEN
    RAISE EXCEPTION 'Máximo 4 recomendaciones por producto base';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cross_sell_max_four
  BEFORE INSERT ON public.cross_sell_recommendations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_max_four_cross_sell();

DROP POLICY IF EXISTS "cross_sell_select" ON public.cross_sell_recommendations;
DROP POLICY IF EXISTS "cross_sell_insert" ON public.cross_sell_recommendations;
DROP POLICY IF EXISTS "cross_sell_delete" ON public.cross_sell_recommendations;

CREATE POLICY "cross_sell_select"
  ON public.cross_sell_recommendations FOR SELECT
  TO authenticated
  USING (
    public.is_profile_admin()
    OR (
      user_id = auth.uid()
      AND public.profile_country_code() IS NOT NULL
      AND country_code = public.profile_country_code()
    )
  );

CREATE POLICY "cross_sell_insert"
  ON public.cross_sell_recommendations FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_profile_admin()
    OR (
      user_id = auth.uid()
      AND public.profile_country_code() IS NOT NULL
      AND country_code = public.profile_country_code()
    )
  );

CREATE POLICY "cross_sell_delete"
  ON public.cross_sell_recommendations FOR DELETE
  TO authenticated
  USING (
    public.is_profile_admin()
    OR (
      user_id = auth.uid()
      AND public.profile_country_code() IS NOT NULL
      AND country_code = public.profile_country_code()
    )
  );
