# Cross Sell Creator (PDV)

Aplicación web interna para **definir y validar recomendaciones de venta cruzada** en punto de venta.

Este proyecto parte del prompt en `PromptOG.md` y está pensado como herramienta operativa (rápida y simple), no como producto enterprise.

**Documentación:** [docs/PROYECTO.md](docs/PROYECTO.md) (visión, MySQL + Supabase, multi‑país). **Plan técnico:** [docs/PLAN.md](docs/PLAN.md). **Qué debes configurar tú (env, Supabase, API, Vercel):** [docs/CONFIGURACION.md](docs/CONFIGURACION.md).

## Objetivo de negocio

Permitir que equipos comerciales/asesoría:

- revisen productos top de tienda;
- seleccionen un producto base;
- armen recomendaciones de venta cruzada (3-4 ideal);
- validen que las combinaciones tengan sentido comercial.

Modelo de venta por soluciones con 4 componentes:

- Preparado de superficie
- Acabado
- Herramientas / utensilios
- Protección y limpieza

## Estado actual

La aplicación implementa el flujo principal:

- **Home (`/`)**: selector (Pintacomex / Gallco / HN / BZ / SV), lista top, búsqueda, progreso.
- **Detalle (`/producto/:sku`)**: detalle y editor de recomendaciones (SKU en la URL, codificado).
- **Login (`/login`)** con `employee_number` + `password_hash` en `profiles` (sin Supabase Auth).
- **Reglas básicas**: máximo 4 recomendaciones, sin duplicados, sin auto-recomendación.
- **Datos**:
  - **Catálogo:** `GET` a `VITE_CATALOG_API_URL` + `/api/products?country=XX` si defines la variable; si no, **mock** (`src/data/mockData.ts`).
- **Recomendaciones guardadas:** tabla `cross_sell_recommendations` en Supabase vía RPC (`app_list_recommendations`, `app_add_recommendation`, `app_remove_recommendation`) para no depender de `supabase.auth`.
- Ejecuta migraciones base + auth propio:
  - [`supabase/migrations/20260401120000_cross_sell_recommendations_sku_and_profiles.sql`](supabase/migrations/20260401120000_cross_sell_recommendations_sku_and_profiles.sql)
  - [`supabase/migrations/20260414110000_profiles_password_hash.sql`](supabase/migrations/20260414110000_profiles_password_hash.sql)
  - [`supabase/migrations/20260414123000_cross_sell_recommendations_rpc.sql`](supabase/migrations/20260414123000_cross_sell_recommendations_rpc.sql)

Archivos clave: `src/context/ProductCatalogContext.tsx`, `src/context/AuthContext.tsx`, `src/lib/catalogApi.ts`, `src/pages/`, `src/lib/supabase.ts`, `supabase/migrations/`.

## Stack técnico

- React + TypeScript + Vite
- React Router
- Tailwind + componentes UI (shadcn)
- Vitest (tests unitarios básicos)
- Playwright (config listo para e2e)

## Probar localmente

### 1) Requisitos

- Node.js 18+ (recomendado 20+)
- npm 9+

### 2) Instalar dependencias

```bash
npm install
```

### 3) Levantar entorno dev

```bash
npm run dev
```

Abrir la URL que muestra Vite (normalmente `http://localhost:5173`).

### 4) Build de producción local

```bash
npm run build
npm run preview
```

### 5) Calidad y pruebas

```bash
npm run lint
npm run test
```

Modo watch para tests:

```bash
npm run test:watch
```

## Flujo funcional esperado

1. Entrar al home y buscar/filtrar un producto top.
2. Abrir detalle del producto.
3. Agregar recomendaciones desde buscador/autocomplete.
4. Eliminar recomendaciones si hace falta.
5. Volver al home y revisar progreso (pendiente/parcial/listo).

## Próxima etapa: Vercel + evolución multi‑mercado

- Frontend en Vercel (u otro host estático).
- Supabase: catálogo por país y recomendaciones por RPC (sin Supabase Auth).
- Opcional: **sincronización desde MySQL** hacia Supabase para semillas o catálogo sin exponer MySQL al navegador.

### Objetivo técnico (resumen)

- Despliegue del build Vite.
- Persistencia en Supabase (ya integrada en desarrollo).
- Ampliación **MX / HN / BZ / SV**: modelo `country_code` y UI con selector de país (pendiente de implementar).

