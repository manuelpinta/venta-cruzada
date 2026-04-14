# Cross Sell Creator — Visión del proyecto

Herramienta web interna para **definir y validar recomendaciones de venta cruzada** en punto de venta (PDV). No sustituye al PDV final: sirve para que negocio pruebe combinaciones antes de implementarlas en el sistema transaccional.

**Origen del alcance:** `PromptOG.md` (raíz del repo).

---

## Qué hace la app (flujo)

1. Ver un **catálogo “top”** (productos priorizados por volumen o estrategia).
2. Elegir un **producto base**.
3. Asociar **3–4 productos recomendados** (cross-sell).
4. Validar reglas simples: máximo 4, sin duplicados, sin auto-recomendación.

**Roadmap técnico:** [PLAN.md](PLAN.md) (MySQL + Supabase, países, usuarios).

**Rutas actuales**

| Ruta | Pantalla |
|------|-----------|
| `/` | Lista top + país + búsqueda + progreso |
| `/producto/:sku` | Detalle + editor (SKU en URL) |
| `/login` | `employee_number` + contraseña (hash en `profiles`) |
| `/cuenta-incompleta` | Sin fila en `profiles` (falta alta del administrador) |
| `/completar-empleado` | Falta `employee_number` en `profiles`; el usuario lo ingresa una vez |

**Código relevante**

- `src/context/ProductCatalogContext.tsx` — catálogo (API o mock) + recomendaciones (`cross_sell_recommendations`)
- `src/context/AuthContext.tsx` — sesión local + login contra `profiles` (RPC)
- `src/lib/catalogApi.ts` — `GET` catálogo
- `src/lib/supabase.ts` — cliente browser (clave **pública**)
- `src/pages/`, `src/components/RecommendationEditor.tsx`, `ProductCard.tsx`
- `supabase/migrations/` — incluida `20260401120000_cross_sell_recommendations_sku_and_profiles.sql`

---

## Categorías de negocio (4 componentes)

**No están en la UI actualmente** (se retiraron badges y filtros para simplificar). El modelo del prompt original (preparado / acabado / herramientas / protección) puede volver cuando haga falta; en la migración SQL puede seguir existiendo `component_category` en `products`, pero la app no lo mapea. Ver fase opcional en [PLAN.md](PLAN.md).

---

## Modelo de datos objetivo (lo que comentaste)

Separar bien **dos cosas**:

| Qué | Origen | Rol |
|-----|--------|-----|
| **Lista de productos** (top 50, búsqueda, candidatos para recomendar) | Tu **MySQL** (o API que lo lea) | Solo **lectura** para armar la UI: qué ítems existen y de cuáles se puede elegir al recomendar. |
| **Recomendaciones elegidas por el usuario** | **Supabase** | **Persistencia** cuando alguien guarda/agrega/quita recomendaciones en la app. |

Es decir: el catálogo “sale de ahí” (MySQL); **lo que el usuario confirma en la herramienta se guarda en Supabase** (`product_recommendations`, y metadatos que necesites). No implica duplicar la lógica de negocio en MySQL salvo que más adelante quieras exportar o sincronizar de vuelta.

**Implementación típica:** un endpoint (tu backend) expone productos desde MySQL; el front carga esa lista para home, detalle y autocompletado. Las operaciones **insert/delete** de recomendaciones van al cliente Supabase con RLS y Auth. Los IDs deben ser **estables** (p. ej. mismo `sku` o id de artículo en ambos mundos) para que las FK o la lógica de filas en Supabase tengan sentido.

---

## Datos hoy en el repo: mock vs Supabase

- **Sin variables `VITE_SUPABASE_*`:** mock en `src/data/mockData.ts`.
- **Con Supabase (estado actual del código):** productos **y** recomendaciones se cargan/guardan en Supabase para desarrollo ágil. Migrar al modelo de arriba implica **cambiar la capa de datos** para leer productos desde tu API/MySQL y seguir escribiendo recomendaciones solo en Supabase.

