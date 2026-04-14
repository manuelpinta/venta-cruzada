/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  /** Legacy JWT o equivalente; misma función que publishable en cliente */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Clave nueva tipo sb_publishable_... (dashboard → API Keys → publishable) */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Base URL del API que expone GET /api/products?country= (catálogo MySQL). Vacío = mock local. */
  readonly VITE_CATALOG_API_URL?: string;
  /** Opcional: clave JSON del código/SKU si no usas sku/CveAsoc por defecto. */
  readonly VITE_CATALOG_SKU_FIELD?: string;
  /** Opcional: clave JSON del nombre si no usas name/Descrip por defecto. */
  readonly VITE_CATALOG_NAME_FIELD?: string;
  /** ms; TTL caché búsqueda catálogo (default 300000). Pon `0` para desactivar caché. */
  readonly VITE_CATALOG_SEARCH_CACHE_TTL_MS?: string;
  /** `true` = log en consola de búsquedas/tiempos también en producción. */
  readonly VITE_CATALOG_SEARCH_LOG?: string;
  /** URL del portal de soporte / tickets (botón "Contactar a soporte" en cabecera). */
  readonly VITE_SUPPORT_URL?: string;
  /** Compat: misma función que `VITE_SUPPORT_URL` si ya usas convención Next en `.env`. */
  readonly NEXT_PUBLIC_SUPPORT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
