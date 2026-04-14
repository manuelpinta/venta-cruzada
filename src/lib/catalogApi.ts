import type { CountryCode } from "@/data/countries";
import type { Product } from "@/data/types";
import {
  catalogSearchCacheGet,
  catalogSearchCacheKey,
  catalogSearchCacheSet,
} from "@/lib/catalogSearchCache";

function shouldLogCatalogSearch(): boolean {
  return (
    import.meta.env.DEV || import.meta.env.VITE_CATALOG_SEARCH_LOG === "true"
  );
}

function firstNonEmpty(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function mapRow(row: Record<string, unknown>, fallbackCountry: CountryCode): Product {
  // Mínimo útil desde MySQL/API: CveAsoc (código) + DescripLar (nombre). También sku/name habituales.
  const skuField = import.meta.env.VITE_CATALOG_SKU_FIELD?.trim();
  const nameField = import.meta.env.VITE_CATALOG_NAME_FIELD?.trim();
  const sku = firstNonEmpty(row, [
    ...(skuField ? [skuField] : []),
    "sku",
    "SKU",
    "CveAsoc",
    "id",
  ]);
  const cc = String(row.country_code ?? row.countryCode ?? fallbackCountry).toUpperCase();
  const countryCode = (["PC", "GC", "HN", "BZ", "SV"].includes(cc) ? cc : fallbackCountry) as CountryCode;
  const name = firstNonEmpty(row, [
    ...(nameField ? [nameField] : []),
    "name",
    "nombre",
    "DescripLar",
  ]);
  return {
    id: sku,
    sku,
    countryCode,
    name,
    // Sin is_top en el API (MySQL mínimo), no marcar todo como "top" → evita listar miles en la home.
    isTop: row.is_top !== undefined ? Boolean(row.is_top) : row.isTop !== undefined ? Boolean(row.isTop) : false,
    rank: row.rank != null && row.rank !== "" ? Number(row.rank) : undefined,
    productLine: row.product_line != null ? String(row.product_line) : row.productLine != null ? String(row.productLine) : undefined,
    brand: row.brand != null ? String(row.brand) : undefined,
    pahl: row.pahl != null ? String(row.pahl) : undefined,
  };
}

function parseCatalogResponse(data: unknown, country: CountryCode): Product[] {
  const arr: unknown[] = Array.isArray(data)
    ? data
    : data && typeof data === "object" && "products" in data
      ? (data as { products: unknown[] }).products
      : data && typeof data === "object" && "data" in data
        ? (data as { data: unknown[] }).data
        : [];

  const mapped = arr.map((item) => mapRow(item as Record<string, unknown>, country));
  const seen = new Set<string>();
  const out: Product[] = [];
  for (const p of mapped) {
    const k = p.sku.trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

/**
 * Resuelve la base del API de catálogo.
 * - `VITE_CATALOG_API_URL`: otro dominio (p. ej. preview en Vercel).
 * - Producción sin URL explícita: mismo origen → `/api/products` (Vercel).
 * - Desarrollo sin mock: mismo origen → Vite proxifica a `server/dev-api.ts` (`npm run dev`).
 */
function resolveCatalogApiBase(): string {
  const explicit = import.meta.env.VITE_CATALOG_API_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (import.meta.env.PROD) return "";
  return "";
}

/**
 * GET catálogo: `GET /api/products?country=…` (o mock si no hay API configurada).
 */
export async function fetchCatalog(country: CountryCode): Promise<Product[]> {
  const base = resolveCatalogApiBase();

  const url =
    base === ""
      ? `/api/products?country=${encodeURIComponent(country)}`
      : `${base}/api/products?country=${encodeURIComponent(country)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    let details = "";
    try {
      const payload = (await res.json()) as { error?: unknown };
      if (payload?.error != null) details = String(payload.error);
    } catch {
      // ignore body parse errors
    }
    const suffix = details || res.statusText || "Error desconocido";
    throw new Error(`Catálogo (${res.status}): ${suffix}`);
  }

  const data: unknown = await res.json();
  return parseCatalogResponse(data, country);
}

/**
 * Búsqueda en servidor (`GET /api/products?country=&q=`) para recomendaciones cuando el catálogo
 * cargado en memoria no incluye todas las filas de MySQL.
 */
export async function fetchCatalogSearch(country: CountryCode, query: string): Promise<Product[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const cacheKey = catalogSearchCacheKey(country, q);
  const cached = catalogSearchCacheGet(cacheKey);
  if (cached) {
    if (shouldLogCatalogSearch()) {
      console.log("[catalog search]", {
        country,
        q,
        cached: true,
        ms: 0,
        results: cached.length,
      });
    }
    return cached;
  }

  const t0 = typeof performance !== "undefined" ? performance.now() : 0;

  const base = resolveCatalogApiBase();
  let out: Product[];

  const url =
    base === ""
      ? `/api/products?country=${encodeURIComponent(country)}&q=${encodeURIComponent(q)}`
      : `${base}/api/products?country=${encodeURIComponent(country)}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    let details = "";
    try {
      const payload = (await res.json()) as { error?: unknown };
      if (payload?.error != null) details = String(payload.error);
    } catch {
      // ignore body parse errors
    }
    const suffix = details || res.statusText || "Error desconocido";
    throw new Error(`Búsqueda catálogo (${res.status}): ${suffix}`);
  }
  const data: unknown = await res.json();
  out = parseCatalogResponse(data, country);

  catalogSearchCacheSet(cacheKey, out);

  if (shouldLogCatalogSearch()) {
    const ms =
      typeof performance !== "undefined" ? Math.round(performance.now() - t0) : 0;
    console.log("[catalog search]", {
      country,
      q,
      cached: false,
      ms,
      results: out.length,
    });
  }

  return out;
}
