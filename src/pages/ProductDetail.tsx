import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecommendationEditor } from "@/components/RecommendationEditor";
import { SupportLinkButton } from "@/components/SupportLinkButton";
import { useProductCatalog } from "@/context/ProductCatalogContext";

export default function ProductDetail() {
  const { sku: skuParam } = useParams<{ sku: string }>();
  const sku = skuParam ? decodeURIComponent(skuParam) : "";
  const navigate = useNavigate();
  const {
    getProduct,
    getRecommendations,
    addRecommendation,
    removeRecommendation,
    searchProductsRemote,
    isSkuInMySegment,
    loading,
    error,
  } = useProductCatalog();

  const product = sku ? getProduct(sku) : undefined;

  if (loading && sku) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Cargando…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-2 max-w-md">
          <p className="text-destructive text-sm">{error}</p>
          <Button variant="outline" onClick={() => navigate("/")}>
            Volver
          </Button>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">Producto no encontrado</p>
          <Button variant="outline" onClick={() => navigate("/")}>
            Volver
          </Button>
        </div>
      </div>
    );
  }

  if (!isSkuInMySegment(product.sku)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center space-y-3 max-w-md">
          <p className="text-slate-700 text-sm">
            Este producto no forma parte de tu lista asignada.
          </p>
          <Button variant="outline" onClick={() => navigate("/")}>
            Volver al listado
          </Button>
        </div>
      </div>
    );
  }

  const recommendations = getRecommendations(product.sku);
  const hasDetailMeta = Boolean(product.productLine || product.brand || product.pahl);
  const showTopBadge = product.isTop && product.rank != null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-slate-50/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-5 lg:px-8 h-16 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 hover:bg-slate-200/70"
            onClick={() => navigate("/")}
            aria-label="Volver al listado de productos"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold text-slate-900 truncate">{product.name}</h1>
            <p className="text-xs text-slate-500">{product.sku}</p>
          </div>
          <SupportLinkButton className="shrink-0" />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 lg:px-8 py-6 space-y-5">
        {(showTopBadge || hasDetailMeta) && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
            {showTopBadge && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-2 py-0.5 font-semibold">
                  Top #{product.rank}
                </span>
              </div>
            )}
            {hasDetailMeta && (
              <dl
                className={`grid gap-2 text-sm ${showTopBadge ? "mt-3 border-t border-slate-200 pt-3" : ""}`}
              >
                {product.productLine && (
                  <div className="grid grid-cols-[5rem_1fr] gap-x-2 gap-y-0.5 items-baseline">
                    <dt className="text-xs text-slate-500">Línea</dt>
                    <dd className="text-slate-900">{product.productLine}</dd>
                  </div>
                )}
                {product.brand && (
                  <div className="grid grid-cols-[5rem_1fr] gap-x-2 gap-y-0.5 items-baseline">
                    <dt className="text-xs text-slate-500">Marca</dt>
                    <dd className="text-slate-900">{product.brand}</dd>
                  </div>
                )}
                {product.pahl && (
                  <div className="grid grid-cols-[5rem_1fr] gap-x-2 gap-y-0.5 items-baseline">
                    <dt className="text-xs text-slate-500">PAHL</dt>
                    <dd className="text-slate-900">{product.pahl}</dd>
                  </div>
                )}
              </dl>
            )}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
          <RecommendationEditor
            currentProductId={product.sku}
            recommendations={recommendations}
            onAdd={addRecommendation}
            onRemove={removeRecommendation}
            searchProducts={searchProductsRemote}
          />
        </div>
      </main>
    </div>
  );
}
