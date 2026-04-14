-- Cross-sell creator: catálogo top + recomendaciones
--
-- Mapeo sugerido desde Excel → columnas:
--   CveAsoc     → sku
--   DescripIar  → name
--   Línea       → product_line
--   Marca       → brand
--   ranking     → rank
--   PAHL        → pahl (opcional, puede quedar NULL)
--
-- Import CSV en Supabase: Table Editor → products → Insert → Import data from CSV
-- (ajusta nombres de columnas del CSV a los de la tabla, o renombra en Excel antes).
-- Tras importar, puedes rellenar component_category donde aplique (los 4 componentes de negocio).

-- Extensión para gen_random_uuid() (en proyectos nuevos de Supabase suele estar ya)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Categoría de negocio (4 componentes); NULL hasta que lo asignen en app o manualmente
CREATE TYPE public.product_component AS ENUM (
  'preparado',
  'acabado',
  'herramientas',
  'proteccion'
);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL,
  name text NOT NULL,
  product_line text,
  brand text,
  rank integer,
  pahl text,
  component_category public.product_component,
  is_top boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT products_sku_unique UNIQUE (sku)
);

CREATE INDEX idx_products_rank ON public.products (rank) WHERE rank IS NOT NULL;
CREATE INDEX idx_products_is_top ON public.products (is_top) WHERE is_top = true;

CREATE TABLE public.product_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  recommended_product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_recommendations_no_self CHECK (product_id <> recommended_product_id),
  CONSTRAINT product_recommendations_pair_unique UNIQUE (product_id, recommended_product_id)
);

CREATE INDEX idx_product_recommendations_product ON public.product_recommendations (product_id);

CREATE OR REPLACE FUNCTION public.enforce_max_four_recommendations()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (
    SELECT count(*)::integer
    FROM public.product_recommendations
    WHERE product_id = NEW.product_id
  ) >= 4 THEN
    RAISE EXCEPTION 'Máximo 4 recomendaciones por producto base';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_product_recommendations_max_four
  BEFORE INSERT ON public.product_recommendations
  FOR EACH ROW
  EXECUTE PROCEDURE public.enforce_max_four_recommendations();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

-- RLS: ajusta políticas según tu auth (anon + service role, o solo usuarios internos).
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_recommendations ENABLE ROW LEVEL SECURITY;

-- Ejemplo permisivo para herramienta interna (restringe en producción real)
CREATE POLICY "products_select_all"
  ON public.products FOR SELECT
  USING (true);

CREATE POLICY "products_insert_all"
  ON public.products FOR INSERT
  WITH CHECK (true);

CREATE POLICY "products_update_all"
  ON public.products FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "products_delete_all"
  ON public.products FOR DELETE
  USING (true);

CREATE POLICY "product_recommendations_select_all"
  ON public.product_recommendations FOR SELECT
  USING (true);

CREATE POLICY "product_recommendations_insert_all"
  ON public.product_recommendations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "product_recommendations_update_all"
  ON public.product_recommendations FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "product_recommendations_delete_all"
  ON public.product_recommendations FOR DELETE
  USING (true);
