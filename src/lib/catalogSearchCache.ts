import type { Product } from "@/data/types";

/**
 * Caché por **texto de búsqueda** (y país): clave `PC:vini` ≠ `PC:vinim`.
 * Guarda el array de productos devuelto por esa consulta; no es un caché del catálogo completo.
 */
type Entry = { at: number; products: Product[] };

const store = new Map<string, Entry>();

function ttlMs(): number {
  const raw = import.meta.env.VITE_CATALOG_SEARCH_CACHE_TTL_MS;
  if (raw != null && raw !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return 5 * 60 * 1000;
}

export function catalogSearchCacheKey(country: string, query: string): string {
  return `${country}:${query.trim().toLowerCase()}`;
}

export function catalogSearchCacheGet(key: string): Product[] | null {
  const ttl = ttlMs();
  if (ttl === 0) return null;
  const e = store.get(key);
  if (!e) return null;
  if (Date.now() - e.at > ttl) {
    store.delete(key);
    return null;
  }
  return e.products;
}

export function catalogSearchCacheSet(key: string, products: Product[]): void {
  if (ttlMs() === 0) return;
  store.set(key, { at: Date.now(), products });
}
