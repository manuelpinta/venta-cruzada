import { memo, useCallback } from "react";
import { Product } from "@/data/types";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Circle, AlertCircle } from "lucide-react";

interface ProductCardProps {
  product: Product;
  recCount?: number;
}

function getStatus(count: number) {
  if (count === 0) return { icon: Circle, label: "Sin llenar", color: "text-muted-foreground", bg: "bg-muted", ring: "" };
  if (count < 3)
    return {
      icon: AlertCircle,
      label: `${count}/4`,
      color: "text-amber-700 dark:text-amber-400",
      bg: "bg-amber-500/10",
      ring: "ring-1 ring-amber-500/20",
    };
  return {
    icon: CheckCircle2,
    label: `${count}/4`,
    color: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    ring: "ring-1 ring-emerald-500/20",
  };
}

export const ProductCard = memo(function ProductCard({ product, recCount = 0 }: ProductCardProps) {
  const navigate = useNavigate();
  const status = getStatus(recCount);
  const StatusIcon = status.icon;

  const label = `Editar recomendaciones de ${product.name}, SKU ${product.sku}`;

  const onClick = useCallback(() => {
    void navigate(`/producto/${encodeURIComponent(product.sku)}`);
  }, [navigate, product.sku]);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-all hover:border-primary/40 hover:bg-accent w-full group ${
        recCount === 0 ? "opacity-80" : ""
      }`}
    >
      {product.rank != null && (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
          #{product.rank}
        </span>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
        <p className="text-xs text-muted-foreground">{product.sku}</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${status.bg} ${status.color} ${status.ring}`}
        >
          <StatusIcon className="h-3 w-3" aria-hidden />
          {status.label}
        </span>
      </div>
    </button>
  );
});