**Import CSV en Supabase:** útil mientras el catálogo viva ahí; si el catálogo pasa a ser solo MySQL, el import sería hacia MySQL o el job que alimente tu API, no necesariamente la tabla `products` de Supabase (salvo que mantengas una réplica mínima para IDs/FKs).

---

## Multi‑país: México, Honduras, Belice, El Salvador

Hoy el esquema de ejemplo asume **un solo mercado** (un top 50 global). Para **top 50 por país** sin mezclar catálogos:

### Opción recomendada (un solo Postgres / Supabase)

1. Tabla `markets` o enum `country_code`: `MX`, `HN`, `BZ`, `SV` (ISO 3166‑1 alpha‑2).
2. En `products`, columna **`country_code`** (NOT NULL).
3. **Quitar** `UNIQUE (sku)` y usar **`UNIQUE (sku, country_code)`** (el mismo código de artículo puede repetirse entre países o significar cosas distintas según negocio).
4. **`rank` / `is_top`** siempre interpretados **dentro del mismo país** (top 50 MX ≠ top 50 HN).
5. `product_recommendations`: las FK apuntan a `products.id`; si cada producto ya es de un solo país, las recomendaciones quedan **implícitamente** en ese país. Si hiciera falta explicitar: columna `country_code` en la tabla de recomendaciones o validación con trigger.

**Excel:** un archivo por país o una hoja con columna `country_code`; import repetido o un solo CSV con la columna rellena.

### UI

- Selector de **país** (persistido en URL `?country=MX` o `/mx/...`) y todas las queries filtradas por `country_code`.

*(Migración SQL aparte: añadir cuando decidan el modelo; no romper producción sin plan de migración de datos.)*

---

## MySQL (lista de productos) + Supabase (recomendaciones guardadas)

Encaja con el modelo objetivo:

- **MySQL:** fuente del **catálogo** (lista top, textos, SKU, país, etc.). La app solo **consulta** (vía API/backend; no exponer MySQL al navegador).
- **Supabase:** **solo** lo que debe persistir cuando un usuario trabaja en la herramienta: filas en `product_recommendations` (y más adelante `user_id`, timestamps, país, etc.).

Patrones de implementación:

| Enfoque | Descripción |
|--------|-------------|
| **API + dos clientes en el front** | `fetch('/api/products')` → MySQL; `supabase.from('product_recommendations')` → lectura/escritura de recomendaciones. Requiere que los **identificadores de producto** coincidan (mismo `sku` / `external_id` en Supabase que en MySQL, o tabla puente). |
| **Réplica ligera en Supabase** | Job copia el catálogo MySQL → tabla `products` en Supabase **solo lectura**; las recomendaciones siguen siendo las únicas escrituras interactivas desde la app. |

**Recomendaciones guardadas:** siempre en **Supabase**. Volver a escribir en MySQL solo si el ERP lo exige (ETL aparte).

---

## Usuarios

La app actual usa auth propio sencillo:

- Login por `employee_number` y `password_hash` en `profiles`.
- Validación con RPC `app_login_simple`.
- Sesión local en navegador.

---

## Despliegue (referencia)

- **Frontend:** Vercel (u otro static host), `npm run build`, salida `dist`.
- **Variables:** `VITE_SUPABASE_URL` + clave pública (anon / publishable).

Detalle en `README.md`.

---

## Resumen de decisiones pendientes

1. ¿El **SKU** (o clave de artículo) es único **por país** o global? → afecta filtros y claves en Supabase.
2. ¿Identificador común entre MySQL y Supabase? → mismo `sku` / `product_id` externo en columnas de `product_recommendations`.
3. ¿Los usuarios ven **un país** o **varios**? → RLS y selector de mercado.

**Aclarado:** las recomendaciones **elegidas en la app** se guardan en **Supabase**; MySQL aporta la **lista** de productos elegibles, no tiene por qué recibir cada clic en tiempo real.
