-- Modelo A: recomendaciones por claves naturales (sin FK a products en Postgres).
-- Catálogo vive en MySQL/API; esta tabla solo persiste elecciones del usuario.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  country_code text NOT NULL CHECK (country_code IN ('MX', 'HN', 'BZ', 'SV')),
  role text NOT NULL DEFAULT 'editor' CHECK (role IN ('editor', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_country ON public.profiles (country_code);

CREATE TABLE public.cross_sell_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL CHECK (country_code IN ('MX', 'HN', 'BZ', 'SV')),
  base_sku text NOT NULL,
  recommended_sku text NOT NULL,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cross_sell_no_self CHECK (base_sku <> recommended_sku),
  CONSTRAINT cross_sell_pair_unique UNIQUE (country_code, base_sku, recommended_sku)
);

CREATE INDEX idx_cross_sell_base ON public.cross_sell_recommendations (country_code, base_sku);

CREATE OR REPLACE FUNCTION public.enforce_max_four_cross_sell()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (
    SELECT count(*)::integer
    FROM public.cross_sell_recommendations
    WHERE country_code = NEW.country_code AND base_sku = NEW.base_sku
  ) >= 4 THEN
    RAISE EXCEPTION 'Máximo 4 recomendaciones por producto base';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cross_sell_max_four ON public.cross_sell_recommendations;
CREATE TRIGGER trg_cross_sell_max_four
  BEFORE INSERT ON public.cross_sell_recommendations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_max_four_cross_sell();

CREATE OR REPLACE FUNCTION public.set_profiles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_profiles_updated_at();

-- Evita recursión infinita en RLS: no consultar public.profiles dentro de políticas SOBRE profiles
-- usando un EXISTS directo a la misma tabla con otra política que vuelve a consultar profiles.
CREATE OR REPLACE FUNCTION public.is_profile_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT p.role = 'admin' FROM public.profiles p WHERE p.id = auth.uid()),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.profile_country_code()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p.country_code::text FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1;
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cross_sell_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_select_admin"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_profile_admin());

CREATE POLICY "cross_sell_select"
  ON public.cross_sell_recommendations FOR SELECT
  TO authenticated
  USING (
    public.is_profile_admin()
    OR (
      public.profile_country_code() IS NOT NULL
      AND country_code = public.profile_country_code()
    )
  );

CREATE POLICY "cross_sell_insert"
  ON public.cross_sell_recommendations FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_profile_admin()
    OR (
      public.profile_country_code() IS NOT NULL
      AND country_code = public.profile_country_code()
    )
  );

CREATE POLICY "cross_sell_delete"
  ON public.cross_sell_recommendations FOR DELETE
  TO authenticated
  USING (
    public.is_profile_admin()
    OR (
      public.profile_country_code() IS NOT NULL
      AND country_code = public.profile_country_code()
    )
  );
