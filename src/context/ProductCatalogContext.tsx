import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CountryCode } from "@/data/countries";
import { getStoredCountry, setStoredCountry } from "@/data/countries";
import type { Product, RecommendationGroup } from "@/data/types";
import { fetchCatalog, fetchCatalogSearch } from "@/lib/catalogApi";
import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

function mapInsertError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("máximo 4") || m.includes("maximo 4")) return "Máximo 4 recomendaciones";
  if (m.includes("duplicate") || m.includes("unique")) return "Ya está recomendado";
  if (m.includes("cross_sell_no_self") || m.includes("check constraint"))
    return "No puedes recomendarte a ti mismo";
  return message;
}

function rowsToGroups(
  rows: { base_sku: string; recommended_sku: string }[]
): RecommendationGroup[] {
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const list = map.get(r.base_sku) ?? [];
    list.push(r.recommended_sku);
    map.set(r.base_sku, list);
  }
  return [...map.entries()].map(([baseSku, recommendedSkus]) => ({ baseSku, recommendedSkus }));
}

interface CatalogState {
  countryCode: CountryCode;
  setCountryCode: (c: CountryCode) => void;
  products: Product[];
  topProducts: Product[];
  /** Supabase configurado y la tabla `top_product_skus` no tiene filas para el país (nada que mostrar en home). */
  catalogTopEmpty: boolean;
  loading: boolean;
  error: string | null;
  recommendations: RecommendationGroup[];
  getProduct: (sku: string) => Product | undefined;
  getRecommendations: (baseSku: string) => Product[];
  addRecommendation: (
    baseSku: string,
    recommendedSku: string
  ) => Promise<{ success: boolean; error?: string }>;
  removeRecommendation: (
    baseSku: string,
    recommendedSku: string
  ) => Promise<{ success: boolean; error?: string }>;
  searchProducts: (query: string) => Product[];
  /** Búsqueda contra MySQL vía API (`q=`), para recomendaciones cuando el listado en memoria es parcial. */
  searchProductsRemote: (query: string) => Promise<Product[]>;
  refreshRecommendations: () => Promise<void>;
}

const ProductCatalogContext = createContext<CatalogState | null>(null);

