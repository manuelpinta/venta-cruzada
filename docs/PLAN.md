# Plan de implementación (roadmap técnico)

Documento vivo para alinear **catálogo (MySQL vía API)** + **recomendaciones (Supabase)** + **multi‑país** + **usuarios**. Las categorías de 4 componentes siguen **fuera de la UI**.

---

## Estado actual del repo (implementado)

| Área | Estado |
|------|--------|
| Flujo PDV (lista → detalle → 3–4 recomendaciones) | Hecho |
| Catálogo vía `fetch` | [`src/lib/catalogApi.ts`](src/lib/catalogApi.ts) + `VITE_CATALOG_API_URL`; sin URL → mock |
| Multi‑país MX/HN/BZ/SV | Selector en UI + `country_code` en perfil y en filas de recomendaciones |
| Recomendaciones Supabase (modelo A) | Tabla `cross_sell_recommendations` + migración `20260401120000_*.sql` |
| Perfiles + RLS | Tabla `profiles`; políticas en la misma migración |
| Auth | [`src/context/AuthContext.tsx`](src/context/AuthContext.tsx), páginas Login y completar perfil |
| Estado global | [`src/context/ProductCatalogContext.tsx`](src/context/ProductCatalogContext.tsx) (sin pérdida al navegar) |

---

## Pendiente del lado tuyo (operación)

1. **Backend REST** que implemente `GET /api/products?country=XX` leyendo MySQL y devolviendo JSON compatible con [`catalogApi.ts`](src/lib/catalogApi.ts) (`sku`, `name`, `country_code`, `is_top`, `rank`, etc.).
2. **Ejecutar migraciones** en el proyecto Supabase (SQL Editor o CLI), incluida la de `profiles` + `cross_sell_recommendations`.
3. **CORS** del API hacia el origen del front (Vercel o localhost).
4. **Opcional:** migrar datos antiguos de `product_recommendations` (uuid) si los tenías en uso.

---

## Fase opcional (mejoras)

- Reexportar recomendaciones a MySQL/ERP (batch).
- Volver a mostrar categorías de 4 componentes en UI.
- Métricas y exportación CSV.

---

## Referencias

- Visión: [PROYECTO.md](PROYECTO.md)
- Prompt: `PromptOG.md`
- Migraciones: `supabase/migrations/`