### Propuesta de modelo de datos inicial (Supabase)

**Tabla `products`** (ver migración en `supabase/migrations/`; puede incluir `component_category` u otras columnas no usadas aún en la UI)

- `id` (uuid, pk)
- `sku` (text; en multi‑país suele ser unique junto con `country_code`)
- `name` (text)
- `is_top` (boolean)
- `rank` (int, nullable)
- campos opcionales: `product_line`, `brand`, `pahl`, etc.

**Tabla `product_recommendations`**

- `id` (uuid, pk)
- `product_id` (uuid, fk -> `products.id`)
- `recommended_product_id` (uuid, fk -> `products.id`)
- `created_at`

Restricciones recomendadas:

- índice único compuesto (`product_id`, `recommended_product_id`) para evitar duplicados;
- check para bloquear autorreferencia (`product_id != recommended_product_id`);
- validación de máximo 4 recomendaciones por producto (vía trigger o función RPC).

### Evolución de código (pendiente / parcial)

1. ~~Cliente Supabase (`src/lib/supabase.ts`).~~ Hecho.
2. ~~Catálogo por API + recomendaciones en Supabase + multi‑país + Auth.~~ Ver `docs/PLAN.md`.
3. **Siguiente en tu entorno:** API MySQL real, CORS, y ejecutar migraciones SQL en Supabase.

### Conexión a Supabase (local)

En el dashboard aparecen **Publishable** y **Secret**. En esta app (React en el navegador) solo va la **clave pública**:

- **Publishable** (nuevo formato, p. ej. `sb_publishable_...`) → puedes usar `VITE_SUPABASE_PUBLISHABLE_KEY`, o
- **anon** (legacy, JWT largo) → `VITE_SUPABASE_ANON_KEY`.

**No uses la secret key ni `service_role` en `VITE_*`**: Vite las incrusta en el cliente y cualquiera podría leerlas. La secret es solo para backend, scripts en servidor o Edge Functions con cuidado.

1. En [Supabase](https://supabase.com): tu proyecto → **Project Settings** → **API** / **API Keys**.
2. Copia **Project URL** → `VITE_SUPABASE_URL`.
3. Copia la clave **publishable** o **anon** → `VITE_SUPABASE_PUBLISHABLE_KEY` o `VITE_SUPABASE_ANON_KEY` (el código acepta cualquiera de las dos).
4. En la raíz del repo:

   ```bash
   copy .env.example .env.local
   ```

   (En PowerShell puedes usar `Copy-Item .env.example .env.local`.)

5. Edita `.env.local` y pega las dos variables.
6. Reinicia el servidor (`npm run dev`). Vite solo lee `.env*` al arrancar.

En código, importa el cliente desde `src/lib/supabase.ts`:

- `supabase` — instancia lista si hay URL y clave pública; si no, `null`.
- `isSupabaseConfigured()` — comprobar antes de usar datos remotos.
- `requireSupabase()` — lanza si aún no configuraste entorno (útil al migrar el store).

Esquema SQL aplicable: `supabase/migrations/20260331140000_initial_products_and_recommendations.sql`.

### Variables de entorno (local y Vercel)

| Variable | Uso |
|----------|-----|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` o `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave pública (nunca la secret) |
| `VITE_CATALOG_API_URL` | Base del API que expone `GET /api/products?country=PC` (u otro código; opcional; sin ella se usa mock) |

En Vercel: **Settings → Environment Variables**. El backend del catálogo debe permitir **CORS** desde el dominio del front.

### Deploy con Vercel (cuando toque)

1. Subir repo a GitHub.
2. Importar proyecto en Vercel.
3. Build command: `npm run build`
4. Output directory: `dist`
5. Agregar variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
6. Deploy.

## Roadmap sugerido

- **Hecho / estable:** flujo PDV + Supabase opcional + mapeo Excel → columnas.
- **Siguiente:** multi‑país (top 50 × 4), usuarios (Supabase Auth), sync opcional MySQL → Supabase.
- **Despliegue:** Vercel + variables de entorno.
- **Mejoras:** exportación, métricas, reglas de variedad por componente.

## Notas de alcance

- Mantener simplicidad y velocidad de uso.
- Evitar sobre-ingeniería.
- Priorizar validación comercial por encima de complejidad técnica.
