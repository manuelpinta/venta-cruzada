import { useState, useRef, useEffect, useCallback } from "react";
import { Product } from "@/data/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { X, Plus, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

type AddResult = { success: boolean; error?: string };

interface RecommendationEditorProps {
  currentProductId: string;
  recommendations: Product[];
  onAdd: (productId: string, recommendedId: string) => AddResult | Promise<AddResult>;
  onRemove: (productId: string, recommendedId: string) => Promise<{ success: boolean; error?: string }>;
  /** Puede ser búsqueda local o remota (MySQL vía `q=`). */
  searchProducts: (query: string) => Product[] | Promise<Product[]>;
}

export function RecommendationEditor({
  currentProductId,
  recommendations,
  onAdd,
  onRemove,
  searchProducts,
}: RecommendationEditorProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [searchBusy, setSearchBusy] = useState(false);
  /** Texto con el que se ejecutó la última búsqueda (para mensaje sin resultados). */
  const [searchedTerm, setSearchedTerm] = useState("");
  /** Validación corta o error de envío (sin toast repetitivo). */
  const [searchInlineError, setSearchInlineError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Product | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchSeq = useRef(0);

  const runSearch = useCallback(async () => {
    const q = query.trim();
    setSearchInlineError(null);
    if (q.length < 2) {
      setSearchInlineError("Escribe al menos 2 caracteres para buscar.");
      return;
    }
    const seq = ++searchSeq.current;
    setSearchBusy(true);
    setShowResults(true);
    setResults([]);

    try {
      const filtered = await Promise.resolve(searchProducts(q));
      if (seq !== searchSeq.current) return;
      const next = filtered.filter(
        (p) => p.id !== currentProductId && !recommendations.some((r) => r.id === p.id)
      );
      setResults(next.slice(0, 50));
      setSearchedTerm(q);
    } catch {
      if (seq !== searchSeq.current) return;
      setResults([]);
      setSearchedTerm(q);
      toast.error("No se pudo buscar en el catálogo.");
    } finally {
      if (seq === searchSeq.current) setSearchBusy(false);
    }
  }, [query, currentProductId, recommendations, searchProducts]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAdd = async (product: Product) => {
    const result = await Promise.resolve(onAdd(currentProductId, product.id));
    if (result.success) {
      toast.success(`${product.name} agregado como recomendación`);
      setQuery("");
      setResults([]);
      setSearchedTerm("");
      setSearchInlineError(null);
      setShowResults(false);
    } else {
      toast.error(result.error);
    }
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    setRemoveBusy(true);
    try {
      const res = await onRemove(currentProductId, removeTarget.id);
      if (res.success) {
        toast.success("Recomendación quitada");
        setRemoveTarget(null);
      } else {
        toast.error(res.error ?? "No se pudo quitar la recomendación");
      }
    } finally {
      setRemoveBusy(false);
    }
  };

  const panelOpen =
    showResults &&
    (searchBusy || results.length > 0 || (!searchBusy && searchedTerm.length >= 2));

  const panelId = "recommendation-search-results";

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-bold text-slate-900 mb-2">
          Recomendaciones ({recommendations.length}/4)
        </h3>
        {recommendations.length === 0 ? (
          <p className="text-sm text-slate-500 italic">Sin recomendaciones aún</p>
        ) : (
          <div className="space-y-2">
            {recommendations.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-2.5 gap-2"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-xs text-slate-500 shrink-0">{product.sku}</span>
                  <span className="text-sm truncate text-slate-900">{product.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-slate-500 hover:text-destructive"
                  type="button"
                  aria-label={`Quitar recomendación ${product.name}, SKU ${product.sku}`}
                  onClick={() => setRemoveTarget(product)}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={removeTarget != null} onOpenChange={(open) => !open && !removeBusy && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar esta recomendación?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget ? (
                <>
                  Se eliminará <strong className="text-foreground">{removeTarget.name}</strong> ({removeTarget.sku}) de
                  las recomendaciones de este producto.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeBusy}>Cancelar</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={removeBusy}
              onClick={() => void confirmRemove()}
            >
              {removeBusy ? "Quitando…" : "Quitar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {recommendations.length < 4 && (
        <div
          ref={containerRef}
          className="relative space-y-2"
          onKeyDown={(e) => {
            if (e.key === "Escape") setShowResults(false);
          }}
        >
          <form
            className="flex gap-2 items-center"
            onSubmit={(e) => {
              e.preventDefault();
              void runSearch();
            }}
          >
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden />
              <Input
                id="recommendation-search-input"
                placeholder="Buscar en catálogo…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (searchInlineError) setSearchInlineError(null);
                }}
                onFocus={() => {
                  if (searchedTerm || results.length > 0) setShowResults(true);
                }}
                className="pl-9 border-slate-200 bg-slate-50"
                aria-busy={searchBusy}
                aria-expanded={panelOpen}
                aria-controls={panelOpen ? panelId : undefined}
                aria-invalid={!!searchInlineError}
                aria-describedby={
                  searchInlineError ? "recommendation-search-error" : undefined
                }
                autoComplete="off"
              />
            </div>
            <Button type="submit" disabled={searchBusy} className="shrink-0 bg-blue-700 hover:bg-blue-800 text-white">
              {searchBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" aria-hidden />
                  Buscando
                </>
              ) : (
                "Buscar"
              )}
            </Button>
          </form>
          {searchInlineError && (
            <p id="recommendation-search-error" role="alert" className="text-[11px] text-destructive">
              {searchInlineError}
            </p>
          )}

          {panelOpen && (
            <div
              id={panelId}
              role="listbox"
              aria-label="Resultados de búsqueda de productos"
              className="absolute z-10 left-0 right-0 top-full mt-1 rounded-xl border border-slate-200 bg-white shadow-lg max-h-72 overflow-y-auto"
            >
              {searchBusy ? (
                <div className="flex items-center gap-2 px-3 py-3 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0 text-blue-700" aria-hidden />
                  <span className="font-medium text-slate-900">Buscando…</span>
                </div>
              ) : results.length > 0 ? (
                results.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    role="option"
                    onClick={() => handleAdd(product)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-slate-50 transition-colors text-sm"
                  >
                    <Plus className="h-3.5 w-3.5 text-blue-700 shrink-0" aria-hidden />
                    <span className="truncate flex-1">{product.name}</span>
                    <span className="text-xs text-slate-500 shrink-0">{product.sku}</span>
                  </button>
                ))
              ) : (
                <div className="p-3 text-sm text-slate-500">
                  Sin resultados para «{searchedTerm}»
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
