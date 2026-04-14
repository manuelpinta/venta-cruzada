import { useState, useMemo, useEffect } from "react";
import { Search, Timer } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/ProductCard";
import { SupportLinkButton } from "@/components/SupportLinkButton";
import { useProductCatalog } from "@/context/ProductCatalogContext";
import { useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase";
import { COUNTRY_CODES, COUNTRY_LABELS, type CountryCode } from "@/data/countries";

type StatusFilter = "all" | "pending" | "partial" | "complete";

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_DISPLAY_LIMIT = 100;
const FORM_DEADLINE_DAYS = 30;

function formatRemaining(ms: number): string {
  if (ms <= 0) return "0d 00h 00m";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
}

export default function Index() {
  const {
    countryCode,
    setCountryCode,
    topProducts,
    catalogTopEmpty,
    searchProducts,
    recommendations,
    loading,
    error,
  } = useProductCatalog();
  const { user, profile, signOut } = useAuth();

  /** Con perfil en Supabase, el mercado es solo el del perfil (catálogo, top y recs de ese país). */
  const countryLocked = isSupabaseConfigured() && !!profile?.country_code;

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [deadlineAt, setDeadlineAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!user) {
      setDeadlineAt(null);
      return;
    }
    const storageKey = `cross-sell:deadline:${user.id}`;
    const saved = window.localStorage.getItem(storageKey);
    const parsed = saved ? Number(saved) : NaN;
    if (Number.isFinite(parsed) && parsed > 0) {
      setDeadlineAt(parsed);
      return;
    }
    const created = Date.now() + FORM_DEADLINE_DAYS * 24 * 60 * 60 * 1000;
    window.localStorage.setItem(storageKey, String(created));
    setDeadlineAt(created);
  }, [user]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  const recCountBySku = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of recommendations) {
      m.set(g.baseSku, g.recommendedSkus.length);
    }
    return m;
  }, [recommendations]);

  const baseList = useMemo(() => {
    const q = debouncedQuery.trim();
    return q.length >= 2 ? searchProducts(q) : topProducts;
  }, [debouncedQuery, topProducts, searchProducts]);

  const productsWithCounts = useMemo(() => {
    return baseList.map((p) => ({
      product: p,
      recCount: recCountBySku.get(p.sku) ?? 0,
    }));
  }, [baseList, recCountBySku]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return productsWithCounts;
    if (statusFilter === "pending") return productsWithCounts.filter((p) => p.recCount === 0);
    if (statusFilter === "partial") return productsWithCounts.filter((p) => p.recCount > 0 && p.recCount < 3);
    return productsWithCounts.filter((p) => p.recCount >= 3);
  }, [productsWithCounts, statusFilter]);

  const isSearchMode = debouncedQuery.trim().length >= 2;
  const listTruncated = isSearchMode && filtered.length > SEARCH_DISPLAY_LIMIT;
  const listToRender = listTruncated ? filtered.slice(0, SEARCH_DISPLAY_LIMIT) : filtered;

  const total = productsWithCounts.length;
  const complete = productsWithCounts.filter((p) => p.recCount >= 3).length;
  const partial = productsWithCounts.filter((p) => p.recCount > 0 && p.recCount < 3).length;
  const pending = productsWithCounts.filter((p) => p.recCount === 0).length;
  const pct = total > 0 ? Math.round((complete / total) * 100) : 0;
  const remainingMs = deadlineAt != null ? deadlineAt - now : null;
  const deadlineLabel = remainingMs != null ? formatRemaining(remainingMs) : null;
  const deadlineExpired = remainingMs != null && remainingMs <= 0;

  const debouncePending = query.trim() !== debouncedQuery.trim();
  const showSearchUpdating = debouncePending && query.trim().length >= 2;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-slate-50/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-5 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <h2 className="text-blue-800 font-extrabold tracking-tight text-lg">Admin Retail</h2>
            <div className="h-5 w-px bg-slate-300" />
            <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate">Venta Cruzada PDV</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative hidden lg:block">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" aria-hidden />
              <Input
                placeholder="Buscar por nombre o SKU..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-[22rem] rounded-full border-slate-200 bg-white pl-9"
                aria-label="Buscar productos por nombre o SKU"
                aria-describedby={
                  query.trim().length === 1 || showSearchUpdating ? "home-search-hint" : undefined
                }
                autoComplete="off"
              />
            </div>
            <SupportLinkButton />
            {!countryLocked && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">Mercado</span>
                <select
                  className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value as CountryCode)}
                  aria-label="Seleccionar mercado"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c} value={c}>
                      {COUNTRY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {isSupabaseConfigured() && user && (
              <Button variant="outline" size="sm" className="h-8 text-xs border-slate-200 bg-white" onClick={() => void signOut()}>
                <span className="truncate max-w-[10rem] inline-block align-bottom">
                  {profile?.employee_number ?? user.username ?? "Cuenta"}
                </span>
                {profile ? ` · ${COUNTRY_LABELS[profile.country_code]}` : ""} · Salir
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 lg:px-8 py-6 space-y-6">
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <section className="grid grid-cols-1 xl:grid-cols-4 gap-4 lg:gap-5">
          <div className="xl:col-span-3 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">Estado de campaña</p>
                <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 mt-1">Progreso de Venta</h2>
              </div>
              <p className="text-4xl sm:text-5xl font-black text-slate-900">
                {pct}
                <span className="text-2xl text-slate-400">%</span>
              </p>
            </div>
            <div className="h-3 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-700 via-blue-600 to-blue-400 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            {deadlineLabel && (
              <div className="flex items-center gap-3 sm:gap-4 rounded-xl border border-slate-100 bg-slate-50 p-3.5 sm:p-4">
                <div className="rounded-lg bg-blue-100 p-2.5">
                  <Timer className="h-5 w-5 text-blue-700" aria-hidden />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Tiempo restante</p>
                  <p className={`text-sm sm:text-base font-semibold ${deadlineExpired ? "text-destructive" : "text-slate-900"}`}>
                    {deadlineExpired ? "Tiempo agotado para completar el formulario." : deadlineLabel}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <button
              type="button"
              aria-pressed={statusFilter === "complete"}
              onClick={() => setStatusFilter(statusFilter === "complete" ? "all" : "complete")}
              className={`w-full text-left rounded-xl border-l-4 px-4 py-3.5 transition-colors ${
                statusFilter === "complete"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                  : "border-emerald-400 bg-white text-slate-900"
              }`}
            >
              <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-bold">Completado</p>
              <p className="text-2xl font-black">{complete} <span className="text-sm font-medium text-slate-500">artículos</span></p>
            </button>
            <button
              type="button"
              aria-pressed={statusFilter === "partial"}
              onClick={() => setStatusFilter(statusFilter === "partial" ? "all" : "partial")}
              className={`w-full text-left rounded-xl border-l-4 px-4 py-3.5 transition-colors ${
                statusFilter === "partial"
                  ? "border-amber-500 bg-amber-50 text-amber-900"
                  : "border-amber-400 bg-white text-slate-900"
              }`}
            >
              <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-bold">En proceso</p>
              <p className="text-2xl font-black">{partial} <span className="text-sm font-medium text-slate-500">parciales</span></p>
            </button>
            <button
              type="button"
              aria-pressed={statusFilter === "pending"}
              onClick={() => setStatusFilter(statusFilter === "pending" ? "all" : "pending")}
              className={`w-full text-left rounded-xl border-l-4 px-4 py-3.5 transition-colors ${
                statusFilter === "pending"
                  ? "border-white bg-blue-700 text-white"
                  : "border-blue-500 bg-white text-slate-900"
              }`}
            >
              <p className={`text-[10px] uppercase tracking-[0.12em] font-bold ${statusFilter === "pending" ? "text-blue-100" : "text-slate-500"}`}>Pendientes</p>
              <p className="text-2xl font-black">{pending} <span className={`text-sm font-medium ${statusFilter === "pending" ? "text-blue-100" : "text-slate-500"}`}>restantes</span></p>
            </button>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="text-xl font-bold text-slate-900">Listado de Productos</h3>
          </div>

          <div className="relative space-y-1 lg:hidden">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden />
              <Input
                placeholder="Buscar por nombre o SKU…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 bg-white border-slate-200"
                aria-label="Buscar productos por nombre o SKU"
                aria-describedby={
                  query.trim().length === 1 || showSearchUpdating ? "home-search-hint" : undefined
                }
                autoComplete="off"
              />
            </div>
          </div>

          <div className="relative">
            {(query.trim().length === 1 || showSearchUpdating) && (
              <p id="home-search-hint" className="text-[11px] text-slate-500 px-0.5">
                {query.trim().length === 1
                  ? "Mínimo 2 caracteres."
                  : showSearchUpdating
                    ? "Buscando…"
                    : null}
              </p>
            )}
            <p className="text-xs text-slate-500 mb-2">
              {statusFilter !== "all" && (
                <span className="text-blue-700 font-semibold">
                  Filtro: {statusFilter === "complete" ? "completado" : statusFilter === "partial" ? "en proceso" : "pendientes"} ·{" "}
                </span>
              )}
              {listTruncated ? `${listToRender.length} de ${filtered.length} productos` : `${filtered.length} productos`}
            </p>
            {isSupabaseConfigured() && catalogTopEmpty && !isSearchMode && !loading && (
              <p className="text-xs text-amber-700 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2">
                No hay productos en el listado para este mercado. Si debería haberlos, revisa la configuración o contacta a
                soporte.
              </p>
            )}
            {loading && (
              <p className="text-sm text-slate-500 text-center py-8">Cargando productos…</p>
            )}
            {!loading &&
              listToRender.map(({ product, recCount }) => (
                <ProductCard key={product.sku} product={product} recCount={recCount} />
              ))}
            {!loading && filtered.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-8">No se encontraron productos</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
