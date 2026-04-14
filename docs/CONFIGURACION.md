# Configuración que debes hacer tú

Guía única de todo lo que **no viene en el código** y debes preparar en tu entorno: variables, Supabase, base de datos, API de catálogo y despliegue.

---

## 1. Resumen rápido

| Dónde | Qué configurar |
|--------|----------------|
| Archivo **`.env.local`** (raíz del repo) | Claves de Supabase (`VITE_*`) y MySQL **sin** `VITE_` para el catálogo local |
| **Supabase** (dashboard) | Proyecto y ejecutar **SQL de migraciones** (`profiles` + hash + RPC) |
| **Vercel** | Variables `VITE_*` del front + variables **de servidor** para MySQL (sin `VITE_`, ver §4) |
| **MySQL** | Debe aceptar conexiones desde internet si Vercel habla con tu servidor (firewall / host permitido) |

**Importante:** Vite solo expone al navegador variables que empiezan por `VITE_`. Usuario y contraseña de MySQL van en variables **sin** ese prefijo (en Vercel o en `.env.local` para `server/dev-api.ts`), nunca como `VITE_MYSQL_*`.

---

## 2. Variables de entorno (local)

1. Copia [`.env.example`](../.env.example) a **`.env.local`** en la raíz del proyecto (junto a `package.json`).
2. Rellena los valores. **Reinicia** `npm run dev` después de cambiar el archivo.

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `VITE_SUPABASE_URL` | Sí, si quieres login y guardar recomendaciones en Supabase | URL del proyecto: Supabase → **Project Settings** → **API** → **Project URL** |
| `VITE_SUPABASE_ANON_KEY` o `VITE_SUPABASE_PUBLISHABLE_KEY` | Igual que arriba | Clave **pública**: **anon** (JWT) o **publishable** (`sb_publishable_...`). **No** uses la *secret* ni `service_role` aquí. |
| `VITE_CATALOG_API_URL` | No | Solo si el catálogo está en **otro** dominio. Si la omites: en **producción** → `/api/products` en Vercel; en **desarrollo** → Vite proxifica a `server/dev-api.ts` (`npm run dev`). |
| `VITE_CATALOG_USE_MOCK` | No | Pon `true` para catálogo mock sin MySQL (p. ej. `npm run dev:client`). |
| `VITE_CATALOG_SEARCH_CACHE_TTL_MS` | No | Caché en el navegador de búsquedas `?q=` (ms; por defecto 300000 = 5 min; `0` = sin caché). |
| `VITE_CATALOG_SEARCH_LOG` | No | `true` = en producción también escribe en consola `[catalog search]` (tiempos y aciertos de caché). En `npm run dev` ya se loguea. |

Ejemplo mínimo (valores ficticios):

```env
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
# VITE_CATALOG_API_URL=https://tu-api.com
```

- **`.env.local`** suele estar en `.gitignore`; no subas secretos al repositorio.
- Si usas **PowerShell** y `npm` falla por políticas de ejecución, usa CMD o `npm.cmd` (ver [README](../README.md)).

---

## 3. Supabase

### 3.1 Crear proyecto