export function ProductCatalogProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  /** Auth propio: usar RPC security definer para persistir en DB sin supabase.auth. */
  const useRemoteRecs = true;

  /** Sin Supabase o sin perfil: selector local (mock / antes de cargar). Con perfil: solo `profile.country_code`. */
  const [localCountry, setLocalCountry] = useState<CountryCode>(getStoredCountry);

  const countryLocked = isSupabaseConfigured() && !!profile?.country_code;
  const countryCode: CountryCode =
    isSupabaseConfigured() && profile?.country_code ? profile.country_code : localCountry;
  const [products, setProducts] = useState<Product[]>([]);
  /** Orden del top 50 en Supabase; `display_name` es el nombre mostrado (columna Descrip / Excel). */
  const [topSkuRows, setTopSkuRows] = useState<
    { sku: string; rank: number; display_name: string | null }[]
  >([]);
  const [topSkuLoading, setTopSkuLoading] = useState(() => isSupabaseConfigured());
  const [recommendations, setRecommendations] = useState<RecommendationGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setCountryCode = useCallback((c: CountryCode) => {
    if (countryLocked) return;
    setStoredCountry(c);
    setLocalCountry(c);
  }, [countryLocked]);

  useEffect(() => {
    if (profile?.country_code) {
      setLocalCountry(profile.country_code);
      setStoredCountry(profile.country_code);
    }
  }, [profile?.country_code]);

  // Catálogo por país
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchCatalog(countryCode)
      .then((list) => {
        if (!cancelled) setProducts(list);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setProducts([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [countryCode]);

  // Top 50 por país desde Supabase (MySQL solo aporta el catálogo completo para búsqueda / nombres).
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setTopSkuRows([]);
      setTopSkuLoading(false);
      return;
    }
    let cancelled = false;
    setTopSkuLoading(true);
    const sb = requireSupabase();
    void sb
      .from("top_product_skus")
      .select("sku, rank, display_name")
      .eq("country_code", countryCode)
      .order("rank", { ascending: true })
      .then(({ data, error: te }) => {
        if (cancelled) return;
        if (te) {
          setError(te.message);
          setTopSkuRows([]);
        } else {
          setTopSkuRows(
            (data ?? []).map((r) => {
              const row = r as { sku: string; rank: number; display_name: string | null };
              return {
                sku: String(row.sku),
                rank: Number(row.rank),
                display_name: row.display_name != null ? String(row.display_name) : null,
              };
            })
          );
        }
        setTopSkuLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [countryCode]);

  const refreshRecommendations = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setRecommendations([]);
      return;
    }
    if (!user || !profile) {
      setRecommendations([]);
      return;
    }
    const sb = requireSupabase();
    const { data, error: re } = await sb.rpc("app_list_recommendations", {
      p_user_id: user.id,
      p_country_code: countryCode,
    });

    if (re) {
      setError(re.message);
      return;
    }
    setRecommendations(rowsToGroups((data ?? []) as { base_sku: string; recommended_sku: string }[]));
  }, [countryCode, user, profile]);

  useEffect(() => {
    void refreshRecommendations();
  }, [refreshRecommendations, user?.id, profile?.id]);

  const productBySku = useMemo(() => {
    const m = new Map<string, Product>();
    for (const p of products) {
      m.set(p.sku, p);
    }
    return m;
  }, [products]);

  const getProduct = useCallback(
    (sku: string): Product | undefined => {
      const key = sku.trim();
      const fromCatalog = productBySku.get(key);
      if (fromCatalog) return fromCatalog;
      // Mismo criterio que el top en home: si el SKU está en Supabase pero no vino en MySQL, igual mostramos detalle.
      if (!isSupabaseConfigured()) return undefined;
      const row = topSkuRows.find((r) => r.sku === key);
      if (!row) return undefined;
      const label = row.display_name?.trim() || key;
      return {
        id: key,
        sku: key,
        countryCode,
        name: label,
        isTop: true,
        rank: row.rank,
      };
    },
    [productBySku, topSkuRows, countryCode]
  );

  const getRecommendations = useCallback(
    (baseSku: string): Product[] => {
      const rec = recommendations.find((r) => r.baseSku === baseSku);
      if (!rec) return [];
      return rec.recommendedSkus
        .map((sku) => productBySku.get(sku))
        .filter(Boolean) as Product[];
    },
    [recommendations, productBySku]
  );

  const addRecommendation = useCallback(
    async (baseSku: string, recommendedSku: string): Promise<{ success: boolean; error?: string }> => {
      if (baseSku === recommendedSku) {
        return { success: false, error: "No puedes recomendarte a ti mismo" };
      }

      const existing = recommendations.find((r) => r.baseSku === baseSku);
      const current = existing?.recommendedSkus ?? [];
      if (current.length >= 4) return { success: false, error: "Máximo 4 recomendaciones" };
      if (current.includes(recommendedSku)) return { success: false, error: "Ya está recomendado" };

      if (!isSupabaseConfigured()) {
        setRecommendations((prev) => {
          const idx = prev.findIndex((r) => r.baseSku === baseSku);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = {
              ...next[idx],
              recommendedSkus: [...next[idx].recommendedSkus, recommendedSku],
            };
            return next;
          }
          return [...prev, { baseSku, recommendedSkus: [recommendedSku] }];
        });
        return { success: true };
      }

      const sb = requireSupabase();
      const { error: ins } = await sb.rpc("app_add_recommendation", {
        p_user_id: user!.id,
        p_country_code: countryCode,
        p_base_sku: baseSku,
        p_recommended_sku: recommendedSku,
      });

      if (ins) {
        return { success: false, error: mapInsertError(ins.message) };
      }

      setRecommendations((prev) => {
        const idx = prev.findIndex((r) => r.baseSku === baseSku);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            recommendedSkus: [...next[idx].recommendedSkus, recommendedSku],
          };
          return next;
        }
        return [...prev, { baseSku, recommendedSkus: [recommendedSku] }];
      });

      return { success: true };
    },
    [recommendations, countryCode, user, profile]
  );

  const removeRecommendation = useCallback(
    async (
      baseSku: string,
      recommendedSku: string
    ): Promise<{ success: boolean; error?: string }> => {
      if (!isSupabaseConfigured()) {
        setRecommendations((prev) =>
          prev
            .map((r) =>
              r.baseSku === baseSku
                ? { ...r, recommendedSkus: r.recommendedSkus.filter((s) => s !== recommendedSku) }
                : r
            )
            .filter((r) => r.recommendedSkus.length > 0)
        );
        return { success: true };
      }

      const sb = requireSupabase();
      const { error: delErr } = await sb.rpc("app_remove_recommendation", {
        p_user_id: user.id,
        p_country_code: countryCode,
        p_base_sku: baseSku,
        p_recommended_sku: recommendedSku,
      });

      if (delErr) {
        return { success: false, error: delErr.message };
      }

      setRecommendations((prev) =>
        prev
          .map((r) =>
            r.baseSku === baseSku
              ? { ...r, recommendedSkus: r.recommendedSkus.filter((s) => s !== recommendedSku) }
              : r
          )
          .filter((r) => r.recommendedSkus.length > 0)
      );
      return { success: true };
    },
    [countryCode, user, profile]
  );

  const searchProducts = useCallback(
    (query: string): Product[] => {
      if (!query.trim()) return [];
      const q = query.toLowerCase();
      return products.filter(
        (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
      );
    },
    [products]
  );

  const searchProductsRemote = useCallback(
    async (query: string): Promise<Product[]> => {
      const q = query.trim();
      if (q.length < 2) return [];
      try {
        return await fetchCatalogSearch(countryCode, q);
      } catch {
        return searchProducts(q);
      }
    },
    [countryCode, searchProducts]
  );

  const topProducts = useMemo(() => {
    if (!isSupabaseConfigured()) {
      return products
        .filter((p) => p.isTop)
        .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
    }
    if (topSkuRows.length === 0) return [];
    return topSkuRows.map((row) => {
      const base = productBySku.get(row.sku);
      const label =
        base?.name?.trim() || row.display_name?.trim() || row.sku;
      if (base) {
        return {
          ...base,
          name: label,
          rank: row.rank,
          isTop: true,
        };
      }
      return {
        id: row.sku,
        sku: row.sku,
        countryCode,
        name: label,
        isTop: true,
        rank: row.rank,
      };
    });
  }, [products, topSkuRows, productBySku, countryCode]);

  const catalogTopEmpty =
    isSupabaseConfigured() && !topSkuLoading && topSkuRows.length === 0;

  const loadingPage = loading || (isSupabaseConfigured() && topSkuLoading);

  const value = useMemo(
    () => ({
      countryCode,
      setCountryCode,
      products,
      topProducts,
      catalogTopEmpty,
      loading: loadingPage,
      error,
      recommendations,
      getProduct,
      getRecommendations,
      addRecommendation,
      removeRecommendation,
      searchProducts,
      searchProductsRemote,
      refreshRecommendations,
    }),
    [
      countryCode,
      setCountryCode,
      products,
      topProducts,
      catalogTopEmpty,
      loadingPage,
      error,
      recommendations,
      getProduct,
      getRecommendations,
      addRecommendation,
      removeRecommendation,
      searchProducts,
      searchProductsRemote,
      refreshRecommendations,
    ]
  );

  return (
    <ProductCatalogContext.Provider value={value}>{children}</ProductCatalogContext.Provider>
  );
}

export function useProductCatalog(): CatalogState {
  const ctx = useContext(ProductCatalogContext);
  if (!ctx) throw new Error("useProductCatalog debe usarse dentro de ProductCatalogProvider");
  return ctx;
}
