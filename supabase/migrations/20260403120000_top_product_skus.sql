-- Top de productos por país (hasta 50 SKUs). El catálogo completo viene de MySQL/API;
-- aquí solo se define el orden de prioridad para la pantalla principal.

CREATE TABLE public.top_product_skus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL CHECK (country_code IN ('MX', 'HN', 'BZ', 'SV')),
  sku text NOT NULL,
  rank smallint NOT NULL CHECK (rank >= 1 AND rank <= 50),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, sku),
  UNIQUE (country_code, rank)
);

CREATE INDEX idx_top_skus_country_rank ON public.top_product_skus (country_code, rank);

ALTER TABLE public.top_product_skus ENABLE ROW LEVEL SECURITY;

-- Sin sesión: lectura del top (solo filtra por país en la app).
CREATE POLICY "top_skus_select_anon"
  ON public.top_product_skus FOR SELECT
  TO anon
  USING (true);

-- Con sesión: mismo país que el perfil o admin.
CREATE POLICY "top_skus_select_authenticated"
  ON public.top_product_skus FOR SELECT
  TO authenticated
  USING (
    public.is_profile_admin()
    OR (
      public.profile_country_code() IS NOT NULL
      AND country_code = public.profile_country_code()
    )
  );

-- Mantener el top solo admins (SQL Editor con service_role también puede).
CREATE POLICY "top_skus_insert_admin"
  ON public.top_product_skus FOR INSERT
  TO authenticated
  WITH CHECK (public.is_profile_admin());

CREATE POLICY "top_skus_update_admin"
  ON public.top_product_skus FOR UPDATE
  TO authenticated
  USING (public.is_profile_admin())
  WITH CHECK (public.is_profile_admin());

CREATE POLICY "top_skus_delete_admin"
  ON public.top_product_skus FOR DELETE
  TO authenticated
  USING (public.is_profile_admin());

-- Ejemplo (ajusta SKUs reales; rank 1 = primero en la lista):
-- INSERT INTO public.top_product_skus (country_code, sku, rank) VALUES
--   ('MX', 'TU-SKU-001', 1),
--   ('MX', 'TU-SKU-002', 2);