1. Entra en [supabase.com](https://supabase.com) y crea un proyecto.
2. Anota **URL** y clave **anon** / **publishable** para `.env.local`.

### 3.2 Autenticación (actual)

La app actual **no usa Supabase Auth**.  
El login se valida contra `public.profiles` usando:

- `employee_number`
- `password_salt`
- `password_hash`
- función RPC `app_login_simple(...)`

### 3.3 Base de datos (migraciones SQL)

Ejecuta el SQL en el orden indicado ( **SQL Editor** → nuevo script → pegar → Run):

1. Opcional / legado: [`supabase/migrations/20260331140000_initial_products_and_recommendations.sql`](../supabase/migrations/20260331140000_initial_products_and_recommendations.sql) — catálogo antiguo en Postgres; **la app actual no depende** de esta tabla para el listado si usas API o mock.
2. **Obligatoria para la app actual:** [`supabase/migrations/20260401120000_cross_sell_recommendations_sku_and_profiles.sql`](../supabase/migrations/20260401120000_cross_sell_recommendations_sku_and_profiles.sql) — crea `profiles`, `cross_sell_recommendations`, triggers y **RLS**.

3. **Top 50 en pantalla principal:** [`supabase/migrations/20260403120000_top_product_skus.sql`](../supabase/migrations/20260403120000_top_product_skus.sql) — tabla `top_product_skus`. La lista larga (~8000+) sigue viniendo de **MySQL**; el “top” es esta tabla en Supabase.

4. **Pintacomex + Gallco y nombre en el top:** [`supabase/migrations/20260404140000_pc_gc_display_name.sql`](../supabase/migrations/20260404140000_pc_gc_display_name.sql) — sustituye el código único `MX` por **PC** (Pintacomex) y **GC** (Gallco), añade columna **`display_name`**, y migra datos antiguos `MX` → `PC`.

   - Seeds generados desde tus Excel en Descargas (50 filas + `display_name`):  
     `seed_top50_pintacomex_pc.sql`, `seed_top50_gallco_gc.sql`, `seed_top50_belice_bz.sql`, `seed_top50_honduras_hn.sql`, `seed_top50_el_salvador_sv.sql`.  
     Para **regenerarlos** tras cambiar un Excel: `python scripts/generate_all_top50_seeds.py` (lee `~/Downloads/Top 50 Pinta.xlsx`, etc.).
   - Un solo archivo: `python scripts/xlsx-to-top-skus-sql.py "ruta/archivo.xlsx" PC` (o `GC`, `HN`, `BZ`, `SV`). Columna A = CveAsoc, B = Descrip.

5. **Recomendaciones por usuario:** [`supabase/migrations/20260405120000_cross_sell_per_user.sql`](../supabase/migrations/20260405120000_cross_sell_per_user.sql) — unicidad y RLS por `user_id`; elimina filas sin usuario.

6. **Número de empleado en perfil:** [`supabase/migrations/20260406120000_profiles_employee_number.sql`](../supabase/migrations/20260406120000_profiles_employee_number.sql) — columna `employee_number` e índice único.
7. **Password hash en `profiles`:** [`supabase/migrations/20260414110000_profiles_password_hash.sql`](../supabase/migrations/20260414110000_profiles_password_hash.sql)
8. **RPC para recomendaciones sin Supabase Auth:** [`supabase/migrations/20260414123000_cross_sell_recommendations_rpc.sql`](../supabase/migrations/20260414123000_cross_sell_recommendations_rpc.sql)

Si la migración `20260401120000` no está aplicada, fallarán el guardado de recomendaciones y el flujo de perfil.

### 3.4 Alta de usuarios (solo administrador en Supabase)

1. Inserta fila en `profiles` con `id` (uuid), `country_code`, `role`, `employee_number`.
2. Define contraseña con `public.set_profile_password(employee_number, password)`.
3. Prueba login con `public.app_login_simple(employee_number, password)`.

---

## 4. API de catálogo (MySQL en Vercel)

El repo incluye una **función serverless** [`api/products.ts`](../api/products.ts) desplegada en Vercel como:

```http
GET /api/products?country=PC
```

`country` es uno de: **`PC`** (Pintacomex), **`GC`** (Gallco), `HN`, `BZ`, `SV`. La función elige la base MySQL (`MYSQL_DB_PC`, `MYSQL_DB_GC`, etc.).

### 4.1 Variables de entorno (servidor, **sin** `VITE_`)

Configúralas en **Vercel → Settings → Environment Variables** y en **`.env.local`** para probar en local con `npm run dev`:

| Variable | Descripción |
|----------|-------------|
| `MYSQL_HOST` | Host del servidor MySQL |
| `MYSQL_PORT` | Puerto (ej. `6490`) |
| `MYSQL_USER` | Usuario |
| `MYSQL_PASSWORD` | Contraseña |
| `MYSQL_DB_PC` | Base **Pintacomex** (ej. `pubpinta`; si falta, se usa `MYSQL_DB_MX`) |
| `MYSQL_DB_GC` | Base **Gallco** |
| `MYSQL_DB_HN` | Honduras |
| `MYSQL_DB_BZ` | Belice |
| `MYSQL_DB_SV` | El Salvador |
| `PRODUCTOS_TABLE` | Tabla (por defecto `producto`) |
| `PRODUCTOS_ID_COL` | Columna código (por defecto `CveAsoc`) |
| `PRODUCTOS_NOMBRE_COL` | Columna nombre (por defecto `DescripLar`) |
| `PRODUCTOS_ACTIVO_COL` | Columna “solo vigentes” (por defecto `IdCanRefLista`); solo se incluyen filas con valor **0**; ≠0 = descontinuado |
| `CATALOG_QUERY_LIMIT` | Opcional; máximo de filas al cargar el listado inicial (por defecto `8000`, máx. `20000`) |
| `CATALOG_SEARCH_LIMIT` | Opcional; máximo de filas en búsqueda `?q=` para recomendaciones (por defecto `150`, máx. `500`) |

El front **no** necesita `VITE_CATALOG_API_URL` si despliegas solo en Vercel: en producción usará la misma URL y `/api/products`.

**Red:** el servidor MySQL debe permitir conexiones entrantes desde los rangos que use Vercel (IPs dinámicas). Suele hacer falta abrir el puerto al público o usar un túnel/VPN según tu infraestructura.

### 4.2 Desarrollo local (sin cuenta Vercel)

- **`npm run dev`**: arranca **Vite** y **`server/dev-api.ts`** (Node). El navegador pide `GET /api/products` al mismo origen; Vite **reenvía** `/api` al puerto local (por defecto **8787**). Rellena las variables `MYSQL_*` del §4.1 en `.env.local` (y Supabase con `VITE_*`). **No hace falta** `vercel link` ni subir nada.
- **`npm run dev:client`**: solo Vite, catálogo **mock** (rápido para maquetar).
- **`npm run dev:vercel`**: opcional; usa la CLI de Vercel si quieres imitar su runtime (puede pedir login/proyecto).
- **`VITE_CATALOG_API_URL`**: útil para apuntar a un despliegue ya publicado sin levantar MySQL en tu PC.

### 4.3 API externo (opcional)

Si prefieres otro servidor, define `VITE_CATALOG_API_URL` con la base URL y expón `GET /api/products?country=…`. El formato JSON esperado está en [`src/lib/catalogApi.ts`](../src/lib/catalogApi.ts) (`CveAsoc`, `Descrip`, etc.). En ese caso tu backend debe enviar **CORS** si el dominio del front es distinto.

---

## 5. Vercel (o similar)

1. Conecta el repositorio e importa el proyecto.
2. **Build command:** `npm run build`
3. **Output directory:** `dist`
4. **Environment variables:** las `VITE_*` de Supabase como en local, **más** las de MySQL de la tabla del §4.1 (sin `VITE_`).
5. Vuelve a desplegar tras cambiar variables.

Con el API incluido en el mismo proyecto, el catálogo y el front comparten origen: **no hace falta CORS** para `/api/products`.

---

## 6. Flujo recomendado para probar

1. Configura `.env.local` con Supabase → `npm run dev`.
2. Ejecuta las migraciones en Supabase (al menos `20260401120000`, `20260403120000`, `20260404140000`) y el seed del top si aplica.
3. Crea usuario en **Authentication** → **Users**, inserta su fila en **`profiles`** (SQL o plantilla en `supabase/admin_insert_profile_template.sql`), entra en `/login`.
4. Prueba lista y recomendaciones; comprueba errores en consola del navegador y en **Logs** de Supabase si hay 401/403 (RLS).
5. Añade `MYSQL_*` en `.env.local` (§4.1) y comprueba el catálogo con `npm run dev`; en producción, las mismas variables van en Vercel.

---

## 7. Problemas frecuentes

| Síntoma | Qué revisar |
|---------|-------------|
| Variables no cargan | Reiniciar el servidor de Vite tras editar `.env.local`. |
| Error al guardar recomendaciones | Migración `cross_sell_recommendations` aplicada; usuario con **perfil** (`profiles`); país del perfil = país de la fila (la app sincroniza país con el perfil). |
| `permission denied` / RLS | Sesión iniciada; políticas de la migración; perfil creado. |
| Catálogo vacío / error al cargar | En local: `MYSQL_*` en `.env.local`; que corran **los dos** procesos (`npm run dev`). En producción: variables en Vercel; CORS solo si usas `VITE_CATALOG_API_URL` en otro dominio. |
| Login no envía email | Ajustes de Auth en Supabase (confirmación de email, plantillas). |

---

## 8. Documentación relacionada

- Visión del producto: [PROYECTO.md](PROYECTO.md)
- Plan técnico y estado: [PLAN.md](PLAN.md)
- Variables de ejemplo: [`.env.example`](../.env.example)
