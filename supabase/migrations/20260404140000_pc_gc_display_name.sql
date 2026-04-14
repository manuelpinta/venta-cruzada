-- México en dos líneas: PC = Pintacomex, GC = Gallco.
-- Añade display_name al top; migra MX → PC.
-- Orden: quitar CHECK → actualizar filas → columna nueva → CHECK nuevo.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_country_code_check;
ALTER TABLE public.cross_sell_recommendations DROP CONSTRAINT IF EXISTS cross_sell_recommendations_country_code_check;
ALTER TABLE public.top_product_skus DROP CONSTRAINT IF EXISTS top_product_skus_country_code_check;

UPDATE public.profiles SET country_code = 'PC' WHERE country_code = 'MX';
UPDATE public.cross_sell_recommendations SET country_code = 'PC' WHERE country_code = 'MX';
UPDATE public.top_product_skus SET country_code = 'PC' WHERE country_code = 'MX';

ALTER TABLE public.top_product_skus
  ADD COLUMN IF NOT EXISTS display_name text;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_country_code_check
  CHECK (country_code IN ('PC', 'GC', 'HN', 'BZ', 'SV'));

ALTER TABLE public.cross_sell_recommendations ADD CONSTRAINT cross_sell_recommendations_country_code_check
  CHECK (country_code IN ('PC', 'GC', 'HN', 'BZ', 'SV'));

ALTER TABLE public.top_product_skus ADD CONSTRAINT top_product_skus_country_code_check
  CHECK (country_code IN ('PC', 'GC', 'HN', 'BZ', 'SV'));

COMMENT ON COLUMN public.top_product_skus.display_name IS 'Nombre mostrado en el top (ej. Descrip del Excel; si falta, catálogo MySQL).';
